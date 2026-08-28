import axios from 'axios';
import { toNumber, toIso, kv } from './utils';
import { redditProxy } from './proxy';
import type { FeedItem } from '../types';
import type { CategoryDef } from '../categories';

// Reddit 会拒绝默认/明显的爬虫 UA，使用浏览器 UA 可显著提升成功率。
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
let directUnavailableUntil = 0;

/**
 * Reddit：按类别采集（每个类别对应若干子版块），合并去重后按热度排序。
 * 采集优先级：
 *   1. 官方 OAuth API（配置 REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET 时，CI 友好、免代理）
 *   2. 公共 JSON API 直连（本地 / 家庭 IP；配置 REDDIT_PROXY 时走代理）
 *   3. Arctic Shift 公共归档（无需认证，仅作 CI 出口被 Reddit 拒绝时的近期帖子降级）
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
  directUnavailableUntil = Date.now() + 15 * 60 * 1_000;
  console.warn(`[reddit] ${category.label} OAuth / 直连无结果，改用 Arctic Shift 近期公开归档`);
  const archived = await fetchViaArchive(category);
  if (archived.length > 0) return archived;
  throw new Error(`Reddit「${category.label}」采集失败（OAuth / 直连 / Arctic Shift 均无结果）`);
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
  if (process.env.REDDIT_DISABLE_DIRECT === 'true') return [];
  if (Date.now() < directUnavailableUntil) return [];
  const limit = limitPerCategory();
  const subs = category.redditSubreddits;
  const perSub = Math.max(1, Math.ceil(limit / subs.length));

  const results: FeedItem[] = [];
  const seen = new Set<string>();
  const endpoints = (sub: string) => [
    `https://www.reddit.com/r/${sub}/top.json?t=day&limit=${perSub}&raw_json=1`,
    `https://old.reddit.com/r/${sub}/top.json?t=day&limit=${perSub}&raw_json=1`,
  ];

  for (const [subIndex, sub] of subs.entries()) {
    const beforeSub = results.length;
    for (const url of endpoints(sub)) {
      try {
        const resp = await axios.get(url, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
          timeout: Number(process.env.REDDIT_DIRECT_TIMEOUT_MS || 10_000),
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
    // 首个已知活跃子版块在两个主机都无结果时，通常是出口被封；尽快切换归档，避免逐个超时。
    if (subIndex === 0 && results.length === beforeSub) return [];
  }
  return results
    .sort((a, b) => (b.score ?? Number.NEGATIVE_INFINITY) - (a.score ?? Number.NEGATIVE_INFINITY))
    .slice(0, limit);
}

/* ------------------------------ Arctic Shift 降级 ------------------------------ */

async function fetchViaArchive(category: CategoryDef): Promise<FeedItem[]> {
  const limit = limitPerCategory();
  const perSub = Math.max(3, Math.ceil(limit / category.redditSubreddits.length));
  const api = process.env.REDDIT_ARCHIVE_API_URL || 'https://arctic-shift.photon-reddit.com/api/posts/search';
  const after = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
  const results: FeedItem[] = [];
  const seen = new Set<string>();
  for (const sub of category.redditSubreddits) {
    try {
      const response = await axios.get<{ data?: Array<Record<string, unknown>> }>(api, {
        params: { subreddit: sub, after, sort: 'desc', limit: Math.min(100, perSub * 2) },
        timeout: 25_000,
        headers: { Accept: 'application/json', 'User-Agent': 'DailyPulse/1.0' },
      });
      for (const data of response.data?.data ?? []) {
        const item = normalize(data, category.label, sub);
        if (item && !seen.has(item.id)) {
          seen.add(item.id);
          results.push({
            ...item,
            tags: [...(item.tags ?? []), 'Arctic Shift fallback'],
            stats: [...(item.stats ?? []), { label: '采集', value: '公开归档降级' }],
          });
        }
      }
    } catch {
      // 单个子版块归档失败不影响其它子版块。
    }
  }
  return results
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0) || (right.publishedAt ?? '').localeCompare(left.publishedAt ?? ''))
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
    id: 'reddit:' + String(d.id ?? d.name ?? (sub + '-' + title)),
    sourceItemId: String(d.id ?? d.name ?? (sub + '-' + title)),
    title,
    description: selftext.trim() !== '' ? selftext.slice(0, 200) : undefined,
    longDescription: selftext.trim() !== '' ? selftext : undefined,
    externalUrl,
    url: discussionUrl,
    source: 'reddit',
    category: categoryLabel,
    categoryId: categoryLabel,
    categoryIds: [categoryLabel],
    score: toNumber(d.ups ?? d.score),
    metrics: {
      rawScore: toNumber(d.ups ?? d.score),
      rawScoreLabel: '点赞',
      votes: toNumber(d.ups ?? d.score),
      comments: toNumber(d.num_comments ?? d.comments),
    },
    comments: toNumber(d.num_comments ?? d.comments),
    developer: author,
    thumbnail,
    publishedAt: toIso(typeof d.created_utc === 'number' ? d.created_utc * 1000 : d.created_utc),
    tags: [`r/${sub}`],
    stats: stats.length ? stats : undefined,
  };
}
