import axios from 'axios';
import type { FeedItem } from '../types';
import type { CategoryDef } from '../categories';

/**
 * App Store：使用苹果官方 iTunes API（无需 key）。
 *   - rankings 模式：官方 Top Charts RSS（按分类）+ Lookup 批量补全详情
 *   - search 模式：iTunes Search API（关键词，含完整详情）
 */

const RSS_BASE = 'https://itunes.apple.com';
const SEARCH_URL = 'https://itunes.apple.com/search';
const LOOKUP_URL = 'https://itunes.apple.com/lookup';

function country(): string {
  return process.env.APP_STORE_COUNTRY || 'us';
}

interface ITunesResult {
  trackId?: number;
  trackName?: string;
  description?: string;
  sellerName?: string;
  artistName?: string;
  primaryGenreName?: string;
  genres?: string[];
  averageUserRating?: number;
  userRatingCount?: number;
  formattedPrice?: string;
  price?: number;
  trackViewUrl?: string;
  artworkUrl512?: string;
  artworkUrl100?: string;
  screenshotUrls?: string[];
  version?: string;
  fileSizeBytes?: string;
  currentVersionReleaseDate?: string;
  releaseDate?: string;
  minimumOsVersion?: string;
  contentAdvisoryRating?: string;
}

function fmtSize(bytes?: string): string | undefined {
  if (!bytes) return undefined;
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return `${(n / 1024 / 1024).toFixed(0)} MB`;
}

function normalize(r: ITunesResult, rank: number | undefined, categoryLabel: string): FeedItem | null {
  if (!r.trackName || r.trackId === undefined) return null;
  const genre = r.primaryGenreName ?? r.genres?.[0];
  const price = r.formattedPrice ?? (r.price === 0 || r.price === undefined ? 'Free' : `$${r.price}`);
  const released = r.currentVersionReleaseDate ?? r.releaseDate;

  const stats: Array<{ label: string; value: string }> = [];
  if (r.version) stats.push({ label: '版本', value: r.version });
  const size = fmtSize(r.fileSizeBytes);
  if (size) stats.push({ label: '大小', value: size });
  if (r.minimumOsVersion) stats.push({ label: '最低系统', value: r.minimumOsVersion });
  if (r.contentAdvisoryRating) stats.push({ label: '内容分级', value: r.contentAdvisoryRating });
  if (released) stats.push({ label: '更新日期', value: released.slice(0, 10) });

  return {
    id: `appstore-${categoryLabel}-${r.trackId}`,
    title: r.trackName,
    longDescription: r.description,
    url: r.trackViewUrl ?? `https://apps.apple.com/us/app/id${r.trackId}`,
    source: 'appstore',
    category: categoryLabel,
    rank,
    score: r.userRatingCount,
    rating: r.averageUserRating,
    price,
    developer: r.sellerName ?? r.artistName,
    thumbnail: r.artworkUrl512 ?? r.artworkUrl100,
    screenshots: r.screenshotUrls,
    publishedAt: released,
    tags: genre ? [genre] : undefined,
    stats: stats.length ? stats : undefined,
  };
}

async function fetchRankings(category: CategoryDef): Promise<FeedItem[]> {
  const maxItems = Number(process.env.APP_STORE_MAX_ITEMS || 30);
  const c = country();
  const genreId = category.appStore.genreId;
  const url = `${RSS_BASE}/${c}/rss/topfreeapplications/limit=${maxItems}/genre=${genreId}/json`;

  const resp = await axios.get(url, { timeout: 30_000 });
  const entries: unknown[] = resp.data?.feed?.entry ?? [];
  const ids: string[] = [];
  for (const e of entries) {
    const id = (e as { id?: { attributes?: { 'im:id'?: string } } })?.id?.attributes?.['im:id'];
    if (id) ids.push(String(id));
  }
  if (ids.length === 0) return [];

  // 批量 Lookup 补全详情
  const lookup = await axios.get(LOOKUP_URL, {
    params: { id: ids.join(','), country: c },
    timeout: 30_000,
  });
  const results: ITunesResult[] = lookup.data?.results ?? [];
  const map = new Map<number, ITunesResult>();
  for (const r of results) if (r.trackId !== undefined) map.set(r.trackId, r);

  // 按榜单顺序输出，保留排名
  const items: FeedItem[] = [];
  let rank = 0;
  for (const id of ids) {
    const r = map.get(Number(id));
    if (!r) continue;
    rank += 1;
    const it = normalize(r, rank, category.label);
    if (it) items.push(it);
  }
  return items;
}

async function fetchSearch(category: CategoryDef): Promise<FeedItem[]> {
  const maxItems = Number(process.env.APP_STORE_MAX_ITEMS || 30);
  const c = country();
  const terms = category.appStore.searchTerms ?? [];
  const all: ITunesResult[] = [];
  for (const term of terms) {
    const resp = await axios.get(SEARCH_URL, {
      params: { term, country: c, entity: 'software', limit: maxItems },
      timeout: 30_000,
    });
    all.push(...(resp.data?.results ?? []));
  }

  // 按 trackId 去重，按评分人数排序（越热门越靠前）
  const seen = new Set<number>();
  const uniq: ITunesResult[] = [];
  for (const r of all) {
    if (r.trackId !== undefined && !seen.has(r.trackId)) {
      seen.add(r.trackId);
      uniq.push(r);
    }
  }
  uniq.sort((a, b) => (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0));

  return uniq
    .slice(0, maxItems)
    .map((r) => normalize(r, undefined, category.label))
    .filter((x): x is FeedItem => Boolean(x));
}

export async function fetchAppStore(category: CategoryDef): Promise<FeedItem[]> {
  if (category.appStore.mode === 'rankings') return fetchRankings(category);
  return fetchSearch(category);
}
