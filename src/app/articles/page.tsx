"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Article {
    id: string;
    title: string;
    url: string;
    image: string | null;
    gemini_score: number;
    published: string;
    full_content: string | null;
    tagalog_headline: string | null;
    tagalog_summary: string | null;
    is_posted: boolean;
}

export default function ArticlesPage() {
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [posting, setPosting] = useState<string | null>(null);
    const [filter, setFilter] = useState<"all" | "unposted" | "posted">("unposted");

    useEffect(() => {
        fetchArticles();
    }, []);

    async function fetchArticles() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/articles");
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setArticles(data.articles || []);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }

    async function handlePostArticle(articleId: string) {
        setPosting(articleId);
        try {
            const res = await fetch("/api/post", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ articleId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            // Update article in state to mark as posted
            setArticles((prev) =>
                prev.map((a) =>
                    a.id === articleId ? { ...a, is_posted: true } : a
                )
            );
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setPosting(null);
        }
    }

    const filteredArticles = articles.filter((article) => {
        if (filter === "unposted") return !article.is_posted;
        if (filter === "posted") return article.is_posted;
        return true;
    });

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">All Articles</h1>
                        <p className="text-gray-400 text-sm">
                            Browse all scraped articles with Tagalog content
                        </p>
                    </div>
                    <Link
                        href="/scrape"
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        Scrape New
                    </Link>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-950 border border-red-800 rounded-lg text-red-300 text-sm">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-12">
                        <p className="text-gray-400">Loading articles...</p>
                    </div>
                ) : (
                    <>
                        <div className="mb-6 flex gap-2">
                            {(["all", "unposted", "posted"] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f
                                            ? "bg-blue-600 text-white"
                                            : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                                        }`}
                                >
                                    {f === "all"
                                        ? "All"
                                        : f === "unposted"
                                            ? `Unposted (${articles.filter((a) => !a.is_posted).length})`
                                            : `Posted (${articles.filter((a) => a.is_posted).length})`}
                                </button>
                            ))}
                        </div>

                        {filteredArticles.length === 0 ? (
                            <p className="text-gray-500 text-sm">
                                {filter === "unposted" && "No unposted articles. "}
                                {filter === "posted" && "No posted articles yet. "}
                                {articles.length === 0 && 'No articles yet. Click "Scrape New" to get started.'}
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {filteredArticles.map((article) => (
                                    <div
                                        key={article.id}
                                        className="border border-gray-800 rounded-lg overflow-hidden hover:border-gray-700 transition-colors"
                                    >
                                        {/* Header */}
                                        <div className="p-4 bg-gray-900">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-start gap-3 flex-1">
                                                    {article.image && (
                                                        <img
                                                            src={article.image}
                                                            alt={article.title}
                                                            className="w-16 h-16 rounded object-cover flex-shrink-0"
                                                        />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <h2 className="text-white font-medium text-sm leading-snug mb-2">
                                                            {article.title}
                                                        </h2>
                                                        <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
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

                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    {!article.is_posted && (
                                                        <button
                                                            onClick={() => handlePostArticle(article.id)}
                                                            disabled={posting === article.id}
                                                            className="shrink-0 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-colors"
                                                        >
                                                            {posting === article.id ? "Posting..." : "Post"}
                                                        </button>
                                                    )}
                                                    <span
                                                        className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${article.is_posted
                                                                ? "bg-purple-950 text-purple-400 border border-purple-800"
                                                                : "bg-green-950 text-green-400 border border-green-800"
                                                            }`}
                                                    >
                                                        {article.is_posted ? "Posted" : "Unposted"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tagalog content */}
                                        {(article.tagalog_headline || article.tagalog_summary) && (
                                            <div className="border-t border-gray-800 px-4 py-3 bg-gray-900/50 space-y-1">
                                                {article.tagalog_headline && (
                                                    <p className="text-yellow-300 text-sm font-medium">
                                                        {article.tagalog_headline}
                                                    </p>
                                                )}
                                                {article.tagalog_summary && (
                                                    <p className="text-gray-300 text-xs leading-relaxed">
                                                        {article.tagalog_summary}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Full content toggle */}
                                        {article.full_content && (
                                            <div className="border-t border-gray-800">
                                                <button
                                                    onClick={() =>
                                                        setExpanded(expanded === article.id ? null : article.id)
                                                    }
                                                    className="w-full px-4 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors text-left"
                                                >
                                                    {expanded === article.id
                                                        ? "▲ Hide full content"
                                                        : "▼ Show full content"}
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
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
