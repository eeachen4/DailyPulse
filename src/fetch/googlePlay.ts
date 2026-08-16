import { runApifyActor } from './apify';
import { pickStr, pickNum } from './utils';
import type { FeedItem } from '../types';
import type { CategoryDef } from '../categories';

const DEFAULT_ACTOR = 'haketa~google-play-scraper';

/**
 * Google Play：按类别采集（美国区）。
 */
export async function fetchGooglePlay(apiKey: string, category: CategoryDef): Promise<FeedItem[]> {
  const actorId = process.env.APIFY_GOOGLE_PLAY_ACTOR_ID || DEFAULT_ACTOR;
  const maxItems = Number(process.env.APIFY_GOOGLE_PLAY_MAX_ITEMS || 20);
  const spec = category.googlePlay;

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
  const title = pickStr(raw, ['name', 'title', 'appName', 'app_name', 'title']);
  const url = pickStr(raw, ['url', 'appUrl', 'app_url', 'link', 'storeUrl', 'playStoreUrl']);
  if (!title || !url) return null;

  const id = pickStr(raw, ['id', 'appId', 'packageName', 'package_name', 'bundleId']) ?? String(i);
  const genre = pickStr(raw, ['category', 'genre', 'genres', 'categoryName']);

  return {
    id: `googleplay-${categoryLabel}-${id}`,
    title,
    description: pickStr(raw, ['summary', 'description', 'developer', 'publisher', 'developerName']),
    url,
    source: 'googleplay',
    category: categoryLabel,
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
    tags: genre ? [genre] : undefined,
  };
}
