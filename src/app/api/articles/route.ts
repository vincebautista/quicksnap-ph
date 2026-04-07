import { supabase } from "@/lib/supabase";

export async function GET() {
    try {
        // Fetch recent articles including failed scrapes for monitoring.
        const { data: articles, error } = await supabase
            .from("news_articles")
            .select("*")
            .order("published", { ascending: false })
            .limit(200);

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
