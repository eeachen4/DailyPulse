import { runApifyActor } from './apify';
import { pickStr, pickNum, kv } from './utils';
import type { FeedItem } from '../types';
import type { CategoryDef } from '../categories';

const DEFAULT_ACTOR = 'haketa~app-store-scraper';

/**
 * App Store：按类别采集（美国区）。
 * 榜单类别走 rankings 模式，AI / 代码 / Agent 等无对应榜单类别的走 search 模式。
 */
export async function fetchAppStore(apiKey: string, category: CategoryDef): Promise<FeedItem[]> {
  const actorId = process.env.APIFY_APP_STORE_ACTOR_ID || DEFAULT_ACTOR;
  const maxItems = Number(process.env.APIFY_APP_STORE_MAX_ITEMS || 30);
  const spec = category.appStore;

  const input: Record<string, unknown> = {
    mode: spec.mode,
    country: 'us',
    maxItems,
    fullDetail: true,
    proxyConfiguration: { useApifyProxy: true },
  };
  if (spec.mode === 'rankings') {
    if (spec.collection) input.collection = spec.collection;
    if (spec.category) input.category = spec.category;
  } else {
    input.searchTerms = spec.searchTerms ?? [];
  }

  const raw = await runApifyActor({ actorId, apiKey, input });
  return raw
    .map((r, i) => normalize(r as Record<string, unknown>, i, category.label))
    .filter((x): x is FeedItem => Boolean(x && x.title && x.url));
}

function normalize(raw: Record<string, unknown>, i: number, categoryLabel: string): FeedItem | null {
  const title = pickStr(raw, ['name', 'title', 'appName', 'app_name', 'trackName', 'trackCensoredName']);
  const url = pickStr(raw, ['url', 'appUrl', 'app_url', 'link', 'trackViewUrl', 'storeUrl']);
  if (!title || !url) return null;

  const id = pickStr(raw, ['id', 'appId', 'trackId', 'bundleId', 'bundle_id']) ?? String(i);
  const genre = pickStr(raw, ['category', 'primaryGenreName', 'genre']);
  const developer = pickStr(raw, ['developer', 'sellerName', 'artistName', 'developerName']);

  const stats = [
    kv('版本', pickStr(raw, ['version', 'currentVersion'])),
    kv('大小', pickStr(raw, ['size', 'fileSizeBytes', 'formattedSize'])),
  ].filter((x): x is { label: string; value: string } => x !== null);

  return {
    id: `appstore-${categoryLabel}-${id}`,
    title,
    description: pickStr(raw, ['subtitle', 'description']),
    url,
    source: 'appstore',
    category: categoryLabel,
    rank: pickNum(raw, ['rank', 'position', 'rankPosition', 'chartPosition', 'chart_position']),
    score: pickNum(raw, [
      'ratingsCount',
      'ratingCount',
      'userRatingCount',
      'reviewsCount',
      'ratingCountForCurrentVersion',
    ]),
    rating: pickNum(raw, ['rating', 'averageUserRating', 'score']),
    price: pickStr(raw, ['price', 'formattedPrice', 'priceFormatted']),
    developer,
    thumbnail: pickStr(raw, ['icon', 'iconUrl', 'artworkUrl100', 'artworkUrl512', 'artworkUrl60', 'thumbnail']),
    tags: genre ? [genre] : undefined,
    stats: stats.length ? stats : undefined,
  };
}
