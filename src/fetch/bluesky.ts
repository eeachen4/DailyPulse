import axios from 'axios';
import { CATEGORIES, type CategoryDef } from '../categories';
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
let jetstreamPromise: Promise<Array<{ post: BlueskyPost; text: string }>> | undefined;

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

interface JetstreamEvent {
  did?: string;
  time_us?: number;
  kind?: string;
  commit?: {
    operation?: string;
    collection?: string;
    rkey?: string;
    cid?: string;
    record?: { text?: string; createdAt?: string };
  };
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

function allJetstreamTerms(): string[] {
  return [...new Map(CATEGORIES.flatMap((category) => category.blueskyQueries)
    .map((query) => [query.toLocaleLowerCase(), query])).values()];
}

export function blueskyQueryMatches(text: string, query: string): boolean {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const caseSensitiveAcronym = query.length <= 4 && query === query.toUpperCase();
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`, caseSensitiveAcronym ? '' : 'i').test(text);
}

async function collectJetstream(endpoint: string): Promise<Array<{ post: BlueskyPost; text: string }>> {
  const lookbackMinutes = Math.max(1, Number(process.env.BLUESKY_JETSTREAM_LOOKBACK_MINUTES || 10));
  const timeoutMs = Math.max(2_000, Number(process.env.BLUESKY_JETSTREAM_TIMEOUT_MS || 12_000));
  const maxMatches = Math.max(25, Number(process.env.BLUESKY_JETSTREAM_MAX_MATCHES || 300));
  const maxEvents = Math.max(5_000, Number(process.env.BLUESKY_JETSTREAM_MAX_EVENTS || 100_000));
  const url = new URL(endpoint);
  url.searchParams.append('wantedCollections', 'app.bsky.feed.post');
  url.searchParams.set('maxMessageSizeBytes', '20000');
  url.searchParams.set('cursor', String((Date.now() - lookbackMinutes * 60_000) * 1_000));
  const terms = allJetstreamTerms();

  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const matches = new Map<string, { post: BlueskyPost; text: string }>();
    const matchesByCategory = new Map(CATEGORIES.map((category) => [category.id, 0]));
    const maxPerCategory = Math.max(5, Math.ceil(maxMatches / CATEGORIES.length));
    let processed = 0;
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket.close(); } catch { /* 已关闭 */ }
      if (matches.size > 0 || !error) resolve([...matches.values()]);
      else reject(error);
    };
    const timer = setTimeout(() => finish(), timeoutMs);
    socket.addEventListener('message', (message) => {
      processed += 1;
      try {
        const event = JSON.parse(String(message.data)) as JetstreamEvent;
        const commit = event.commit;
        const text = commit?.record?.text?.trim();
        if (event.kind === 'commit' && commit?.operation === 'create' && commit.collection === 'app.bsky.feed.post'
          && event.did && commit.rkey && text) {
          if (terms.some((term) => blueskyQueryMatches(text, term))) {
            const matchedCategories = CATEGORIES.filter((category) => category.blueskyQueries.some((term) => blueskyQueryMatches(text, term)));
            const uri = `at://${event.did}/app.bsky.feed.post/${commit.rkey}`;
            if (matchedCategories.some((category) => (matchesByCategory.get(category.id) ?? 0) < maxPerCategory)) {
              matches.set(uri, {
                text,
                post: {
                  uri,
                  cid: commit.cid,
                  author: { did: event.did },
                  record: { text, createdAt: commit.record?.createdAt },
                },
              });
              for (const category of matchedCategories) {
                matchesByCategory.set(category.id, Math.min(maxPerCategory, (matchesByCategory.get(category.id) ?? 0) + 1));
              }
            }
          }
        }
        const caughtUp = Boolean(event.time_us && event.time_us >= (Date.now() - 2_000) * 1_000);
        const categoryTargetsMet = [...matchesByCategory.values()].every((count) => count >= Math.min(10, maxPerCategory));
        if (categoryTargetsMet || processed >= maxEvents || caughtUp) finish();
      } catch {
        // 忽略无法解析或与帖子无关的事件。
      }
    });
    socket.addEventListener('error', () => finish(new Error('Bluesky Jetstream 连接失败')));
    socket.addEventListener('close', () => finish());
  });
}

async function jetstreamPosts(): Promise<Array<{ post: BlueskyPost; text: string }>> {
  if (!jetstreamPromise) {
    const configured = process.env.BLUESKY_JETSTREAM_URL;
    const endpoints = configured
      ? [configured]
      : [
          'wss://jetstream2.us-east.bsky.network/subscribe',
          'wss://jetstream2.us-west.bsky.network/subscribe',
        ];
    jetstreamPromise = (async () => {
      let lastError: unknown;
      for (const endpoint of endpoints) {
        try {
          const posts = await collectJetstream(endpoint);
          if (posts.length > 0) return posts;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError ?? new Error('Bluesky Jetstream 没有匹配到近期帖子');
    })().catch((error) => {
      jetstreamPromise = undefined;
      throw error;
    });
  }
  return jetstreamPromise;
}

async function fetchViaJetstream(category: CategoryDef, limit: number): Promise<FeedItem[]> {
  const candidates = await jetstreamPosts();
  const seen = new Set<string>();
  return candidates.flatMap(({ post, text }) => {
    const query = category.blueskyQueries.find((term) => blueskyQueryMatches(text, term));
    if (!query) return [];
    const normalized = normalize(post, category, query);
    if (!normalized || seen.has(normalized.id)) return [];
    seen.add(normalized.id);
    return [{ ...normalized, tags: [query, 'Jetstream'], stats: [{ label: '模式', value: '实时流' }] }];
  })
    .sort((left, right) => (right.publishedAt ?? '').localeCompare(left.publishedAt ?? ''))
    .slice(0, limit);
}

export async function fetchBluesky(category: CategoryDef): Promise<FeedItem[]> {
  const limit = Math.min(100, Math.max(1, Number(process.env.BLUESKY_LIMIT || 25)));
  const posts = new Map<string, { post: BlueskyPost; query: string }>();
  try {
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
  } catch (error) {
    console.warn(`[bluesky/appview] ${category.label} 搜索失败，改用 Jetstream：${error instanceof Error ? error.message : error}`);
    return fetchViaJetstream(category, limit);
  }

  const items = [...posts.values()]
    .map(({ post, query }) => normalize(post, category, query))
    .filter((item): item is FeedItem => Boolean(item))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
  return items.length > 0 ? items : fetchViaJetstream(category, limit);
}
