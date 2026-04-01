// app/api/cron/fetch-news/route.ts
import { NextRequest, NextResponse } from "next/server";
import { saveNewArticles } from "@/lib/articles";
import { NewsArticle } from "@/types/news";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(
      `https://api.currentsapi.services/v2/latest-news?country=PH&language=en&apiKey=${process.env.CURRENTS_API_KEY}`
    );

    const data = await res.json();

    const articles: NewsArticle[] = (data.news ?? []).filter(
      (a: NewsArticle) =>
        a.image?.startsWith("http") &&
        a.title?.trim() &&
        a.description?.trim()
    );

    const saved = await saveNewArticles(articles);

    return NextResponse.json({ success: true, saved });
  } catch (err) {
    console.error("[cron] fetch-news failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}