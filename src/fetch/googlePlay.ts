import { runApifyActor } from './apify';
import { pickStr, pickNum } from './utils';
import type { FeedItem } from '../types';

const DEFAULT_ACTOR = 'haketa~google-play-scraper';

/**
 * Google Play：美国区热门免费应用 Top 50（Apify `Google Play Scraper`）。
 */
export async function fetchGooglePlay(apiKey: string): Promise<FeedItem[]> {
  const actorId = process.env.APIFY_GOOGLE_PLAY_ACTOR_ID || DEFAULT_ACTOR;
  const maxItems = Number(process.env.APIFY_GOOGLE_PLAY_MAX_ITEMS || 50);

  const raw = await runApifyActor({
    actorId,
    apiKey,
    input: {
      mode: 'rankings',
      collection: 'TOP_FREE',
      category: 'APPLICATION',
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
  const title = pickStr(raw, ['name', 'title', 'appName', 'app_name', 'title']);
  const url = pickStr(raw, ['url', 'appUrl', 'app_url', 'link', 'storeUrl', 'playStoreUrl']);
  if (!title || !url) return null;

  const id = pickStr(raw, ['id', 'appId', 'packageName', 'package_name', 'bundleId']) ?? String(i);

  return {
    id: `googleplay-${id}`,
    title,
    description: pickStr(raw, ['summary', 'description', 'developer', 'publisher', 'developerName']),
    url,
    source: 'googleplay',
    rank: pickNum(raw, ['rank', 'position', 'rankPosition', 'chartPosition']),
    score: pickNum(raw, [
      'downloads',
      'downloadCount',
      'installs',
      'installCount',
      'ratingsCount',
      'ratingCount',
      'reviewsCount',
    ]),
    thumbnail: pickStr(raw, ['icon', 'iconUrl', 'thumbnail', 'image', 'coverImage']),
    category: pickStr(raw, ['category', 'genre', 'genres', 'categoryName']),
  };
}
