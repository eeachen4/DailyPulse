import { runApifyActor } from './apify';
import { pickStr, pickNum, pickValue } from './utils';
import type { FeedItem } from '../types';

const DEFAULT_ACTOR = 'haketa~app-store-scraper';

/**
 * App Store：美国区免费榜 Top 50（Apify `Apple App Store Scraper`）。
 */
export async function fetchAppStore(apiKey: string): Promise<FeedItem[]> {
  const actorId = process.env.APIFY_APP_STORE_ACTOR_ID || DEFAULT_ACTOR;
  const maxItems = Number(process.env.APIFY_APP_STORE_MAX_ITEMS || 50);

  const raw = await runApifyActor({
    actorId,
    apiKey,
    input: {
      mode: 'rankings',
      collection: 'TOP_FREE_IOS',
      country: 'us',
      maxItems,
      fullDetail: true,
      proxyConfiguration: { useApifyProxy: true },
    },
  });

  return raw
    .map((r, i) => normalize(r as Record<string, unknown>, i))
    .filter((x): x is FeedItem => Boolean(x && x.title && x.url));
}

function normalize(raw: Record<string, unknown>, i: number): FeedItem | null {
  const title = pickStr(raw, ['name', 'title', 'appName', 'app_name', 'trackName', 'trackCensoredName']);
  const url = pickStr(raw, ['url', 'appUrl', 'app_url', 'link', 'trackViewUrl', 'storeUrl']);
  if (!title || !url) return null;

  const id = pickStr(raw, ['id', 'appId', 'trackId', 'bundleId', 'bundle_id']) ?? String(i);

  return {
    id: `appstore-${id}`,
    title,
    description: pickStr(raw, ['subtitle', 'description', 'developer', 'sellerName', 'artistName']),
    url,
    source: 'appstore',
    rank: pickNum(raw, ['rank', 'position', 'rankPosition', 'chartPosition', 'chart_position']),
    score: pickNum(raw, [
      'ratingsCount',
      'ratingCount',
      'userRatingCount',
      'reviewsCount',
      'ratingCountForCurrentVersion',
    ]),
    thumbnail: pickStr(raw, ['icon', 'iconUrl', 'artworkUrl100', 'artworkUrl512', 'artworkUrl60', 'thumbnail']),
    category: pickStr(raw, ['category', 'primaryGenreName', 'genre']),
  };
}
