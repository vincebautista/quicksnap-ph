export const runtime = "nodejs";
export const maxDuration = 300;

import { fetchAndScrapeTopArticles } from "@/lib/topArticles";

export async function GET() {
    try {
        const articles = await fetchAndScrapeTopArticles();
        return Response.json({ articles, success: true });
    } catch (error) {
        console.error("[scrape API] error:", error);
        return Response.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}
