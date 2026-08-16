import axios from 'axios';
import { toNumber, toIso } from './utils';
import type { FeedItem } from '../types';

// Reddit 会拒绝默认/明显的爬虫 UA，使用浏览器 UA 可显著提升成功率。
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/**
 * Reddit：r/all 每日热门帖子 Top 20。
 * 使用公共 JSON API（无需认证）。为提高成功率：
 *   - 使用浏览器 User-Agent；
 *   - 依次尝试 www.reddit.com 与 old.reddit.com 两个主机。
 *
 * 注意：Reddit 对数据中心 / 云主机 IP（如 GitHub Actions runner）可能直接返回 403，
 * 属于 Reddit 的访问策略，而非代码问题；本地家用 IP 通常可正常访问。
 */
export async function fetchReddit(): Promise<FeedItem[]> {
  const limit = Number(process.env.REDDIT_LIMIT || 20);

  const endpoints = [
    `https://www.reddit.com/r/all/top.json?t=day&limit=${limit}&raw_json=1`,
    `https://old.reddit.com/r/all/top.json?t=day&limit=${limit}&raw_json=1`,
  ];

  let lastError: unknown;
  for (const url of endpoints) {
    try {
      const resp = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        timeout: 30_000,
      });
      const children: unknown[] = resp.data?.data?.children ?? [];
      if (children.length === 0) continue; // 空结果则尝试下一个主机
      return children
        .map((c, i) => normalize((c as { data?: Record<string, unknown> })?.data ?? {}, i))
        .filter((x): x is FeedItem => Boolean(x && x.title));
    } catch (err) {
      lastError = err;
      // 继续尝试下一个端点
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Reddit 采集失败（可能被限流或 IP 被封禁）：${reason}`);
}

function normalize(d: Record<string, unknown>, i: number): FeedItem | null {
  const title = typeof d.title === 'string' ? d.title : '';
  if (!title) return null;

  const permalink = typeof d.permalink === 'string' ? d.permalink : '';
  const url = permalink ? `https://www.reddit.com${permalink}` : String(d.url ?? 'https://www.reddit.com/');

  const thumbnail = typeof d.thumbnail === 'string' && d.thumbnail.startsWith('http') ? d.thumbnail : undefined;

  return {
    id: `reddit-${String(d.id ?? d.name ?? i)}`,
    title,
    description: typeof d.selftext === 'string' && d.selftext.trim() !== '' ? d.selftext.slice(0, 200) : undefined,
    url,
    source: 'reddit',
    rank: i + 1,
    score: toNumber(d.ups),
    thumbnail,
    publishedAt: toIso(typeof d.created_utc === 'number' ? d.created_utc * 1000 : d.created_utc),
    category: typeof d.subreddit === 'string' ? `r/${d.subreddit}` : undefined,
  };
}
