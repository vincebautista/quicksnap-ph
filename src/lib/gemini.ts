import { supabase } from "@/lib/supabase";
import { NewsArticle } from "@/types/news";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${GEMINI_API_KEY}`;

interface GeminiScore {
    id: string;
    score: number;
}

function buildPrompt(articles: Pick<NewsArticle, "id" | "title" | "description" | "published">[]): string {
    return `You are a news ranking system for a Philippine audience.
Your job is to evaluate and rank news articles.
Score each article from 1 to 10 based on:
1. Relevance to the Philippines (VERY IMPORTANT)
2. Importance (impact on people, economy, politics, safety)
3. Recency (how recent the news is)
4. Engagement potential (likelihood people will click/read/share)
Rules:
- Prioritize news directly involving the Philippines
- Global news is allowed ONLY if highly impactful
- Ignore low-value or generic content
- Penalize vague or unclear articles
Return STRICT JSON only.
Format:
[
  {
    "id": "string",
    "score": number,
    "reason": "short explanation"
  }
]
Articles:
${JSON.stringify(articles, null, 2)}`;
}

function parseGeminiResponse(text: string): GeminiScore[] {
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
}

async function scoreArticles(
    articles: Pick<NewsArticle, "id" | "title" | "description" | "published">[]
): Promise<GeminiScore[]> {
    if (articles.length === 0) return [];

    const response = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [
                {
                    parts: [{ text: buildPrompt(articles) }],
                },
            ],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 2048,
            },
        }),
    });

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) throw new Error("Gemini returned empty response");

    return parseGeminiResponse(text);
}

const BATCH_SIZE = 10;

export async function scoreUnscored(): Promise<number> {
    const { data: unscored, error: fetchError } = await supabase
        .from("news_articles")
        .select("id, title, description, published")
        .is("gemini_score", null);

    if (fetchError) throw new Error(`Fetch failed: ${fetchError.message}`);
    if (!unscored || unscored.length === 0) return 0;

    // Split into chunks of 10
    const batches = [];
    for (let i = 0; i < unscored.length; i += BATCH_SIZE) {
        batches.push(unscored.slice(i, i + BATCH_SIZE));
    }

    let totalScored = 0;

    for (const batch of batches) {
        try {
            const scores = await scoreArticles(batch);

            await Promise.all(
                scores.map(({ id, score }) =>
                    supabase
                        .from("news_articles")
                        .update({ gemini_score: score })
                        .eq("id", id)
                )
            );

            totalScored += scores.length;
        } catch (error) {
            console.error(`[gemini] batch failed:`, error);
        }
    }

    return totalScored;
}