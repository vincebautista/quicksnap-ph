export const runtime = "nodejs";

import { postToFacebook } from "@/lib/facebook";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
    try {
        const { articleId } = await request.json();

        if (!articleId) {
            return Response.json(
                { error: "articleId is required" },
                { status: 400 }
            );
        }

        // Fetch article from database
        const { data: article, error: fetchError } = await supabase
            .from("news_articles")
            .select("*")
            .eq("id", articleId)
            .single();

        if (fetchError || !article) {
            return Response.json(
                { error: "Article not found" },
                { status: 404 }
            );
        }

        if (article.is_posted) {
            return Response.json(
                { error: "Article already posted" },
                { status: 400 }
            );
        }

        // Post to Facebook
        await postToFacebook(
            article.tagalog_headline || article.title,
            article.tagalog_summary || article.description,
            article.url,
            article.image
        );

        // Mark as posted
        const { error: updateError } = await supabase
            .from("news_articles")
            .update({ is_posted: true })
            .eq("id", articleId);

        if (updateError) {
            throw new Error(`Failed to update article status: ${updateError.message}`);
        }

        return Response.json({ success: true, posted: true });
    } catch (error) {
        console.error("[post API] error:", error);
        return Response.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}
