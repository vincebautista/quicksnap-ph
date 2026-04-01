import { fetchAllNews } from "@/lib/news";
import Image from "next/image";
import { NewsArticle } from "@/types/news";

type NewsData = Record<string, NewsArticle[]>;

export default async function QuickSnapDashboard() {
  const allNews: NewsData = (await fetchAllNews()) ?? {};

  const categories = Object.keys(allNews);

  if (categories.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center text-white">
        No news available.
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white p-6">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold text-orange-500">
          QuickSnap PH
        </h1>
        <p className="text-slate-400">
          Automated Philippine News Feed
        </p>
      </header>

      {/* 🔥 CATEGORY NAV (optional but useful) */}
      <div className="flex flex-wrap gap-2 justify-center mb-10">
        {categories.map((cat) => (
          <span
            key={cat}
            className="px-3 py-1 bg-slate-800 rounded-full text-xs uppercase text-slate-300"
          >
            {cat}
          </span>
        ))}
      </div>

      {/* 🔥 NEWS BY CATEGORY */}
      {categories.map((category) => {
        const newsItems = allNews[category] ?? [];

        return (
          <section key={category} className="mb-12">
            {/* Category Header */}
            <div className="mb-6">
              <h2 className="text-xl font-bold uppercase text-slate-300 border-b border-slate-700 pb-2">
                {category}
              </h2>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {newsItems.map((item) => {
                const imageSrc = item.image || "/fallback.jpg";

                return (
                  <div
                    key={item.id}
                    className="group overflow-hidden rounded-xl bg-slate-800 border border-slate-700 hover:border-orange-500 transition-all"
                  >
                    <div className="aspect-video relative">
                      <Image
                        src={imageSrc}
                        alt={item.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>

                    <div className="p-4">
                      <ul className="text-xs text-slate-400 space-y-1 mt-3">
                        <li><b>ID:</b> {item.id}</li>
                        <li><b>Title:</b> {item.title}</li>
                        <li><b>Description:</b> {item.description}</li>
                        <li><b>URL:</b> {item.url}</li>
                        <li><b>Author:</b> {item.author}</li>
                        <li><b>Image:</b> {item.image}</li>
                        <li><b>Language:</b> {item.language}</li>
                        <li><b>Category:</b> {item.category?.join(", ")}</li>
                        <li><b>Published:</b> {item.published}</li>
                      </ul>

                      <h3 className="font-bold line-clamp-2 mb-2">
                        {item.title}
                      </h3>

                      <p className="text-sm text-slate-400 line-clamp-3 mb-4">
                        {item.description}
                      </p>

                      <div className="flex justify-between text-xs text-slate-500">
                        <span>
                          {new Date(item.published).toLocaleDateString()}
                        </span>

                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-400 hover:text-orange-300"
                        >
                          Read →
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}