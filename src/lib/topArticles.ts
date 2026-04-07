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

type FetchAndScrapeResult = {
    successfulResults: ScrapedResult[];
    failedResults: ScrapedResult[];
};
export async function fetchAndScrapeTopArticles(targetCount = 5): Promise<FetchAndScrapeResult> {
    const { data: articles, error } = await supabase
        .from("news_articles")
        .select("*")
        .eq("is_posted", false)
        .eq("scrape_failed", false)
        .is("full_content", null)
        .not("gemini_score", "is", null)
        .order("gemini_score", { ascending: false })
        .order("published", { ascending: false })
        .limit(targetCount);

    if (error) throw new Error(`Fetch failed: ${error.message}`);

    if (!articles || articles.length === 0) {
        return {
            successfulResults: [],
            failedResults: [],
        };
    }

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

    const failedResults = batchResults.filter((a) => a.scrape_failed);
    const successfulResults = batchResults.filter((a) => !a.scrape_failed);

    if (failedResults.length > 0) {
        const ids = failedResults.map((a) => a.id);
        await supabase
            .from("news_articles")
            .update({ scrape_failed: true })
            .in("id", ids);
    }

    if (successfulResults.length > 0) {
        await Promise.all(
            successfulResults.map(({ id, full_content }) =>
                supabase
                    .from("news_articles")
                    .update({ full_content })
                    .eq("id", id)
            )
        );
    }

    for (const article of successfulResults) {
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

        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return {
        successfulResults,
        failedResults,
    };
}