import axios from 'axios';
import type { CategoryDef } from '../categories';
import type { FeedItem } from '../types';

const API = 'https://api.gdeltproject.org/api/v2/doc/doc';
let lastRequestAt = 0;

interface GdeltArticle {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
  tone?: string;
  socialimage?: string;
}

function parseDate(value?: string): string | undefined {
  if (!value) return undefined;
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}

function normalize(article: GdeltArticle, category: CategoryDef, query: string, rank: number, limit: number): FeedItem | null {
  if (!article.url || !/^https?:\/\//.test(article.url) || !article.title) return null;
  const rawScore = Math.max(1, limit - rank);
  return {
    id: 'gdelt:' + article.url,
    sourceItemId: article.url,
    title: article.title,
    description: [article.domain, article.language].filter(Boolean).join(' · ') || '全球新闻报道',
    url: article.url,
    source: 'gdelt',
    category: category.label,
    categoryId: category.id,
    categoryIds: [category.id],
    score: rawScore,
    metrics: { rawScore, rawScoreLabel: '媒体热度' },
    thumbnail: article.socialimage,
    publishedAt: parseDate(article.seendate),
    tags: [query, article.domain, article.sourcecountry].filter((value): value is string => Boolean(value)),
    stats: article.tone ? [{ label: '语气', value: article.tone }] : undefined,
  };
}

async function waitForRateLimit(): Promise<void> {
  const waitMs = Math.max(0, 5_500 - (Date.now() - lastRequestAt));
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastRequestAt = Date.now();
}

export async function fetchGdelt(category: CategoryDef): Promise<FeedItem[]> {
  const limit = Math.min(250, Math.max(1, Number(process.env.GDELT_LIMIT || 25)));
  const articles = new Map<string, { article: GdeltArticle; query: string; rank: number }>();
  for (const query of category.gdeltQueries) {
    await waitForRateLimit();
    const response = await axios.get<{ articles?: GdeltArticle[] }>(API, {
      params: {
        query,
        mode: 'artlist',
        maxrecords: limit,
        timespan: '1day',
        sort: 'HybridRel',
        format: 'json',
      },
      timeout: 45_000,
    });
    (response.data?.articles ?? []).forEach((article, index) => {
      if (article.url && !articles.has(article.url)) articles.set(article.url, { article, query, rank: index });
    });
  }

  return [...articles.values()]
    .map(({ article, query, rank }) => normalize(article, category, query, rank, limit))
    .filter((item): item is FeedItem => Boolean(item))
    .slice(0, limit);
}
