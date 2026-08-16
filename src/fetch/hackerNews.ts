import axios from 'axios';
import type { CategoryDef } from '../categories';
import type { FeedItem } from '../types';

const API = 'https://hn.algolia.com/api/v1/search_by_date';

interface HackerNewsHit {
  objectID?: string;
  title?: string;
  story_text?: string;
  url?: string;
  author?: string;
  points?: number;
  num_comments?: number;
  created_at?: string;
}

function normalize(hit: HackerNewsHit, category: CategoryDef, query: string): FeedItem | null {
  if (!hit.objectID || !hit.title) return null;
  const discussionUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;
  const rawScore = (hit.points ?? 0) + (hit.num_comments ?? 0) * 2;
  return {
    id: 'hackernews:' + hit.objectID,
    sourceItemId: hit.objectID,
    title: hit.title,
    description: hit.story_text?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || `由 ${hit.author ?? 'unknown'} 发布`,
    longDescription: hit.story_text?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    url: discussionUrl,
    externalUrl: hit.url,
    source: 'hackernews',
    category: category.label,
    categoryId: category.id,
    categoryIds: [category.id],
    score: rawScore,
    metrics: {
      rawScore,
      rawScoreLabel: '积分 + 评论',
      votes: hit.points,
      comments: hit.num_comments,
    },
    comments: hit.num_comments,
    developer: hit.author,
    publishedAt: hit.created_at,
    tags: [query, 'hacker news'],
    stats: [
      { label: '积分', value: String(hit.points ?? 0) },
      { label: '评论', value: String(hit.num_comments ?? 0) },
    ],
  };
}

export async function fetchHackerNews(category: CategoryDef): Promise<FeedItem[]> {
  const limit = Math.min(100, Math.max(1, Number(process.env.HACKER_NEWS_LIMIT || 25)));
  const cutoff = Math.floor(Date.now() / 1000) - 3 * 24 * 60 * 60;
  const hits = new Map<string, { hit: HackerNewsHit; query: string }>();
  for (const query of category.hackerNewsQueries) {
    const response = await axios.get<{ hits?: HackerNewsHit[] }>(API, {
      params: {
        query,
        tags: 'story',
        hitsPerPage: limit,
        numericFilters: `created_at_i>${cutoff}`,
      },
      timeout: 30_000,
    });
    for (const hit of response.data?.hits ?? []) {
      if (hit.objectID && !hits.has(hit.objectID)) hits.set(hit.objectID, { hit, query });
    }
  }

  return [...hits.values()]
    .map(({ hit, query }) => normalize(hit, category, query))
    .filter((item): item is FeedItem => Boolean(item))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}
