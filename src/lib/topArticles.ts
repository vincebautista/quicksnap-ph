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

    const successfulResults: ScrapedResult[] = [];
    const failedResults: ScrapedResult[] = [];

    for (const article of articles) {
        let full_content: string | null = null;
        let retries = 2;
        let success = false;

        // Step 1: Scrape Content
        while (retries >= 0 && !success) {
            try {
                full_content = await scrapeFullContent(article.url);
                if (full_content) {
                    success = true;
                } else {
                    throw new Error("Scrape returned null");
                }
            } catch (error) {
                console.error(`[scraper] Attempt failed for ${article.url}, retries left: ${retries}`, error);
                if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                retries--;
            }
        }

        if (!success) {
            console.error(`[scraper] All attempts failed for ${article.url}`);
            await supabase
                .from("news_articles")
                .update({ scrape_failed: true })
                .eq("id", article.id);
            
            failedResults.push({
                ...article,
                full_content: null,
                tagalog_headline: null,
                tagalog_summary: null,
                scrape_failed: true,
            });
            continue;
        }

        // Save scraped content immediately
        await supabase
            .from("news_articles")
            .update({ full_content })
            .eq("id", article.id);

        // Step 2: Generate Tagalog Content
        let tagalog: { headline: string; summary: string } | null = null;
        retries = 2;
        success = false;

        while (retries >= 0 && !success) {
            try {
                tagalog = await generateTagalogContent(article.title as string, full_content!);
                if (tagalog) {
                    success = true;
                } else {
                    throw new Error("Gemini returned null");
                }
            } catch (error) {
                console.error(`[gemini] Attempt failed for ${article.title}, retries left: ${retries}`, error);
                if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                retries--;
            }
        }

        if (success && tagalog) {
            await supabase
                .from("news_articles")
                .update({
                    tagalog_headline: tagalog.headline,
                    tagalog_summary: tagalog.summary,
                })
                .eq("id", article.id);
            
            successfulResults.push({
                ...article,
                full_content,
                tagalog_headline: tagalog.headline,
                tagalog_summary: tagalog.summary,
                scrape_failed: false,
            });
        } else {
            console.error(`[gemini] Failed to generate Tagalog for ${article.title}`);
            successfulResults.push({
                ...article,
                full_content,
                tagalog_headline: null,
                tagalog_summary: null,
                scrape_failed: false,
            });
        }

        // Delay between articles
        await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    return {
        successfulResults,
        failedResults,
    };
}
