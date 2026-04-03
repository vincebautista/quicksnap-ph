function cleanContent(text: string): string {
    return text
        .split("\n")
        .map(line => line.trim())
        .filter(line => {
            if (line.length === 0) return false
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

        const { JSDOM } = await import("jsdom");
        const { Readability } = await import("@mozilla/readability");

        const dom = new JSDOM(html, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();

        console.log("[scraper] parsed article:", article?.title ?? "null");

        if (!article?.textContent) return null;

        return cleanContent(article.textContent);
    } catch (error) {
        console.error("[scraper] error for", url, ":", error);
        return null;
    }
}