import gplay from 'google-play-scraper';
import type { FeedItem } from '../types';
import type { CategoryDef } from '../categories';

/**
 * Google Play：使用 google-play-scraper（社区标准库，无需 key）。
 *   - rankings 模式：Top Free 榜单（按分类）
 *   - search 模式：关键词搜索
 * 榜单/搜索先拿 appId 与顺序，再逐个 gplay.app 补全详情（描述/截图/评分/安装量等）。
 */

function country(): string {
  return process.env.GOOGLE_PLAY_COUNTRY || 'us';
}

interface GpSummary {
  appId?: string;
  title?: string;
}

interface GpFull {
  appId?: string;
  title?: string;
  summary?: string;
  description?: string;
  url?: string;
  score?: number;
  reviews?: number;
  installs?: string;
  minInstalls?: number;
  maxInstalls?: number;
  priceText?: string;
  free?: boolean;
  developer?: string;
  icon?: string;
  screenshots?: string[];
  released?: string;
  updated?: number;
  genre?: string;
  version?: string;
  size?: string;
  contentRating?: string;
}

async function appIdsFor(category: CategoryDef, maxItems: number): Promise<GpSummary[]> {
  const c = country();
  const spec = category.googlePlay;
  const ids: GpSummary[] = [];

  if (spec.mode === 'rankings') {
    const res = (await gplay.list({
      collection: gplay.collection.TOP_FREE,
      category: spec.category as never,
      country: c,
      num: maxItems,
    })) as unknown as GpSummary[];
    ids.push(...res);
  } else {
    for (const term of spec.searchTerms ?? []) {
      const res = (await gplay.search({ term, num: maxItems, country: c })) as unknown as GpSummary[];
      ids.push(...res);
    }
  }

  // 去重保序
  const seen = new Set<string>();
  return ids
    .filter((x) => typeof x.appId === 'string')
    .filter((x) => (seen.has(x.appId as string) ? false : (seen.add(x.appId as string), true)))
    .slice(0, maxItems);
}

async function detail(appId: string): Promise<GpFull | null> {
  try {
    return (await gplay.app({ appId, country: country() })) as unknown as GpFull;
  } catch {
    return null; // 单个 app 详情失败则跳过
  }
}

function normalize(a: GpFull, rank: number, categoryLabel: string): FeedItem | null {
  if (!a.title || !a.appId) return null;

  const free = a.free === true;
  const price = free ? 'Free' : a.priceText;

  const stats: Array<{ label: string; value: string }> = [];
  if (a.version) stats.push({ label: '版本', value: a.version });
  if (a.size) stats.push({ label: '大小', value: a.size });
  if (a.installs) stats.push({ label: '安装量', value: a.installs });
  if (a.contentRating) stats.push({ label: '内容分级', value: a.contentRating });
  if (a.updated) stats.push({ label: '更新日期', value: new Date(a.updated).toISOString().slice(0, 10) });

  return {
    id: 'googleplay:' + a.appId,
    sourceItemId: a.appId,
    title: a.title,
    description: a.summary,
    longDescription: a.description,
    url: a.url ?? `https://play.google.com/store/apps/details?id=${a.appId}`,
    source: 'googleplay',
    category: categoryLabel,
    categoryId: categoryLabel,
    categoryIds: [categoryLabel],
    rank,
    score: a.maxInstalls ?? a.minInstalls,
    metrics: {
      rawScore: a.maxInstalls ?? a.minInstalls,
      rawScoreLabel: '下载量',
      rating: a.score,
      comments: a.reviews,
      installs: a.maxInstalls ?? a.minInstalls,
    },
    rating: a.score,
    price,
    developer: a.developer,
    comments: a.reviews,
    thumbnail: a.icon,
    screenshots: a.screenshots,
    publishedAt: a.released,
    tags: a.genre ? [a.genre] : undefined,
    stats: stats.length ? stats : undefined,
  };
}

export async function fetchGooglePlay(category: CategoryDef): Promise<FeedItem[]> {
  const maxItems = Number(process.env.GOOGLE_PLAY_MAX_ITEMS || 30);
  const ids = await appIdsFor(category, maxItems);

  const items: FeedItem[] = [];
  let rank = 0;
  for (const { appId } of ids) {
    if (!appId) continue;
    const a = await detail(appId);
    if (!a) continue;
    rank += 1;
    const it = normalize(a, rank, category.label);
    if (it) items.push(it);
  }

  // 搜索模式按安装量排序（榜单保持原顺序）
  if (category.googlePlay.mode === 'search') {
    items.sort((x, y) => (y.score ?? 0) - (x.score ?? 0));
  }
  return items.slice(0, maxItems);
}
