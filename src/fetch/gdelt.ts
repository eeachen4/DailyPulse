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
  const configured = Number(process.env.GDELT_MIN_INTERVAL_MS || 12_000);
  const intervalMs = Number.isFinite(configured) ? Math.max(5_500, configured) : 12_000;
  const waitMs = Math.max(0, intervalMs - (Date.now() - lastRequestAt));
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastRequestAt = Date.now();
}

function retryDelay(error: unknown, attempt: number): number {
  if (axios.isAxiosError(error)) {
    const retryAfter = Number(error.response?.headers?.['retry-after']);
    if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1_000;
  }
  return 15_000 * 2 ** attempt;
}

async function requestArticles(query: string, limit: number): Promise<GdeltArticle[]> {
  const configured = Number(process.env.GDELT_RETRIES || 2);
  const retries = Number.isInteger(configured) ? Math.max(0, configured) : 2;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    await waitForRateLimit();
    try {
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
        headers: { Accept: 'application/json', 'User-Agent': 'DailyPulse/1.0' },
      });
      return response.data?.articles ?? [];
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const retryable = status === 429 || (status !== undefined && status >= 500);
      if (!retryable || attempt === retries) throw error;
      const delay = retryDelay(error, attempt);
      console.warn(`[gdelt] 请求受限（${status}），${delay}ms 后重试（${attempt + 1}/${retries}）`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return [];
}

export async function fetchGdelt(category: CategoryDef): Promise<FeedItem[]> {
  const limit = Math.min(250, Math.max(1, Number(process.env.GDELT_LIMIT || 25)));
  const articles = new Map<string, { article: GdeltArticle; query: string; rank: number }>();
  for (const query of category.gdeltQueries) {
    (await requestArticles(query, limit)).forEach((article, index) => {
      if (article.url && !articles.has(article.url)) articles.set(article.url, { article, query, rank: index });
    });
  }

  return [...articles.values()]
    .map(({ article, query, rank }) => normalize(article, category, query, rank, limit))
    .filter((item): item is FeedItem => Boolean(item))
    .slice(0, limit);
}
