function tokenize(text: string): Set<string> {
    return new Set(
        text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean)
    );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    const intersection = new Set([...a].filter((x) => b.has(x)));
    const union = new Set([...a, ...b]);
    return union.size === 0 ? 0 : intersection.size / union.size;
}

const THRESHOLD = 0.6;

export function deduplicateArticles<T extends { title: string }>(
    incoming: T[],
    existing: { title: string }[]
): T[] {
    const existingTokens = existing.map((a) => tokenize(a.title));

    return incoming.filter((article) => {
        const tokens = tokenize(article.title);
        return !existingTokens.some(
            (et) => jaccardSimilarity(tokens, et) >= THRESHOLD
        );
    });
}