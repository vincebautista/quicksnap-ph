import { supabase } from "@/lib/supabase";

export async function GET() {
    try {
        // Fetch all articles that have been scraped (have full_content and tagalog content)
        const { data: articles, error } = await supabase
            .from("news_articles")
            .select("*")
            .not("full_content", "is", null)
            .not("tagalog_headline", "is", null)
            .order("published", { ascending: false });

        if (error) {
            return Response.json({ error: error.message }, { status: 500 });
        }

        return Response.json({ articles });
    } catch (error) {
        console.error("[articles API] error:", error);
        return Response.json(
            { error: (error as Error).message },
            { status: 500 }
        );
    }
}
