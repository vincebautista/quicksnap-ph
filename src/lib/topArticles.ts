import { supabase } from "@/lib/supabase";
import { scrapeFullContent } from "@/lib/scraper";
import { generateTagalogContent } from "@/lib/gemini";

type ScrapedResult = {
    id: string;
    url: string;
    full_content: string | null;
    tagalog_headline: string | null;
    tagalog_summary: string | null;
    scrape_failed: boolean;
} & Record<string, unknown>;

export async function fetchAndScrapeTopArticles(targetCount = 5) {
    const FETCH_BATCH_SIZE = 15;
    const successfulResults: ScrapedResult[] = [];
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

        if (error) throw new Error(`Fetch failed: ${error.message}`);
        if (!articles || articles.length === 0) break;

        const batchResults = await Promise.all(
            articles.map(async (article) => {
                const full_content = await scrapeFullContent(article.url);
                return {
                    ...article,
                    full_content,
                    tagalog_headline: null,
                    tagalog_summary: null,
                    scrape_failed: full_content === null,
                };
            })
        );

        const failed = batchResults.filter((a) => a.scrape_failed);
        const succeeded = batchResults.filter((a) => !a.scrape_failed);

        if (failed.length > 0) {
            const ids = failed.map((a) => a.id);
            failedIds.push(...ids);
            await supabase
                .from("news_articles")
                .update({ scrape_failed: true })
                .in("id", ids);
        }

        if (succeeded.length > 0) {
            await Promise.all(
                succeeded.map(({ id, full_content }) =>
                    supabase
                        .from("news_articles")
                        .update({ full_content })
                        .eq("id", id)
                )
            );
        }

        const remaining = targetCount - successfulResults.length;
        successfulResults.push(...succeeded.slice(0, remaining));

        offset += FETCH_BATCH_SIZE;
    }

    await Promise.all(
        successfulResults.map(async (article) => {
            const tagalog = await generateTagalogContent(
                article.title as string,
                article.full_content!
            );

            if (tagalog) {
                article.tagalog_headline = tagalog.headline;
                article.tagalog_summary = tagalog.summary;

                await supabase
                    .from("news_articles")
                    .update({
                        tagalog_headline: tagalog.headline,
                        tagalog_summary: tagalog.summary,
                    })
                    .eq("id", article.id);
            }
        })
    );

    return successfulResults;
}