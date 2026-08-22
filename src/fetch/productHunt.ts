import axios from 'axios';
import { runApifyActor } from './apify';
import { pickStr, pickNum, pickValue, toIso, toJoined } from './utils';
import type { FeedItem } from '../types';
import type { CategoryDef } from '../categories';

const DEFAULT_ACTOR = 'glassventures~product-hunt-scraper';
const PH_API = 'https://api.producthunt.com/v2/api/graphql';

/** Product Hunt Developer Token（优先 PRODUCT_HUNT_TOKEN，兼容 PH_DEVELOPER_TOKEN） */
function phToken(): string | undefined {
  return process.env.PRODUCT_HUNT_TOKEN || process.env.PH_DEVELOPER_TOKEN || undefined;
}

function stripUtm(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url.split('?')[0];
  }
}

interface PhNode {
  id: string;
  name?: string;
  tagline?: string;
  description?: string;
  url?: string;
  website?: string;
  votesCount?: number;
  commentsCount?: number;
  reviewsCount?: number;
  reviewsRating?: number;
  createdAt?: string;
  featuredAt?: string;
  thumbnail?: { url?: string };
  topics?: { edges?: Array<{ node?: { name?: string } }> };
  makers?: Array<{ name?: string }>;
}

async function fetchGraphQL(token: string, topic: string, first: number): Promise<PhNode[]> {
  const query = `query($topic: String!, $first: Int) {
    posts(topic: $topic, order: VOTES, first: $first) {
      edges {
        node {
          id name tagline description url website votesCount commentsCount
          reviewsCount reviewsRating createdAt featuredAt
          thumbnail { url }
          topics { edges { node { name } } }
          makers { name }
        }
      }
    }
  }`;
  const resp = await axios.post(
    PH_API,
    { query, variables: { topic, first } },
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 30_000,
    },
  );
  const edges: unknown[] = resp.data?.data?.posts?.edges ?? [];
  return edges
    .map((e) => (e as { node?: PhNode })?.node)
    .filter((n): n is PhNode => Boolean(n && n.name));
}

/**
 * Product Hunt：优先使用官方 GraphQL API（需 PRODUCT_HUNT_TOKEN），
 * 无 token 时回退到 Apify Actor。
 */
export async function fetchProductHunt(apiKey: string, category: CategoryDef): Promise<FeedItem[]> {
  const maxItems = Number(process.env.PRODUCT_HUNT_MAX_ITEMS || 20);
  const token = phToken();
  if (!token && !apiKey) {
    throw new Error('未配置 PRODUCT_HUNT_TOKEN 或 APIFY_API_KEY');
  }

  if (token) {
    const nodes: PhNode[] = [];
    for (const topic of category.productHuntTopics) {
      try {
        nodes.push(...(await fetchGraphQL(token, topic, maxItems)));
      } catch (err) {
        console.warn(`[producthunt/graphql] topic "${topic}" 失败：${err instanceof Error ? err.message : err}`);
      }
    }

    // 按 id 去重，按票数排序
    const seen = new Set<string>();
    const uniq: PhNode[] = [];
    for (const n of nodes) {
      if (!seen.has(n.id)) {
        seen.add(n.id);
        uniq.push(n);
      }
    }
    const items = uniq
      .sort((a, b) => (b.votesCount ?? 0) - (a.votesCount ?? 0))
      .slice(0, maxItems)
      .map((n, i) => normalizeGraphQL(n, i, category.label));

    if (items.length > 0) return items;
    if (!apiKey) {
      console.warn('[producthunt] GraphQL 无结果，且未配置 APIFY_API_KEY，返回空结果交由来源保底处理');
      return [];
    }
    console.warn('[producthunt] GraphQL 无结果，回退 Apify');
  }

  return fetchViaApify(apiKey, category);
}

