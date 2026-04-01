export interface NewsArticle {
    id: string,
    title: string;
    description: string;
    url: string;
    author: string;
    image: string | null;
    language: string;
    category: string[];
    published: string;
}

export type NewsData = Record<string, NewsArticle[]>;