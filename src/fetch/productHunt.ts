import { runApifyActor } from './apify';
import { pickStr, pickNum, pickValue, toIso, toJoined } from './utils';
import type { FeedItem } from '../types';

const DEFAULT_ACTOR = 'glassventures~product-hunt-scraper';

/**
 * Product Hunt：今日热门产品 Top 10（Apify `Product Hunt Scraper`）。
 * 抓取 Product Hunt 首页，默认即为「今日」排行榜。
 */
export async function fetchProductHunt(apiKey: string): Promise<FeedItem[]> {
  const actorId = process.env.APIFY_PRODUCT_HUNT_ACTOR_ID || DEFAULT_ACTOR;
  const maxItems = Number(process.env.APIFY_PRODUCT_HUNT_MAX_ITEMS || 10);

  const raw = await runApifyActor({
    actorId,
    apiKey,
    input: {
      startUrls: [{ url: 'https://www.producthunt.com/' }],
      maxItems,
    },
  });

  return raw
    .map((r, i) => normalize(r as Record<string, unknown>, i))
    .filter((x): x is FeedItem => Boolean(x && x.title));
}

function normalize(raw: Record<string, unknown>, i: number): FeedItem | null {
  const title = pickStr(raw, ['name', 'title', 'productName', 'product_name']);
  if (!title) return null;

  const slug = pickStr(raw, ['slug', 'productSlug']);
  const url = pickStr(raw, ['url', 'link', 'productUrl', 'websiteUrl', 'discussionUrl', 'redirectUrl'])
    ?? (slug ? `https://www.producthunt.com/posts/${slug}` : 'https://www.producthunt.com/');

  const id = pickStr(raw, ['id', 'productId', 'slug']) ?? String(i);

  return {
    id: `producthunt-${id}`,
    title,
    description: pickStr(raw, ['tagline', 'description', 'subtitle']),
    url,
    source: 'producthunt',
    rank: pickNum(raw, ['rank', 'position']) ?? i + 1,
    score: pickNum(raw, ['votes', 'votesCount', 'upvotes', 'upvoteCount', 'votes_count']),
    thumbnail: pickStr(raw, ['thumbnailUrl', 'thumbnail', 'imageUrl', 'image', 'logo', 'logoUrl']),
    publishedAt: toIso(pickValue(raw, ['createdAt', 'launchedAt', 'featuredAt', 'featured_at'])),
    category: toJoined(pickValue(raw, ['topics', 'tags', 'categories'])),
  };
}
