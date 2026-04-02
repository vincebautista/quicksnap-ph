import { fetchAndScrapeTopArticles } from "@/lib/topArticles";

export async function GET(request: Request) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const articles = await fetchAndScrapeTopArticles();
        return Response.json({ success: true, scraped: articles.length });
    } catch (error) {
        console.error("[scrapeTop cron] error:", error);
        return Response.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}