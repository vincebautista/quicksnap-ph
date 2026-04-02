import { supabase } from "@/lib/supabase";
import { scrapeFullContent } from "@/lib/scraper";

export async function GET() {
    const { data: articles, error } = await supabase
        .from("news_articles")
        .select("id, title, url, gemini_score, published")
        .eq("is_posted", false)
        .not("gemini_score", "is", null)
        .order("gemini_score", { ascending: false })
        .order("published", { ascending: false })
        .limit(5);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!articles || articles.length === 0) return Response.json({ articles: [] });

    const results = await Promise.all(
        articles.map(async (article) => {
            const full_content = await scrapeFullContent(article.url);
            return {
                id: article.id,
                title: article.title,
                url: article.url,
                gemini_score: article.gemini_score,
                published: article.published,
                full_content,
                success: full_content !== null,
            };
        })
    );

    return Response.json({ articles: results });
}