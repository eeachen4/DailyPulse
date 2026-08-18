import axios from 'axios';
import { load } from 'cheerio';
import type { CategoryDef } from '../categories';
import type { FeedItem } from '../types';

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function textFrom(node: ReturnType<ReturnType<typeof load>>): string {
  return clean(node.text());
}

function parseDate(value?: string): string | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString();
}

function scoreFor(publishedAt?: string): number {
  if (!publishedAt) return 1;
  const ageHours = Math.max(0, (Date.now() - Date.parse(publishedAt)) / 3_600_000);
  return Math.max(1, Math.round(10_000 / (ageHours + 2)));
}

async function fetchFeed(url: string): Promise<Array<{ title: string; link: string; description?: string; publishedAt?: string }>> {
  const response = await axios.get<string>(url, {
    timeout: 30_000,
    responseType: 'text',
    headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml', 'User-Agent': 'DailyPulse/1.0' },
  });
  const $ = load(response.data, { xmlMode: true });
  const entries: Array<{ title: string; link: string; description?: string; publishedAt?: string }> = [];
  $('item, entry').each((_, element) => {
    const node = $(element);
    const title = textFrom(node.find('title').first());
    const linkNode = node.find('link').first();
    const link = linkNode.attr('href')?.trim() || textFrom(linkNode);
    const description = textFrom(node.find('description, summary, content\\:encoded, content').first());
    const publishedAt = textFrom(node.find('pubDate, published, updated, dc\\:date').first());
    if (title && /^https?:\/\//.test(link)) entries.push({ title, link, description, publishedAt: parseDate(publishedAt) });
  });
  return entries;
}

export async function fetchRss(category: CategoryDef): Promise<FeedItem[]> {
  const limit = Math.min(100, Math.max(1, Number(process.env.RSS_LIMIT || 25)));
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const entries = new Map<string, { entry: { title: string; link: string; description?: string; publishedAt?: string }; feed: string }>();
  for (const feed of category.rssFeeds) {
    try {
      for (const entry of await fetchFeed(feed)) {
        if (entry.publishedAt && Date.parse(entry.publishedAt) < cutoff) continue;
        if (!entries.has(entry.link)) entries.set(entry.link, { entry, feed });
      }
    } catch (error) {
      if (process.env.DEBUG) console.warn(`[rss] ${feed} 失败：${error instanceof Error ? error.message : error}`);
    }
  }

  return [...entries.values()]
    .map(({ entry, feed }) => {
      const rawScore = scoreFor(entry.publishedAt);
      const host = new URL(feed).hostname;
      return {
        id: 'rss:' + entry.link,
        sourceItemId: entry.link,
        title: entry.title,
        description: entry.description || `来自 ${host} 的官方更新`,
        longDescription: entry.description,
        url: entry.link,
        source: 'rss' as const,
        category: category.label,
        categoryId: category.id,
        categoryIds: [category.id],
        score: rawScore,
        metrics: { rawScore, rawScoreLabel: '新鲜度' },
        publishedAt: entry.publishedAt,
        tags: [host, 'official'],
        stats: [{ label: '来源', value: host }],
      } satisfies FeedItem;
    })
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    .slice(0, limit);
}
