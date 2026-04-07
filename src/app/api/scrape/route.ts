export const runtime = "nodejs";
export const maxDuration = 300;

import { fetchAndScrapeTopArticles } from "@/lib/topArticles";

export async function GET() {
    try {
        const { successfulResults, failedResults } = await fetchAndScrapeTopArticles();
        return Response.json({
            success: true,
            articles: successfulResults,
            failed: failedResults,
        });
    } catch (error) {
        console.error("[scrape API] error:", error);
        return Response.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}
