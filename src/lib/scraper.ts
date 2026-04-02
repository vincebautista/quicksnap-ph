import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

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
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
            signal: AbortSignal.timeout(10000),
        })

        if (!response.ok) return null

        const html = await response.text()
        const dom = new JSDOM(html, { url })
        const reader = new Readability(dom.window.document)
        const article = reader.parse()

        if (!article?.textContent) return null

        return cleanContent(article.textContent)
    } catch {
        return null
    }
}