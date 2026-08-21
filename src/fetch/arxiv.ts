import axios from 'axios';
import { load } from 'cheerio';
import type { CategoryDef } from '../categories';
import type { FeedItem } from '../types';

const API = 'https://arxiv.org/api/query';
let lastRequestAt = 0;

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function searchQuery(queries: string[]): string {
  return queries.map((query) => (query.startsWith('cat:') || query.startsWith('all:') ? query : `all:"${query}"`)).join(' OR ');
}

interface ArxivEntry {
  id: string;
  url: string;
  title: string;
  summary?: string;
  publishedAt?: string;
  authors: string[];
  categories: string[];
}

function extractArxivId(value: string): string | undefined {
  const normalized = clean(value);
  if (!normalized) return undefined;

  const oaiMatch = normalized.match(/^oai:arxiv\.org:(.+)$/i);
  if (oaiMatch?.[1]) return oaiMatch[1].replace(/\.pdf$/i, '');

  const urlMatch = normalized.match(/arxiv\.org\/(?:abs|pdf)\/([^?#]+)/i);
  if (urlMatch?.[1]) return urlMatch[1].replace(/\.pdf$/i, '');

  return normalized.includes('/') || /^\d{4}\.\d{4,5}(?:v\d+)?$/i.test(normalized) ? normalized : undefined;
}

function canonicalArxivUrl(value: string, id: string): string {
  const extractedId = extractArxivId(value) ?? id;
  return `https://arxiv.org/abs/${extractedId}`;
}

async function waitForRateLimit(): Promise<void> {
  const waitMs = Math.max(0, 3_500 - (Date.now() - lastRequestAt));
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastRequestAt = Date.now();
}

async function request(query: string, limit: number): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await waitForRateLimit();
    try {
      const response = await axios.get<string>(API, {
        params: { search_query: query, start: 0, max_results: limit, sortBy: 'submittedDate', sortOrder: 'descending' },
        timeout: 45_000,
        headers: { Accept: 'application/atom+xml', 'User-Agent': 'DailyPulse/1.0 (mailto:dailypulse@example.com)' },
        responseType: 'text',
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429 && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        continue;
      }
      throw error;
    }
  }
  throw new Error('arXiv 请求失败');
}

async function requestCategoryFeed(category: string): Promise<string> {
  const response = await axios.get<string>(`https://arxiv.org/rss/${encodeURIComponent(category)}`, {
    timeout: 30_000,
    responseType: 'text',
    headers: { Accept: 'application/rss+xml, application/xml', 'User-Agent': 'DailyPulse/1.0 (mailto:dailypulse@example.com)' },
  });
  return response.data;
}

function parseEntries(xml: string, limit: number): ArxivEntry[] {
  const $ = load(xml, { xmlMode: true });
  const entries: ArxivEntry[] = [];
  const nodes = $('entry').length ? $('entry') : $('item');
  nodes.each((index, element) => {
    if (index >= limit) return;
    const node = $(element);
    const linkNode = node.find('link').first();
    const link = clean(linkNode.text()) || clean(linkNode.attr('href') || '');
    const rawId = clean(node.find('id').first().text()) || link || clean(node.find('guid').first().text());
    const id = extractArxivId(rawId);
    const title = clean(node.find('title').first().text());
    const summary = clean(node.find('summary, description').first().text());
    const publishedAt = clean(node.find('published, pubDate, dc\\:date').first().text()) || undefined;
    const authors = node.find('author name, dc\\:creator').map((_, author) => clean($(author).text())).get().filter(Boolean);
    const categories = node.find('category').map((_, categoryNode) => $(categoryNode).attr('term') || clean($(categoryNode).text())).get().filter(Boolean);
    if (id && title) entries.push({ id, url: canonicalArxivUrl(link || rawId, id), title, summary, publishedAt, authors, categories });
  });
  return entries;
}

export async function fetchArxiv(category: CategoryDef): Promise<FeedItem[]> {
  const limit = Math.min(100, Math.max(1, Number(process.env.ARXIV_LIMIT || 25)));
  const categoryFeeds = category.arxivQueries
    .filter((query) => query.startsWith('cat:'))
    .map((query) => query.slice(4));
  const entries = new Map<string, ArxivEntry>();
  if (categoryFeeds.length > 0) {
    for (const feedCategory of categoryFeeds) {
      try {
        for (const entry of parseEntries(await requestCategoryFeed(feedCategory), limit)) {
          if (!entries.has(entry.id)) entries.set(entry.id, entry);
        }
      } catch (error) {
        if (process.env.DEBUG) console.warn(`[arxiv] 分类 ${feedCategory} 失败：${error instanceof Error ? error.message : error}`);
      }
    }
  } else {
    for (const entry of parseEntries(await request(searchQuery(category.arxivQueries), limit), limit)) entries.set(entry.id, entry);
  }

  const items: FeedItem[] = [];
  [...entries.values()].slice(0, limit).forEach((entry, index) => {
    const rawScore = Math.max(1, limit - index);
    items.push({
      id: 'arxiv:' + entry.id,
      sourceItemId: entry.id,
      title: entry.title,
      description: entry.summary,
      longDescription: entry.summary,
      url: entry.url,
      source: 'arxiv',
      category: category.label,
      categoryId: category.id,
      categoryIds: [category.id],
      score: rawScore,
      metrics: { rawScore, rawScoreLabel: '论文新鲜度' },
      developer: entry.authors[0],
      publishedAt: entry.publishedAt,
      tags: [...category.arxivQueries, ...entry.categories].filter(Boolean),
      stats: [
        { label: '作者', value: String(entry.authors.length) },
        { label: '分类', value: entry.categories.join(', ') },
        entry.authors.length ? { label: '第一作者', value: entry.authors[0] } : undefined,
      ].filter((value): value is { label: string; value: string } => Boolean(value?.value)),
    });
  });
  return items;
}
