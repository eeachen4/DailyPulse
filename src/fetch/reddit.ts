import axios from 'axios';
import { toNumber, toIso } from './utils';
import type { FeedItem } from '../types';
import type { CategoryDef } from '../categories';

// Reddit 会拒绝默认/明显的爬虫 UA，使用浏览器 UA 可显著提升成功率。
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/**
 * Reddit：按类别采集（每个类别对应若干子版块），合并去重后按热度排序。
 * 使用公共 JSON API（无需认证）。
 *
 * 注意：Reddit 对数据中心 / 云主机 IP 可能直接返回 403，属于 Reddit 的访问策略。
 */
export async function fetchReddit(category: CategoryDef): Promise<FeedItem[]> {
  const limit = Number(process.env.REDDIT_LIMIT || 20);
  const subs = category.redditSubreddits;
  const perSub = Math.max(1, Math.ceil(limit / subs.length));

  const results: FeedItem[] = [];
  const seen = new Set<string>();
  let lastError: unknown;

  for (const sub of subs) {
    const url = `https://www.reddit.com/r/${sub}/top.json?t=day&limit=${perSub}&raw_json=1`;
    try {
      const resp = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        timeout: 30_000,
      });
      const children: unknown[] = resp.data?.data?.children ?? [];
      for (let i = 0; i < children.length; i++) {
        const data = (children[i] as { data?: Record<string, unknown> })?.data ?? {};
        const item = normalize(data, category.label, sub);
        if (item && !seen.has(item.id)) {
          seen.add(item.id);
          results.push(item);
        }
      }
    } catch (err) {
      lastError = err;
      // 继续尝试下一个子版块
    }
  }

  if (results.length === 0) {
    const reason = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Reddit「${category.label}」采集失败（可能被限流或 IP 被封禁）：${reason}`);
  }

  return results.sort((a, b) => (b.score ?? Number.NEGATIVE_INFINITY) - (a.score ?? Number.NEGATIVE_INFINITY)).slice(0, limit);
}

function normalize(d: Record<string, unknown>, categoryLabel: string, sub: string): FeedItem | null {
  const title = typeof d.title === 'string' ? d.title : '';
  if (!title) return null;

  const permalink = typeof d.permalink === 'string' ? d.permalink : '';
  const url = permalink ? `https://www.reddit.com${permalink}` : String(d.url ?? 'https://www.reddit.com/');

  const thumbnail = typeof d.thumbnail === 'string' && d.thumbnail.startsWith('http') ? d.thumbnail : undefined;

  return {
    id: `reddit-${String(d.id ?? d.name ?? `${sub}-${title}`)}`,
    title,
    description: typeof d.selftext === 'string' && d.selftext.trim() !== '' ? d.selftext.slice(0, 200) : undefined,
    url,
    source: 'reddit',
    category: categoryLabel,
    score: toNumber(d.ups),
    thumbnail,
    publishedAt: toIso(typeof d.created_utc === 'number' ? d.created_utc * 1000 : d.created_utc),
    tags: [`r/${sub}`],
  };
}
