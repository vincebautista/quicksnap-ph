function tokenize(text: string): Set<string> {
    return new Set(
        text.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 0 && !STOP_WORDS.has(w))
    )
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    const intersection = new Set([...a].filter((x) => b.has(x)))
    const union = new Set([...a, ...b])
    return union.size === 0 ? 0 : intersection.size / union.size
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'in', 'on', 'at', 'to', 'of', 'and', 'or', 'is', 'are',
  'for', 'was', 'were', 'has', 'have', 'had', 'it', 'its', 'be', 'been',
  'that', 'this', 'with', 'as', 'by', 'from', 'but', 'not', 'also', 'will',
  'he', 'she', 'they', 'his', 'her', 'their', 'said', 'says', 'philippines', 'philippine', 'manila', 'ph', 'phl',
  'president', 'government', 'official', 'officials',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
])

const THRESHOLD = 0.6

export function deduplicateArticles<T extends { description: string }>(
    incoming: T[],
    existing: { description: string }[]
): T[] {
    const existingTokens = existing.map((a) => tokenize(a.description))

    return incoming.filter((article) => {
        const tokens = tokenize(article.description)
        return !existingTokens.some(
            (et) => jaccardSimilarity(tokens, et) >= THRESHOLD
        )
    })
}