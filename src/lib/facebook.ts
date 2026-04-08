/**
 * lib/facebook.ts
 *
 * Improvements:
 *  1. processArticleImage() — branded overlay on hero image before posting
 *  2. buildCaption()        — hook-first, question CTA, emoji, NO outbound link
 *  3. postToFacebook()      — posts photo via /photos, then adds link as first comment
 *  4. scheduleArticlePosts() / postScheduledArticles() — unchanged logic, updated to use new helpers
 */

import { supabase } from "@/lib/supabase";
import { processArticleImage } from "@/lib/imageProcessor";

const FB_PAGE_ID = process.env.FB_PAGE_ID;
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

// ─── Caption Builder ─────────────────────────────────────────────────────────

/**
 * Picks an emoji based on article category for visual variety.
 */
function categoryEmoji(category?: string | string[]): string {
    const cat = Array.isArray(category) ? category[0] : category ?? "";
    const map: Record<string, string> = {
        politics: "🏛️",
        crime: "🚨",
        economy: "📉",
        business: "💼",
        weather: "⛈️",
        health: "🏥",
        sports: "⚽",
        technology: "📱",
        entertainment: "🎬",
        world: "🌏",
    };
    return map[cat.toLowerCase()] ?? "📰";
}

/**
 * Generates a question CTA at the end of the caption.
 * These rotate to avoid feeling repetitive.
 */
function questionCTA(category?: string | string[]): string {
    const cat = Array.isArray(category) ? category[0] : category ?? "";
    const ctaMap: Record<string, string[]> = {
        economy: [
            "Basahin ang buong detalye sa comment section. 👇",
        ],
        politics: [
            "Basahin ang buong detalye sa comment section. 👇",
        ],
        crime: [
            "Basahin ang buong detalye sa comment section. 👇",
        ],
        default: [
            "Basahin ang buong detalye sa comment section. 👇",
        ],
    };

    const options = ctaMap[cat.toLowerCase()] ?? ctaMap.default;
    return options[Math.floor(Math.random() * options.length)];
}

/**
 * Builds the Facebook caption following the 3-line rule:
 *   Line 1: emoji + punchy hook (≤80 chars ideally)
 *   Line 2-3: short summary (3–4 sentences)
 *   Line 4: question CTA
 *
 * NO link — that goes as the first comment.
 */
export function buildCaption(
    headline: string,
    summary: string,
    category?: string | string[]
): string {
    const emoji = categoryEmoji(category);
    const cta = questionCTA(category);

    // Truncate headline for the hook if it's too long
    const hook = headline.length > 90 ? headline.slice(0, 87) + "…" : headline;

    return `${emoji} ${hook}\n\n${summary}\n\n${cta}`;
}

// ─── Facebook API Helpers ────────────────────────────────────────────────────

async function fbPost(
    endpoint: string,
    body: Record<string, string>
): Promise<{ id: string }> {
    const formData = new FormData();
    for (const [k, v] of Object.entries(body)) {
        formData.append(k, v);
    }

    const res = await fetch(endpoint, { method: "POST", body: formData });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Facebook API error: ${err.error?.message ?? "Unknown"}`);
    }
    return res.json();
}

// ─── Main Post Function ──────────────────────────────────────────────────────

/**
 * Strategy:
 *  1. Process hero image → add overlay, headline text, logo, border
 *  2. POST to /photos with the processed image + caption (no link in caption)
 *  3. POST the article URL as the first comment on the published photo
 *
 * This maximises organic reach by keeping the main post link-free.
 */
export async function postToFacebook(
    headline: string,
    summary: string,
    url: string,
    imageUrl?: string | null,
    category?: string | string[]
): Promise<boolean> {
    if (!FB_PAGE_ID || !FB_PAGE_ACCESS_TOKEN) {
        throw new Error("Facebook credentials not configured");
    }

    const caption = buildCaption(headline, summary, category);
    let postId: string | null = null;

    // ── A. Post with branded processed image ─────────────────────────────────
    if (imageUrl) {
        try {
            const { base64, mimeType } = await processArticleImage(imageUrl, headline);

            // Upload processed image as binary to /photos
            const photoEndpoint = `https://graph.facebook.com/v18.0/${FB_PAGE_ID}/photos`;

            const formData = new FormData();
            formData.append("access_token", FB_PAGE_ACCESS_TOKEN);
            formData.append("caption", caption);

            // Facebook /photos accepts `source` as raw file bytes
            const blob = new Blob(
                [Buffer.from(base64, "base64")],
                { type: mimeType }
            );
            formData.append("source", blob, "news.png");

            const res = await fetch(photoEndpoint, { method: "POST", body: formData });
            if (res.ok) {
                const data = await res.json();
                // /photos returns { id: "photo_id", post_id: "page_post_id" }
                // We use the photo id directly for commenting — no extra permissions needed
                postId = data.id ?? null;
            } else {
                // Fall through to text-only post
                console.warn("[facebook] Photo upload failed, falling back to text post");
            }
        } catch (imgErr) {
            console.warn("[facebook] Image processing error, falling back to text post:", imgErr);
        }
    }

    // ── B. Fallback: text-only feed post (no image) ───────────────────────────
    if (!postId) {
        const feedEndpoint = `https://graph.facebook.com/v18.0/${FB_PAGE_ID}/feed`;
        const data = await fbPost(feedEndpoint, {
            access_token: FB_PAGE_ACCESS_TOKEN,
            message: caption,
        });
        postId = data.id;
    }

    // ── C. Link in first comment ──────────────────────────────────────────────
    if (postId) {
        try {
            const commentEndpoint = `https://graph.facebook.com/v18.0/${postId}/comments`;
            await fbPost(commentEndpoint, {
                access_token: FB_PAGE_ACCESS_TOKEN,
                message: `📖 Basahin ang buong balita dito:\n${url}`,
            });
        } catch (commentErr) {
            // Non-fatal — post is already live
            console.error("[facebook] Failed to post link comment:", commentErr);
        }
    }

    return true;
}

// ─── Scheduling (unchanged logic, updated signature) ─────────────────────────

export async function scheduleArticlePosts(articleIds: string[]): Promise<void> {
    if (articleIds.length === 0) return;

    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const interval = (oneHourLater.getTime() - now.getTime()) / articleIds.length;

    const scheduledArticles = articleIds.map((id, index) => ({
        id,
        scheduled_for: new Date(now.getTime() + interval * (index + 1)).toISOString(),
    }));

    const { error } = await supabase
        .from("news_articles")
        .upsert(scheduledArticles, { onConflict: "id" });

    if (error) throw new Error(`Failed to schedule posts: ${error.message}`);
}

export async function postScheduledArticles(): Promise<number> {
    const now = new Date().toISOString();

    const { data: articles, error: fetchError } = await supabase
        .from("news_articles")
        .select("*")
        .eq("is_posted", false)
        .lte("scheduled_for", now)
        .not("scheduled_for", "is", null)
        .order("scheduled_for", { ascending: true })
        .limit(10);

    if (fetchError) throw new Error(`Fetch failed: ${fetchError.message}`);
    if (!articles || articles.length === 0) return 0;

    let successCount = 0;

    for (const article of articles) {
        try {
            await postToFacebook(
                article.tagalog_headline ?? article.title,
                article.tagalog_summary ?? article.description,
                article.url,
                article.image,
                article.category
            );

            await supabase
                .from("news_articles")
                .update({ is_posted: true })
                .eq("id", article.id);

            successCount++;
        } catch (error) {
            console.error(`[postScheduledArticles] Failed for article ${article.id}:`, error);
        }
    }

    return successCount;
}