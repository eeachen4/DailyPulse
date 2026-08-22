import axios from 'axios';
import type { CategoryDef } from '../categories';
import type { FeedItem } from '../types';

const API = 'https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts';
const SESSION_API = 'https://bsky.social/xrpc/com.atproto.server.createSession';

interface BlueskySession {
  accessJwt?: string;
  didDoc?: {
    service?: Array<{ id?: string; type?: string; serviceEndpoint?: string }>;
  };
}

let session: { token: string; endpoint: string } | undefined;

interface BlueskyPost {
  uri?: string;
  cid?: string;
  author?: { did?: string; handle?: string; displayName?: string };
  record?: { text?: string; createdAt?: string };
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  quoteCount?: number;
}

function postKey(post: BlueskyPost): string | undefined {
  return post.uri || post.cid;
}

function postRkey(uri: string): string {
  return uri.split('/').pop() ?? uri;
}

function pdsEndpoint(data: BlueskySession): string {
  const service = data.didDoc?.service?.find((entry) => entry.id?.endsWith('#atproto_pds'));
  return service?.serviceEndpoint?.replace(/\/$/, '') || 'https://bsky.social';
}

async function requestContext(): Promise<{ endpoint: string; headers: Record<string, string> }> {
  if (session) {
    return {
      endpoint: `${session.endpoint}/xrpc/app.bsky.feed.searchPosts`,
      headers: {
        Authorization: `Bearer ${session.token}`,
        'atproto-proxy': 'did:web:api.bsky.app#bsky_appview',
      },
    };
  }
  const identifier = process.env.BSKY_IDENTIFIER;
  const password = process.env.BSKY_APP_PASSWORD;
  if (!identifier || !password) return { endpoint: API, headers: {} };
  const response = await axios.post<BlueskySession>(SESSION_API, { identifier, password }, { timeout: 30_000 });
  if (!response.data?.accessJwt) throw new Error('Bluesky 登录成功但未返回 accessJwt');
  session = { token: response.data.accessJwt, endpoint: pdsEndpoint(response.data) };
  return {
    endpoint: `${session.endpoint}/xrpc/app.bsky.feed.searchPosts`,
    headers: {
      Authorization: `Bearer ${session.token}`,
      'atproto-proxy': 'did:web:api.bsky.app#bsky_appview',
    },
  };
}

function normalize(post: BlueskyPost, category: CategoryDef, query: string): FeedItem | null {
  const sourceItemId = postKey(post);
  const text = post.record?.text?.trim();
  if (!sourceItemId || !text) return null;

  const handle = post.author?.handle ?? post.author?.did ?? 'unknown';
  const rawScore =
    (post.likeCount ?? 0) +
    (post.repostCount ?? 0) * 2 +
    (post.replyCount ?? 0) * 1.5 +
    (post.quoteCount ?? 0) * 2;
  const title = text.replace(/\s+/g, ' ').slice(0, 140);
  return {
    id: 'bluesky:' + sourceItemId,
    sourceItemId,
    title,
    description: `@${handle} · ${text}`,
    longDescription: text,
    url: `https://bsky.app/profile/${handle}/post/${postRkey(sourceItemId)}`,
    source: 'bluesky',
    category: category.label,
    categoryId: category.id,
    categoryIds: [category.id],
    score: rawScore,
    metrics: {
      rawScore,
      rawScoreLabel: '互动热度',
      votes: (post.likeCount ?? 0) + (post.repostCount ?? 0),
      comments: post.replyCount,
    },
    comments: post.replyCount,
    developer: '@' + handle,
    publishedAt: post.record?.createdAt,
    tags: [query],
    stats: [
      { label: '点赞', value: String(post.likeCount ?? 0) },
      { label: '转发', value: String(post.repostCount ?? 0) },
    ],
  };
}

export async function fetchBluesky(category: CategoryDef): Promise<FeedItem[]> {
  const limit = Math.min(100, Math.max(1, Number(process.env.BLUESKY_LIMIT || 25)));
  const posts = new Map<string, { post: BlueskyPost; query: string }>();
  const { endpoint, headers } = await requestContext();
  for (const query of category.blueskyQueries) {
    const response = await axios.get<{ posts?: BlueskyPost[] }>(endpoint, {
      params: { q: query, limit, sort: 'top' },
      headers,
      timeout: 30_000,
    });
    for (const post of response.data?.posts ?? []) {
      const key = postKey(post);
      if (key && !posts.has(key)) posts.set(key, { post, query });
    }
  }

  return [...posts.values()]
    .map(({ post, query }) => normalize(post, category, query))
    .filter((item): item is FeedItem => Boolean(item))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}
