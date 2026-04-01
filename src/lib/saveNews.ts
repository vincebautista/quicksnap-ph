import { supabase } from "@/lib/supabase";
import { NewsArticle } from "@/types/news";
import { deduplicateArticles } from "@/lib/deduplicate";

export async function saveNewArticles(incoming: NewsArticle[]): Promise<number> {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: existing, error: fetchError } = await supabase
        .from("news_articles")
        .select("title")
        .gte("published", since);

    if (fetchError) throw new Error(`Supabase fetch failed: ${fetchError.message}`);

    const fresh = deduplicateArticles(incoming, existing ?? []);
    if (fresh.length === 0) return 0;

    const { error: insertError } = await supabase
        .from("news_articles")
        .upsert(
            fresh.map((a) => ({
                id: a.id,
                title: a.title,
                description: a.description,
                url: a.url,
                author: a.author,
                image: a.image,
                language: a.language,
                category: a.category,
                published: new Date(a.published).toISOString(),
            })),
            { onConflict: "id" }
        );

    if (insertError) throw new Error(`Supabase insert failed: ${insertError.message}`);

    return fresh.length;
}