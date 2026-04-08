// app/api/cron/fetch-news/route.ts
import { NextResponse } from "next/server";
import { saveNewArticles } from "@/lib/articles";
import { NewsArticle } from "@/types/news";

function isInquirerDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "inquirer.net" || hostname.endsWith(".inquirer.net");
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const res = await fetch(
      `https://api.currentsapi.services/v2/latest-news?country=PH&language=en&apiKey=${process.env.CURRENTS_API_KEY}`
    );

    const data = await res.json();

    const articles: NewsArticle[] = (data.news ?? []).filter((a: NewsArticle) => {
      return (
        a.image?.startsWith("http") &&
        a.title?.trim() &&
        a.description?.trim() &&
        a.url?.startsWith("http") &&
        !isInquirerDomain(a.url)
      );
    });

    const saved = await saveNewArticles(articles);

    return NextResponse.json({ success: true, saved });
  } catch (err) {
    console.error("[cron] fetch-news failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}