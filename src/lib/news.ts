// lib/news.ts
import { supabase } from "@/lib/supabase";
import { NewsData } from "@/types/news";

export async function fetchAllNews(): Promise<NewsData> {
    const { data, error } = await supabase
        .from("news_articles")
        .select("*")
        .order("published", { ascending: false })
        .limit(100);

    if (error) {
        console.error("Supabase read failed:", error.message);
        return {};
    }

    return (data ?? []).reduce((acc, article) => {
        const category = article.category?.[0] ?? "general";
        if (!acc[category]) acc[category] = [];
        acc[category].push({
            ...article,
            published: article.published,
        });
        return acc;
    }, {} as NewsData);
}