import { parse } from "node-html-parser";

function cleanContent(text: string): string {
    return text
        .split("\n")
        .map(line => line.trim())
        .filter(line => {
            if (line.length < 20) return false 
            if (line === "WWW") return false
            if (line.includes("Your subscription")) return false
            if (line.includes("Article continues after")) return false
            if (line.includes("FEATURED STORIES")) return false
            if (line.includes("Advertisement")) return false
            return true
        })
        .join("\n")
}

export async function scrapeFullContent(url: string): Promise<string | null> {
    try {
        console.log("[scraper] fetching:", url);

        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
            signal: AbortSignal.timeout(10000),
        });

        console.log("[scraper] response status:", response.status);
        if (!response.ok) return null;

        const html = await response.text();
        console.log("[scraper] html length:", html.length);

        const root = parse(html);

        // Remove noise elements
        root.querySelectorAll("script, style, nav, header, footer, aside, iframe, noscript, [class*='ad'], [class*='social'], [class*='related'], [class*='recommend']")
            .forEach(el => el.remove());

        // Try common article content selectors
        const selectors = [
            "article",
            "[class*='article-body']",
            "[class*='article-content']",
            "[class*='story-body']",
            "[class*='story-content']",
            "[class*='entry-content']",
            "[class*='post-content']",
            ".content",
            "main",
        ];

        let content: string | null = null;

        for (const selector of selectors) {
            const el = root.querySelector(selector);
            if (el) {
                const text = el.text;
                if (text && text.length > 200) {
                    content = text;
                    break;
                }
            }
        }

        // Fallback to body if nothing matched
        if (!content) {
            const body = root.querySelector("body");
            content = body?.text ?? null;
        }

        if (!content) return null;

        const cleaned = cleanContent(content);
        console.log("[scraper] cleaned content length:", cleaned.length);

        return cleaned.length > 100 ? cleaned : null;
    } catch (error) {
        console.error("[scraper] error for", url, ":", error);
        return null;
    }
}