import { runApifyActor } from './apify';
import { pickStr, pickNum, pickValue, toIso, toJoined } from './utils';
import type { FeedItem } from '../types';
import type { CategoryDef } from '../categories';

const DEFAULT_ACTOR = 'glassventures~product-hunt-scraper';

/**
 * Product Hunt：按 topic 采集今日热门产品（每个类别对应一个或多个 topic slug）。
 */
export async function fetchProductHunt(apiKey: string, category: CategoryDef): Promise<FeedItem[]> {
  const actorId = process.env.APIFY_PRODUCT_HUNT_ACTOR_ID || DEFAULT_ACTOR;
  const maxItems = Number(process.env.APIFY_PRODUCT_HUNT_MAX_ITEMS || 10);

  const raw = await runApifyActor({
    actorId,
    apiKey,
    input: {
      topics: category.productHuntTopics,
      maxItems,
    },
  });

  return raw
    .map((r, i) => normalize(r as Record<string, unknown>, i, category.label))
    .filter((x): x is FeedItem => Boolean(x && x.title));
}

function normalize(raw: Record<string, unknown>, i: number, categoryLabel: string): FeedItem | null {
  const title = pickStr(raw, ['name', 'title', 'productName', 'product_name']);
  if (!title) return null;

  const slug = pickStr(raw, ['slug', 'productSlug']);
  const url = pickStr(raw, ['url', 'link', 'productUrl', 'websiteUrl', 'discussionUrl', 'redirectUrl'])
    ?? (slug ? `https://www.producthunt.com/posts/${slug}` : 'https://www.producthunt.com/');

  const id = pickStr(raw, ['id', 'productId', 'slug']) ?? String(i);
  const topics = toJoined(pickValue(raw, ['topics', 'tags', 'categories']));

  return {
    id: `producthunt-${categoryLabel}-${id}`,
    title,
    description: pickStr(raw, ['tagline', 'description', 'subtitle']),
    url,
    source: 'producthunt',
    category: categoryLabel,
    rank: pickNum(raw, ['rank', 'position']) ?? i + 1,
    score: pickNum(raw, ['votes', 'votesCount', 'upvotes', 'upvoteCount', 'votes_count']),
    thumbnail: pickStr(raw, ['thumbnailUrl', 'thumbnail', 'imageUrl', 'image', 'logo', 'logoUrl']),
    publishedAt: toIso(pickValue(raw, ['createdAt', 'launchedAt', 'featuredAt', 'featured_at'])),
    tags: topics ? topics.split(', ').map((s) => s.trim()).filter(Boolean) : undefined,
  };
}
