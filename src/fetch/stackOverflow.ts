import axios from 'axios';
import type { CategoryDef } from '../categories';
import type { FeedItem } from '../types';

const API = 'https://api.stackexchange.com/2.3/questions';

interface StackQuestion {
  question_id?: number;
  title?: string;
  link?: string;
  body?: string;
  score?: number;
  answer_count?: number;
  view_count?: number;
  creation_date?: number;
  last_activity_date?: number;
  tags?: string[];
  owner?: { display_name?: string; link?: string };
  is_answered?: boolean;
}

function stripHtml(value?: string): string {
  return (value ?? '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function isoDate(seconds?: number): string | undefined {
  return seconds ? new Date(seconds * 1000).toISOString() : undefined;
}

function normalize(question: StackQuestion, category: CategoryDef): FeedItem | null {
  if (!question.question_id || !question.title || !question.link) return null;
  const score = question.score ?? 0;
  const answers = question.answer_count ?? 0;
  const rawScore = score + answers * 2;
  const description = stripHtml(question.body) || 'Stack Overflow 热门问题';
  return {
    id: 'stackoverflow:' + question.question_id,
    sourceItemId: String(question.question_id),
    title: question.title,
    description,
    longDescription: description,
    url: question.link,
    source: 'stackoverflow',
    category: category.label,
    categoryId: category.id,
    categoryIds: [category.id],
    score: rawScore,
    metrics: {
      rawScore,
      rawScoreLabel: '分数 + 回答',
      votes: score,
      comments: answers,
    },
    comments: answers,
    developer: question.owner?.display_name,
    publishedAt: isoDate(question.last_activity_date ?? question.creation_date),
    tags: question.tags ?? [],
    stats: [
      { label: '分数', value: String(score) },
      { label: '回答', value: String(answers) },
      { label: '浏览', value: String(question.view_count ?? 0) },
      { label: '状态', value: question.is_answered ? '已回答' : '未回答' },
    ],
  };
}

export async function fetchStackOverflow(category: CategoryDef): Promise<FeedItem[]> {
  const limit = Math.min(100, Math.max(1, Number(process.env.STACKOVERFLOW_LIMIT || 25)));
  const fromdate = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
  const questions = new Map<number, StackQuestion>();
  for (const tag of category.stackExchangeTags) {
    try {
      const response = await axios.get<{ items?: StackQuestion[] }>(API, {
        params: {
          site: 'stackoverflow',
          tagged: tag,
          sort: 'activity',
          order: 'desc',
          fromdate,
          pagesize: limit,
          filter: 'withbody',
        },
        timeout: 30_000,
        headers: { Accept: 'application/json', 'User-Agent': 'DailyPulse/1.0' },
      });
      for (const question of response.data?.items ?? []) {
        if (question.question_id && !questions.has(question.question_id)) questions.set(question.question_id, question);
      }
    } catch (error) {
      if (process.env.DEBUG) console.warn(`[stackoverflow] 标签 ${tag} 失败：${error instanceof Error ? error.message : error}`);
    }
  }

  return [...questions.values()]
    .map((question) => normalize(question, category))
    .filter((item): item is FeedItem => Boolean(item))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}
