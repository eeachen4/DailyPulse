import axios from 'axios';
import type { CategoryDef } from '../categories';
import type { FeedItem } from '../types';

const API = 'https://api.github.com/search/repositories';

interface GitHubRepository {
  id?: number;
  full_name?: string;
  name?: string;
  html_url?: string;
  description?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  language?: string | null;
  topics?: string[];
  owner?: { login?: string };
  created_at?: string;
  pushed_at?: string;
  updated_at?: string;
}

function normalize(repo: GitHubRepository, category: CategoryDef, query: string): FeedItem | null {
  if (!repo.full_name || !repo.html_url) return null;
  const stars = repo.stargazers_count ?? 0;
  const forks = repo.forks_count ?? 0;
  const rawScore = stars + forks * 2;
  const description = repo.description?.trim() || `${repo.full_name} 开源项目`;
  return {
    id: 'github:' + repo.full_name,
    sourceItemId: repo.full_name,
    title: repo.full_name,
    description,
    longDescription: description,
    url: repo.html_url,
    source: 'github',
    category: category.label,
    categoryId: category.id,
    categoryIds: [category.id],
    score: rawScore,
    metrics: {
      rawScore,
      rawScoreLabel: 'Star + Fork',
      votes: stars,
      comments: repo.open_issues_count,
    },
    comments: repo.open_issues_count,
    developer: repo.owner?.login,
    publishedAt: repo.pushed_at ?? repo.updated_at ?? repo.created_at,
    tags: [query, repo.language, ...(repo.topics ?? [])].filter((value): value is string => Boolean(value)),
    stats: [
      { label: 'Star', value: String(stars) },
      { label: 'Fork', value: String(forks) },
      { label: 'Issue', value: String(repo.open_issues_count ?? 0) },
      repo.language ? { label: '语言', value: repo.language } : undefined,
    ].filter((value): value is { label: string; value: string } => Boolean(value)),
  };
}

export async function fetchGitHub(category: CategoryDef): Promise<FeedItem[]> {
  const limit = Math.min(100, Math.max(1, Number(process.env.GITHUB_LIMIT || 25)));
  const token = process.env.GITHUB_API_TOKEN || process.env.GITHUB_TOKEN;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'DailyPulse/1.0 (https://github.com/eeachen4/DailyPulse)',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const repositories = new Map<string, { repo: GitHubRepository; query: string }>();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (const query of category.githubQueries) {
    const response = await axios.get<{ items?: GitHubRepository[] }>(API, {
      params: { q: `${query} pushed:>=${since}`, sort: 'stars', order: 'desc', per_page: limit },
      headers,
      timeout: 30_000,
    });
    for (const repo of response.data?.items ?? []) {
      if (repo.full_name && !repositories.has(repo.full_name)) repositories.set(repo.full_name, { repo, query });
    }
  }

  return [...repositories.values()]
    .map(({ repo, query }) => normalize(repo, category, query))
    .filter((item): item is FeedItem => Boolean(item))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}
