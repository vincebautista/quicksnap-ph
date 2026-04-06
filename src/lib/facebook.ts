import { supabase } from "@/lib/supabase";

const FB_PAGE_ID = process.env.FB_PAGE_ID;
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

export async function postToFacebook(
    headline: string,
    summary: string,
    url: string,
    image?: string | null
): Promise<boolean> {
    if (!FB_PAGE_ID || !FB_PAGE_ACCESS_TOKEN) {
        throw new Error("Facebook credentials not configured");
    }

    const message = `📰 ${headline}\n\n${summary}\n\nRead more: ${url}`;

    try {
        const formData = new FormData();
        formData.append("access_token", FB_PAGE_ACCESS_TOKEN);

        // If there's an image, we use the /photos endpoint
        // This avoids the "URL ownership" error entirely
        let endpoint = `https://graph.facebook.com/v18.0/${FB_PAGE_ID}/feed`;

        if (image) {
            endpoint = `https://graph.facebook.com/v18.0/${FB_PAGE_ID}/photos`;
            formData.append("url", image);
            formData.append("caption", message); // Use 'caption' for photos
        } else {
            formData.append("message", message); // Use 'message' for standard feed
        }

        const response = await fetch(endpoint, {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Facebook API error: ${error.error?.message || "Unknown error"}`);
        }

        return true;
    } catch (error) {
        console.error("[Facebook posting] error:", error);
        throw error;
    }
}

export async function scheduleArticlePosts(articleIds: string[]): Promise<void> {
    if (articleIds.length === 0) return;

    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    // Distribute posts evenly across the hour
    const interval = (oneHourLater.getTime() - now.getTime()) / articleIds.length;

    const scheduledArticles = articleIds.map((id, index) => ({
        id,
        scheduled_for: new Date(now.getTime() + interval * (index + 1)).toISOString(),
    }));

    const { error } = await supabase
        .from("news_articles")
        .upsert(scheduledArticles, { onConflict: "id" });

    if (error) {
        throw new Error(`Failed to schedule posts: ${error.message}`);
    }
}

export async function postScheduledArticles(): Promise<number> {
    const now = new Date().toISOString();

    // Get articles that are scheduled to post and haven't been posted yet
    const { data: articles, error: fetchError } = await supabase
        .from("news_articles")
        .select("*")
        .eq("is_posted", false)
        .lte("scheduled_for", now)
        .not("scheduled_for", "is", null)
        .order("scheduled_for", { ascending: true })
        .limit(10);

    if (fetchError) {
        throw new Error(`Fetch failed: ${fetchError.message}`);
    }

    if (!articles || articles.length === 0) {
        return 0;
    }

    let successCount = 0;

    for (const article of articles) {
        try {
            await postToFacebook(
                article.tagalog_headline || article.title,
                article.tagalog_summary || article.description,
                article.url,
                article.image
            );

            // Mark as posted
            await supabase
                .from("news_articles")
                .update({ is_posted: true })
                .eq("id", article.id);

            successCount++;
        } catch (error) {
            console.error(`[postScheduledArticles] Failed to post article ${article.id}:`, error);
            // Continue with next article instead of failing
        }
    }

    return successCount;
}