function normalizeGraphQL(n: PhNode, i: number, categoryLabel: string): FeedItem {
  const url = n.url ? stripUtm(n.url) : `https://www.producthunt.com/posts/${n.id}`;
  const website = n.website ? stripUtm(n.website) : undefined;
  const topics = (n.topics?.edges ?? [])
    .map((e) => e.node?.name)
    .filter((x): x is string => Boolean(x));
  const makers = (n.makers ?? [])
    .map((m) => m.name)
    .filter((x): x is string => Boolean(x))
    .join(', ');

  const stats: Array<{ label: string; value: string }> = [];
  if (website) stats.push({ label: '官网', value: website });
  if (n.reviewsCount) stats.push({ label: '评价数', value: String(n.reviewsCount) });

  return {
    id: 'producthunt:' + n.id,
    sourceItemId: n.id,
    title: n.name ?? '',
    description: n.tagline,
    longDescription: n.description,
    url,
    externalUrl: website,
    source: 'producthunt',
    category: categoryLabel,
    categoryId: categoryLabel,
    categoryIds: [categoryLabel],
    rank: i + 1,
    score: n.votesCount,
    metrics: {
      rawScore: n.votesCount,
      rawScoreLabel: '点赞',
      votes: n.votesCount,
      comments: n.commentsCount,
      rating: n.reviewsRating,
    },
    rating: n.reviewsRating && n.reviewsRating > 0 ? n.reviewsRating : undefined,
    comments: n.commentsCount,
    developer: makers || undefined,
    thumbnail: n.thumbnail?.url,
    publishedAt: toIso(n.featuredAt ?? n.createdAt),
    tags: topics.length ? topics : undefined,
    stats: stats.length ? stats : undefined,
  };
}

/* ------------------------------ Apify 回退 ------------------------------ */

async function fetchViaApify(apiKey: string, category: CategoryDef): Promise<FeedItem[]> {
  if (!apiKey) throw new Error('Product Hunt 回退需要 APIFY_API_KEY');
  const actorId = process.env.APIFY_PRODUCT_HUNT_ACTOR_ID || DEFAULT_ACTOR;
  const maxItems = Number(process.env.PRODUCT_HUNT_MAX_ITEMS || 20);

  const raw = await runApifyActor({
    actorId,
    apiKey,
    input: { topics: category.productHuntTopics, maxItems },
  });

  return raw
    .map((r, i) => normalizeApify(r as Record<string, unknown>, i, category.label))
    .filter((x): x is FeedItem => Boolean(x && x.title));
}

function normalizeApify(raw: Record<string, unknown>, i: number, categoryLabel: string): FeedItem | null {
  const title = pickStr(raw, ['name', 'title', 'productName', 'product_name']);
  if (!title) return null;

  const slug = pickStr(raw, ['slug', 'productSlug']);
  const url = pickStr(raw, ['url', 'link', 'productUrl', 'websiteUrl', 'discussionUrl', 'redirectUrl'])
    ?? (slug ? `https://www.producthunt.com/posts/${slug}` : 'https://www.producthunt.com/');

  const id = pickStr(raw, ['id', 'productId', 'slug']) ?? String(i);
  const topics = toJoined(pickValue(raw, ['topics', 'tags', 'categories']));
  const makers = toJoined(pickValue(raw, ['makers', 'makerNames', 'makers_names']));

  return {
    id: 'producthunt:' + id,
    sourceItemId: id,
    title,
    description: pickStr(raw, ['tagline']),
    longDescription: pickStr(raw, ['description', 'subtitle']),
    url,
    source: 'producthunt',
    category: categoryLabel,
    categoryId: categoryLabel,
    categoryIds: [categoryLabel],
    rank: pickNum(raw, ['rank', 'position']) ?? i + 1,
    score: pickNum(raw, ['votes', 'votesCount', 'upvotes', 'upvoteCount', 'votes_count']),
    metrics: {
      rawScore: pickNum(raw, ['votes', 'votesCount', 'upvotes', 'upvoteCount', 'votes_count']),
      rawScoreLabel: '点赞',
      votes: pickNum(raw, ['votes', 'votesCount', 'upvotes', 'upvoteCount', 'votes_count']),
      comments: pickNum(raw, ['commentsCount', 'commentCount', 'comments', 'comments_count']),
      rating: pickNum(raw, ['rating', 'averageRating']),
    },
    rating: pickNum(raw, ['rating', 'averageRating']),
    price: pickStr(raw, ['pricingType', 'pricing', 'price']),
    developer: makers,
    comments: pickNum(raw, ['commentsCount', 'commentCount', 'comments', 'comments_count']),
    thumbnail: pickStr(raw, ['thumbnailUrl', 'thumbnail', 'imageUrl', 'image', 'logo', 'logoUrl']),
    publishedAt: toIso(pickValue(raw, ['createdAt', 'launchedAt', 'featuredAt', 'featured_at'])),
    tags: topics ? topics.split(', ').map((s) => s.trim()).filter(Boolean) : undefined,
  };
}
