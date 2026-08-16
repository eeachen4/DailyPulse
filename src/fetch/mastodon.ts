import axios from 'axios';
import type { CategoryDef } from '../categories';
import type { FeedItem } from '../types';

interface MastodonStatus {
  id?: string;
  url?: string;
  created_at?: string;
  content?: string;
  account?: { acct?: string; display_name?: string; url?: string };
  favourites_count?: number;
  reblogs_count?: number;
  replies_count?: number;
  tags?: Array<{ name?: string }>;
  media_attachments?: Array<{ preview_url?: string; url?: string }>;
}

function instanceUrl(): string {
  return (process.env.MASTODON_INSTANCE || 'mastodon.social').replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function stripHtml(value?: string): string {
  return (value ?? '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(status: MastodonStatus, category: CategoryDef, tag: string): FeedItem | null {
  if (!status.id || !status.content) return null;
  const instance = instanceUrl();
  const sourceItemId = instance + '/' + status.id;
  const text = stripHtml(status.content);
  if (!text) return null;
  const rawScore =
    (status.favourites_count ?? 0) +
    (status.reblogs_count ?? 0) * 2 +
    (status.replies_count ?? 0) * 1.5;
  const account = status.account?.acct ?? 'unknown';
  return {
    id: 'mastodon:' + sourceItemId,
    sourceItemId,
    title: text.slice(0, 140),
    description: `@${account} · ${text}`,
    longDescription: text,
    url: status.url ?? `https://${instance}/@${account}/${status.id}`,
    source: 'mastodon',
    category: category.label,
    categoryId: category.id,
    categoryIds: [category.id],
    score: rawScore,
    metrics: {
      rawScore,
      rawScoreLabel: '互动热度',
      votes: (status.favourites_count ?? 0) + (status.reblogs_count ?? 0),
      comments: status.replies_count,
    },
    comments: status.replies_count,
    developer: '@' + account,
    thumbnail: status.media_attachments?.[0]?.preview_url ?? status.media_attachments?.[0]?.url,
    publishedAt: status.created_at,
    tags: [tag, ...(status.tags ?? []).map((item) => item.name).filter((item): item is string => Boolean(item))],
    stats: [
      { label: '收藏', value: String(status.favourites_count ?? 0) },
      { label: '转发', value: String(status.reblogs_count ?? 0) },
    ],
  };
}

export async function fetchMastodon(category: CategoryDef): Promise<FeedItem[]> {
  const limit = Math.min(40, Math.max(1, Number(process.env.MASTODON_LIMIT || 25)));
  const base = `https://${instanceUrl()}/api/v1/timelines/tag/`;
  const statuses = new Map<string, { status: MastodonStatus; tag: string }>();
  for (const tag of category.mastodonTags) {
    const response = await axios.get<MastodonStatus[]>(base + encodeURIComponent(tag), {
      params: { limit, local: false },
      timeout: 30_000,
      headers: { Accept: 'application/json' },
    });
    for (const status of response.data ?? []) {
      if (status.id && !statuses.has(status.id)) statuses.set(status.id, { status, tag });
    }
  }

  return [...statuses.values()]
    .map(({ status, tag }) => normalize(status, category, tag))
    .filter((item): item is FeedItem => Boolean(item))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}
