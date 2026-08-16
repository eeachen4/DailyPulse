import axios from 'axios';
import { toNumber, toIso, kv } from './utils';
import { redditProxy } from './proxy';
import type { FeedItem } from '../types';
import type { CategoryDef } from '../categories';

// Reddit 会拒绝默认/明显的爬虫 UA，使用浏览器 UA 可显著提升成功率。
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/**
 * Reddit：按类别采集（每个类别对应若干子版块），合并去重后按热度排序。
 * 采集优先级：
 *   1. 官方 OAuth API（配置 REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET 时，CI 友好、免代理）
 *   2. 公共 JSON API 直连（本地 / 家庭 IP；配置 REDDIT_PROXY 时走代理）
 */
export async function fetchReddit(category: CategoryDef): Promise<FeedItem[]> {
  const clientId = process.env.REDDIT_CLIENT_ID || '';
  const clientSecret = process.env.REDDIT_CLIENT_SECRET || '';

  if (clientId && clientSecret) {
    const items = await fetchViaOAuth(category, clientId, clientSecret);
    if (items.length > 0) return items;
    console.warn('[reddit] OAuth 无结果，回退直连');
  }

  const items = await fetchDirect(category);
  if (items.length > 0) return items;
  throw new Error(`Reddit「${category.label}」采集失败（OAuth / 直连均无结果，可能被限流或 IP 被封禁）`);
}

function limitPerCategory(): number {
  return Number(process.env.REDDIT_LIMIT || 30);
}

/* ------------------------------ OAuth ------------------------------ */

async function getOAuthToken(clientId: string, clientSecret: string): Promise<string> {
  const resp = await axios.post(
    'https://www.reddit.com/api/v1/access_token',
    'grant_type=client_credentials',
    {
      auth: { username: clientId, password: clientSecret },
      headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30_000,
    },
  );
  const token = resp.data?.access_token;
  if (!token) throw new Error('Reddit OAuth 获取 access_token 失败');
  return token as string;
}

async function fetchViaOAuth(
  category: CategoryDef,
  clientId: string,
  clientSecret: string,
): Promise<FeedItem[]> {
  const token = await getOAuthToken(clientId, clientSecret);
  const limit = limitPerCategory();
  const subs = category.redditSubreddits;
  const perSub = Math.max(1, Math.ceil(limit / subs.length));

  const results: FeedItem[] = [];
  const seen = new Set<string>();
  for (const sub of subs) {
    try {
      const resp = await axios.get(`https://oauth.reddit.com/r/${sub}/top`, {
        params: { t: 'day', limit: perSub },
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': USER_AGENT },
        timeout: 30_000,
      });
      const children: unknown[] = resp.data?.data?.children ?? [];
      for (const c of children) {
        const data = (c as { data?: Record<string, unknown> })?.data ?? {};
        const item = normalize(data, category.label, sub);
        if (item && !seen.has(item.id)) {
          seen.add(item.id);
          results.push(item);
        }
      }
    } catch {
      // 继续下一个子版块
    }
  }
  return results
    .sort((a, b) => (b.score ?? Number.NEGATIVE_INFINITY) - (a.score ?? Number.NEGATIVE_INFINITY))
    .slice(0, limit);
}

/* ------------------------------ 直连（可走代理） ------------------------------ */

async function fetchDirect(category: CategoryDef): Promise<FeedItem[]> {
  const limit = limitPerCategory();
  const subs = category.redditSubreddits;
  const perSub = Math.max(1, Math.ceil(limit / subs.length));

  const results: FeedItem[] = [];
  const seen = new Set<string>();
  const endpoints = (sub: string) => [
    `https://www.reddit.com/r/${sub}/top.json?t=day&limit=${perSub}&raw_json=1`,
    `https://old.reddit.com/r/${sub}/top.json?t=day&limit=${perSub}&raw_json=1`,
  ];

  for (const sub of subs) {
    for (const url of endpoints(sub)) {
      try {
        const resp = await axios.get(url, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
          timeout: 30_000,
          proxy: redditProxy(),
        });
        const children: unknown[] = resp.data?.data?.children ?? [];
        if (children.length === 0) continue;
        for (const c of children) {
          const data = (c as { data?: Record<string, unknown> })?.data ?? {};
          const item = normalize(data, category.label, sub);
          if (item && !seen.has(item.id)) {
            seen.add(item.id);
            results.push(item);
          }
        }
        break; // 该子版块成功，跳到下一个
      } catch {
        // 尝试下一个端点
      }
    }
  }
  return results
    .sort((a, b) => (b.score ?? Number.NEGATIVE_INFINITY) - (a.score ?? Number.NEGATIVE_INFINITY))
    .slice(0, limit);
}

/* ------------------------------ 归一化 ------------------------------ */

function normalize(d: Record<string, unknown>, categoryLabel: string, sub: string): FeedItem | null {
  const title = typeof d.title === 'string' ? d.title : '';
  if (!title) return null;

  const permalink = typeof d.permalink === 'string' ? d.permalink : '';
  const discussionUrl = permalink
    ? `https://www.reddit.com${permalink}`
    : String(d.url ?? 'https://www.reddit.com/');

  const thumbnail = typeof d.thumbnail === 'string' && d.thumbnail.startsWith('http') ? d.thumbnail : undefined;
  const author = typeof d.author === 'string' ? d.author : undefined;
  const selftext = typeof d.selftext === 'string' ? d.selftext : '';

  // 外部目标链接：帖子指向的原文（非 reddit.com 时）
  let externalUrl: string | undefined;
  const rawUrl = typeof d.url === 'string' ? d.url : '';
  if (/^https?:\/\//.test(rawUrl)) {
    try {
      const host = new URL(rawUrl).hostname.replace(/^www\./, '');
      if (!host.endsWith('reddit.com') && rawUrl !== discussionUrl) externalUrl = rawUrl;
    } catch {
      /* 忽略非法 URL */
    }
  }

  const stats = [
    kv('域名', typeof d.domain === 'string' ? d.domain : undefined),
  ].filter((x): x is { label: string; value: string } => x !== null);

  return {
    id: `reddit-${String(d.id ?? d.name ?? `${sub}-${title}`)}`,
    title,
    description: selftext.trim() !== '' ? selftext.slice(0, 200) : undefined,
    longDescription: selftext.trim() !== '' ? selftext : undefined,
    externalUrl,
    url: discussionUrl,
    source: 'reddit',
    category: categoryLabel,
    score: toNumber(d.ups ?? d.score),
    comments: toNumber(d.num_comments ?? d.comments),
    developer: author,
    thumbnail,
    publishedAt: toIso(typeof d.created_utc === 'number' ? d.created_utc * 1000 : d.created_utc),
    tags: [`r/${sub}`],
    stats: stats.length ? stats : undefined,
  };
}
