"use client";

import { useState } from "react";

interface ScrapedArticle {
    id: string;
    title: string;
    url: string;
    gemini_score: number;
    published: string;
    full_content: string | null;
    success: boolean;
}

export default function TestScrapePage() {
    const [articles, setArticles] = useState<ScrapedArticle[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

    async function handleScrape() {
        setLoading(true);
        setError(null);
        setArticles([]);

        try {
            const res = await fetch("/api/testScrape");
            const data = await res.json();

            if (!res.ok) throw new Error(data.error);

            setArticles(data.articles);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
            <div className="max-w-4xl mx-auto">

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-white mb-1">Scraper Test</h1>
                    <p className="text-gray-400 text-sm">
                        Fetches top 5 unposted articles by score and scrapes their full content.
                    </p>
                </div>

                {/* Button */}
                <button
                    onClick={handleScrape}
                    disabled={loading}
                    className="mb-8 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
                >
                    {loading ? "Scraping..." : "Scrape Top 5 Articles"}
                </button>

                {/* Error */}
                {error && (
                    <div className="mb-6 p-4 bg-red-950 border border-red-800 rounded-lg text-red-300 text-sm">
                        {error}
                    </div>
                )}

                {/* No results */}
                {!loading && articles.length === 0 && !error && (
                    <p className="text-gray-500 text-sm">No articles scraped yet. Click the button above.</p>
                )}

                {/* Results */}
                <div className="space-y-4">
                    {articles.map((article, index) => (
                        <div
                            key={article.id}
                            className="border border-gray-800 rounded-lg overflow-hidden"
                        >
                            {/* Article header */}
                            <div className="p-4 bg-gray-900">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <span className="text-gray-500 text-sm font-mono mt-0.5">
                                            #{index + 1}
                                        </span>
                                        <div>
                                            <h2 className="text-white font-medium text-sm leading-snug mb-1">
                                                {article.title}
                                            </h2>
                                            <div className="flex items-center gap-3 text-xs text-gray-500">
                                                <span>
                                                    Score:{" "}
                                                    <span className="text-blue-400 font-medium">
                                                        {article.gemini_score}
                                                    </span>
                                                </span>
                                                <span>
                                                    {new Date(article.published).toLocaleString("en-PH", {
                                                        timeZone: "Asia/Manila",
                                                    })}
                                                </span>
                                                <a
                                                    href={article.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-500 hover:text-blue-400 underline"
                                                >
                                                    Source ↗
                                                </a>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status badge */}
                                    <span
                                        className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${article.success
                                            ? "bg-green-950 text-green-400 border border-green-800"
                                            : "bg-red-950 text-red-400 border border-red-800"
                                            }`}
                                    >
                                        {article.success ? "Scraped" : "Failed"}
                                    </span>
                                </div>
                            </div>

                            {article.success && article.full_content && (
                                <div className="border-t border-gray-800">
                                    <button
                                        onClick={() =>
                                            setExpanded(expanded === article.id ? null : article.id)
                                        }
                                        className="w-full px-4 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors text-left"
                                    >
                                        {expanded === article.id ? "▲ Hide content" : "▼ Show full content"}
                                    </button>

                                    {expanded === article.id && (
                                        <div className="px-4 py-4 bg-gray-950 border-t border-gray-800">
                                            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                                                {article.full_content}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {!article.success && (
                                <div className="border-t border-gray-800 px-4 py-3 bg-gray-950">
                                    <p className="text-red-400 text-xs">
                                        Could not extract content from this URL. The site may be blocking scrapers.
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}