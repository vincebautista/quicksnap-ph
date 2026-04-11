import { Readability } from "@mozilla/readability";
import { Window } from "happy-dom";

function cleanContent(text: string): string {
    return text
        .split("\n")
        .map(line => line.trim())
        .filter(line => {
            if (line.length === 0) return false;
            if (line === "WWW") return false;
            if (line.includes("Your subscription")) return false;
            if (line.includes("Article continues after")) return false;
            if (line.includes("FEATURED STORIES")) return false;
            if (line.includes("Advertisement")) return false;
            return true;
        })
        .join("\n");
}

export async function scrapeFullContentCron(url: string): Promise<string | null> {
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
            signal: AbortSignal.timeout(6000),
        });

        if (!response.ok) return null;
        const html = await response.text();

        const window = new Window({ url });
        window.document.write(html);
        await window.happyDOM.waitUntilComplete();

        const reader = new Readability(window.document as unknown as Document);
        const article = reader.parse();

        window.happyDOM.abort();

        if (!article?.textContent) return null;

        return cleanContent(article.textContent);
    } catch (error) {
        console.error("[scraper-cron] error:", error);
        return null;
    }
}