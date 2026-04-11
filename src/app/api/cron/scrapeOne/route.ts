import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { scrapeFullContentCron } from "@/lib/scraperCron";
import { generateTagalogContent } from "@/lib/gemini";

export async function POST(req: Request) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: articles, error } = await supabase
        .from("news_articles")
        .select("*")
        .eq("is_posted", false)
        .eq("scrape_failed", false)
        .is("full_content", null)
        .not("gemini_score", "is", null)
        .order("gemini_score", { ascending: false })
        .order("published", { ascending: false })
        .limit(1);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!articles || articles.length === 0) {
        return NextResponse.json({ message: "No articles to scrape" }, { status: 200 });
    }

    const article = articles[0];

    // Scrape with retries
    let full_content: string | null = null;
    let retries = 2;
    let success = false;

    while (retries >= 0 && !success) {
        try {
            full_content = await scrapeFullContentCron(article.url);
            if (full_content) {
                success = true;
            } else {
                throw new Error("Scrape returned null");
            }
        } catch (err) {
            console.error(`[scraper] Attempt failed for ${article.url}, retries left: ${retries}`, err);
            if (retries > 0) await new Promise(r => setTimeout(r, 2000));
            retries--;
        }
    }

    if (!success || !full_content) {
        await supabase
            .from("news_articles")
            .update({ scrape_failed: true })
            .eq("id", article.id);

        return NextResponse.json(
            { error: "Scrape failed", article_id: article.id, url: article.url },
            { status: 500 }
        );
    }

    // Save scraped content
    await supabase
        .from("news_articles")
        .update({ full_content })
        .eq("id", article.id);

    // Generate Tagalog content
    let tagalog: { headline: string; summary: string } | null = null;
    retries = 2;
    success = false;

    while (retries >= 0 && !success) {
        try {
            tagalog = await generateTagalogContent(article.title as string, full_content);
            if (tagalog) success = true;
            else throw new Error("Gemini returned null");
        } catch (err) {
            console.error(`[gemini] Attempt failed for ${article.title}, retries left: ${retries}`, err);
            if (retries > 0) await new Promise(r => setTimeout(r, 2000));
            retries--;
        }
    }

    if (tagalog) {
        await supabase
            .from("news_articles")
            .update({
                tagalog_headline: tagalog.headline,
                tagalog_summary: tagalog.summary,
            })
            .eq("id", article.id);
    }

    return NextResponse.json({
        success: true,
        article_id: article.id,
        title: article.title,
        tagalog_generated: !!tagalog,
    });
}