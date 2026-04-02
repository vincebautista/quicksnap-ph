export const runtime = "nodejs";
export const maxDuration = 300;

import { supabase } from "@/lib/supabase";
import { scrapeFullContent } from "@/lib/scraper";
import { generateTagalogContent } from "@/lib/gemini";

const FETCH_BATCH_SIZE = 15;

type ScrapedArticle = {
    id: string;
    title: string;
    full_content: string | null;
    tagalog_headline: string | null;
    tagalog_summary: string | null;
    scrape_failed: boolean;
} & Record<string, unknown>;

export async function GET() {
    const targetCount = 5;
    const successfulResults: ScrapedArticle[] = [];
    let offset = 0;
    const failedIds: string[] = [];

    while (successfulResults.length < targetCount) {
        let query = supabase
            .from("news_articles")
            .select("*")
            .eq("is_posted", false)
            .eq("scrape_failed", false)
            .not("gemini_score", "is", null)
            .order("gemini_score", { ascending: false })
            .order("published", { ascending: false })
            .range(offset, offset + FETCH_BATCH_SIZE - 1);

        if (failedIds.length > 0) {
            query = query.not("id", "in", `(${failedIds.join(",")})`);
        }

        const { data: articles, error } = await query;

        if (error) return Response.json({ error: error.message }, { status: 500 });
        if (!articles || articles.length === 0) break;

        const batchResults = await Promise.all(
            articles.map(async (article) => {
                const full_content = await scrapeFullContent(article.url);
                return {
                    ...article,
                    full_content,
                    scrape_failed: full_content === null,
                    tagalog_headline: null as string | null,
                    tagalog_summary: null as string | null,
                };
            })
        );

        const failed: ScrapedArticle[] = batchResults.filter((a) => a.scrape_failed);
        const succeeded: ScrapedArticle[] = batchResults.filter((a) => !a.scrape_failed);

        // Track failed IDs to exclude in next batch — no DB save
        failedIds.push(...failed.map((a) => a.id));

        const remaining: number = targetCount - successfulResults.length;
        successfulResults.push(...succeeded.slice(0, remaining));

        offset += FETCH_BATCH_SIZE;
    }

    // Generate Tagalog content for successful scrapes — no DB save
    for (const article of successfulResults) {
        const tagalog = await generateTagalogContent(
            article.title,
            article.full_content!
        );
        if (tagalog) {
            article.tagalog_headline = tagalog.headline;
            article.tagalog_summary = tagalog.summary;
        }
        // Small delay between Gemini calls to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return Response.json({ articles: successfulResults });
}