import axios from 'axios';
import { load } from 'cheerio';
import type { CategoryDef } from '../categories';
import type { FeedItem } from '../types';

const API = 'https://export.arxiv.org/api/query';

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function searchQuery(queries: string[]): string {
  return queries.map((query) => (query.startsWith('cat:') || query.startsWith('all:') ? query : `all:"${query}"`)).join(' OR ');
}

export async function fetchArxiv(category: CategoryDef): Promise<FeedItem[]> {
  const limit = Math.min(100, Math.max(1, Number(process.env.ARXIV_LIMIT || 25)));
  const response = await axios.get<string>(API, {
    params: { search_query: searchQuery(category.arxivQueries), start: 0, max_results: limit, sortBy: 'submittedDate', sortOrder: 'descending' },
    timeout: 45_000,
    headers: { Accept: 'application/atom+xml', 'User-Agent': 'DailyPulse/1.0 (contact: github.com/eeachen4/DailyPulse)' },
    responseType: 'text',
  });
  const $ = load(response.data, { xmlMode: true });
  const items: FeedItem[] = [];
  $('entry').each((index, element) => {
    const id = clean($(element).find('id').first().text());
    const title = clean($(element).find('title').first().text());
    const summary = clean($(element).find('summary').first().text());
    if (!id || !title) return;
    const absUrl = id.replace('http://', 'https://');
    const authors = $(element).find('author name').map((_, author) => clean($(author).text())).get();
    const categories = $(element).find('category').map((_, categoryNode) => $(categoryNode).attr('term')).get().filter((term): term is string => Boolean(term));
    const rawScore = Math.max(1, limit - index);
    items.push({
      id: 'arxiv:' + id,
      sourceItemId: id,
      title,
      description: summary,
      longDescription: summary,
      url: absUrl,
      source: 'arxiv',
      category: category.label,
      categoryId: category.id,
      categoryIds: [category.id],
      score: rawScore,
      metrics: { rawScore, rawScoreLabel: '论文新鲜度' },
      developer: authors[0],
      publishedAt: clean($(element).find('published').first().text()) || undefined,
      tags: [...category.arxivQueries, ...categories].filter(Boolean),
      stats: [
        { label: '作者', value: String(authors.length) },
        { label: '分类', value: categories.join(', ') },
        authors.length ? { label: '第一作者', value: authors[0] } : undefined,
      ].filter((value): value is { label: string; value: string } => Boolean(value?.value)),
    });
  });
  return items;
}
