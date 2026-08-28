import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { unzipSync } from 'fflate';
import type { CategoryDef } from '../categories';
import type { FeedItem } from '../types';

const DOC_API = 'https://api.gdeltproject.org/api/v2/doc/doc';
const LAST_UPDATE = 'https://data.gdeltproject.org/gdeltv2/lastupdate.txt';
const DOC_CIRCUIT_BREAKER_MS = 15 * 60 * 1_000;
let lastRequestAt = 0;
let docApiUnavailableUntil = 0;
let liveGkgPromise: Promise<GkgRecord[]> | undefined;

interface GdeltArticle {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
  tone?: string;
  socialimage?: string;
}

interface GkgRecord {
  date?: string;
  domain?: string;
  url?: string;
  themes?: string;
  persons?: string;
  organizations?: string;
  tone?: string;
  image?: string;
  names?: string;
}

function parseDate(value?: string): string | undefined {
  if (!value) return undefined;
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}

function normalize(article: GdeltArticle, category: CategoryDef, query: string, rank: number, limit: number): FeedItem | null {
  if (!article.url || !/^https?:\/\//.test(article.url) || !article.title) return null;
  const rawScore = Math.max(1, limit - rank);
  return {
    id: 'gdelt:' + article.url,
    sourceItemId: article.url,
    title: article.title,
    description: [article.domain, article.language].filter(Boolean).join(' · ') || '全球新闻报道',
    url: article.url,
    source: 'gdelt',
    category: category.label,
    categoryId: category.id,
    categoryIds: [category.id],
    score: rawScore,
    metrics: { rawScore, rawScoreLabel: '媒体热度' },
    thumbnail: article.socialimage,
    publishedAt: parseDate(article.seendate),
    tags: [query, article.domain, article.sourcecountry].filter((value): value is string => Boolean(value)),
    stats: article.tone ? [{ label: '语气', value: article.tone }] : undefined,
  };
}

async function waitForRateLimit(): Promise<void> {
  const configured = Number(process.env.GDELT_MIN_INTERVAL_MS || 12_000);
  const intervalMs = Number.isFinite(configured) ? Math.max(5_500, configured) : 12_000;
  const waitMs = Math.max(0, intervalMs - (Date.now() - lastRequestAt));
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastRequestAt = Date.now();
}

function retryDelay(error: unknown, attempt: number): number {
  if (axios.isAxiosError(error)) {
    const retryAfter = Number(error.response?.headers?.['retry-after']);
    if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1_000;
  }
  return 15_000 * 2 ** attempt;
}

async function requestArticles(query: string, limit: number): Promise<GdeltArticle[]> {
  if (Date.now() < docApiUnavailableUntil) throw new Error('GDELT DOC API circuit breaker is open');
  const configured = Number(process.env.GDELT_RETRIES || 1);
  const retries = Number.isInteger(configured) ? Math.max(0, configured) : 1;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    await waitForRateLimit();
    try {
      const response = await axios.get<{ articles?: GdeltArticle[] }>(DOC_API, {
        params: {
          query,
          mode: 'artlist',
          maxrecords: limit,
          timespan: '1day',
          sort: 'HybridRel',
          format: 'json',
        },
        timeout: Number(process.env.GDELT_TIMEOUT_MS || 20_000),
        headers: { Accept: 'application/json', 'User-Agent': 'DailyPulse/1.0' },
      });
      return response.data?.articles ?? [];
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const networkFailure = axios.isAxiosError(error) && !error.response;
      const retryable = status === 429 || (status !== undefined && status >= 500);
      if (networkFailure) docApiUnavailableUntil = Date.now() + DOC_CIRCUIT_BREAKER_MS;
      if (!retryable || attempt === retries) throw error;
      const delay = retryDelay(error, attempt);
      console.warn(`[gdelt] 请求受限（${status}），${delay}ms 后重试（${attempt + 1}/${retries}）`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return [];
}

function parseGkgText(text: string): GkgRecord[] {
  return text.split('\n').flatMap((line) => {
    if (!line.trim()) return [];
    const fields = line.replace(/\r$/, '').split('\t');
    const url = fields[4];
    if (!url || !/^https?:\/\//.test(url)) return [];
    return [{
      date: fields[1],
      domain: fields[3],
      url,
      themes: fields[8] || fields[7],
      persons: fields[12] || fields[11],
      organizations: fields[14] || fields[13],
      tone: fields[15]?.split(',')[0],
      image: fields[18],
      names: fields[23],
    }];
  });
}

export function parseGkgArchive(archive: Uint8Array): GkgRecord[] {
  const files = unzipSync(archive);
  const entry = Object.entries(files).find(([name]) => name.endsWith('.gkg.csv'));
  if (!entry) throw new Error('GDELT GKG 压缩包中没有 .gkg.csv 文件');
  return parseGkgText(new TextDecoder().decode(entry[1]));
}

export function secureGdeltAssetUrl(url: string): string {
  return url.replace(/^http:/i, 'https:');
}

async function getWithRetries<T>(url: string, config: AxiosRequestConfig, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return (await axios.get<T>(url, config)).data;
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 2_000 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function fetchLiveGkg(): Promise<GkgRecord[]> {
  if (!liveGkgPromise) {
    liveGkgPromise = (async () => {
      const update = await getWithRetries<string>(LAST_UPDATE, {
        timeout: 15_000,
        responseType: 'text',
        headers: { Accept: 'text/plain', 'User-Agent': 'DailyPulse/1.0' },
      });
      const listedGkgUrl = update
        .split(/\r?\n/)
        .map((line) => line.trim().split(/\s+/).at(-1))
        .find((url) => url?.endsWith('.gkg.csv.zip'));
      if (!listedGkgUrl) throw new Error('GDELT lastupdate.txt 未提供 GKG 文件');
      // 官方清单仍返回 http://；GitHub-hosted runner 对该明文跳转可能返回 404。
      const gkgUrl = secureGdeltAssetUrl(listedGkgUrl);
      const archive = await getWithRetries<ArrayBuffer>(gkgUrl, {
        timeout: 60_000,
        responseType: 'arraybuffer',
        maxContentLength: 30 * 1024 * 1024,
        headers: { Accept: 'application/zip', 'User-Agent': 'DailyPulse/1.0' },
      });
      return parseGkgArchive(new Uint8Array(archive));
    })().catch((error) => {
      liveGkgPromise = undefined;
      throw error;
    });
  }
  return liveGkgPromise;
}

const GKG_CATEGORY_TERMS: Record<string, string[]> = {
  ai: ['artificial intelligence', 'machine learning', 'large language model', 'generative ai', 'chatgpt', 'openai', 'anthropic', 'deepmind', 'llm'],
  tools: ['productivity software', 'workflow automation', 'software automation', 'productivity app', 'automation platform'],
  code: ['programming language', 'software developer', 'developer tool', 'open source software', 'software engineering', 'github', 'coding'],
  agent: ['ai agent', 'artificial intelligence agent', 'agentic ai', 'autonomous agent', 'langchain', 'model context protocol'],
  research: ['ai research', 'machine learning', 'artificial intelligence', 'deep learning', 'neural network', 'language model benchmark'],
  opensource: ['open source', 'opensource', 'self hosted', 'self-hosted', 'github'],
  infrastructure: ['kubernetes', 'docker', 'observability', 'devops', 'cloud infrastructure', 'cloud computing infrastructure'],
};

function categoryTerms(category: CategoryDef): string[] {
  return GKG_CATEGORY_TERMS[category.id] ?? [];
}

function termMatches(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s_+%.-]+');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text);
}

function recordSearchText(record: GkgRecord): string {
  return [record.url, record.domain, record.themes, record.persons, record.organizations, record.names]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function recordTitle(record: GkgRecord): string {
  try {
    const url = new URL(record.url!);
    const slug = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) ?? '')
      .replace(/\.[a-z0-9]{2,5}$/i, '')
      .replace(/[-_+]+/g, ' ')
      .replace(/^\d{4,}\s*/, '')
      .trim();
    if (slug.length >= 8 && /[a-z\p{L}]/iu.test(slug) && !/^article\s*\d+$/i.test(slug)) return slug;
  } catch {
    // 交由实体名称兜底。
  }
  const names = (record.names ?? '').split(';').map((value) => value.split(',')[0]?.trim()).filter(Boolean).slice(0, 3);
  return names.length ? names.join(' · ') : `[GDELT] ${record.domain || '全球新闻'}`;
}

function normalizeGkg(record: GkgRecord, category: CategoryDef, rank: number, limit: number, matchedTerms: string[]): FeedItem {
  const rawScore = Math.max(1, limit - rank);
  const names = (record.names ?? '').split(';').map((value) => value.split(',')[0]?.trim()).filter(Boolean).slice(0, 4);
  return {
    id: 'gdelt:' + record.url,
    sourceItemId: record.url,
    title: recordTitle(record),
    description: [record.domain, ...names].filter(Boolean).join(' · ') || 'GDELT 全球实时新闻',
    url: record.url!,
    source: 'gdelt',
    category: category.label,
    categoryId: category.id,
    categoryIds: [category.id],
    score: rawScore,
    metrics: { rawScore, rawScoreLabel: '媒体热度' },
    thumbnail: record.image && /^https?:\/\//.test(record.image) ? record.image : undefined,
    publishedAt: parseDate(record.date),
    tags: [...matchedTerms, record.domain].filter((value): value is string => Boolean(value)),
    stats: record.tone ? [{ label: '语气', value: record.tone }] : undefined,
  };
}

async function fetchGkgFallback(category: CategoryDef, limit: number): Promise<FeedItem[]> {
  const terms = categoryTerms(category);
  const ranked = (await fetchLiveGkg()).flatMap((record) => {
    const searchText = recordSearchText(record);
    const matches = terms.filter((term) => termMatches(searchText, term));
    return matches.length ? [{ record, matches }] : [];
  });
  const seen = new Set<string>();
  return ranked
    .sort((a, b) => b.matches.length - a.matches.length)
    .filter(({ record }) => Boolean(record.url && !seen.has(record.url) && seen.add(record.url)))
    .slice(0, limit)
    .map(({ record, matches }, rank) => normalizeGkg(record, category, rank, limit, matches.slice(0, 5)));
}

export async function fetchGdelt(category: CategoryDef): Promise<FeedItem[]> {
  const limit = Math.min(250, Math.max(1, Number(process.env.GDELT_LIMIT || 25)));
  const articles = new Map<string, { article: GdeltArticle; query: string; rank: number }>();
  for (const query of category.gdeltQueries) {
    try {
      (await requestArticles(query, limit)).forEach((article, index) => {
        if (article.url && !articles.has(article.url)) articles.set(article.url, { article, query, rank: index });
      });
    } catch (error) {
      console.warn(`[gdelt/doc] "${query}" 失败，改用官方 GKG 实时文件：${error instanceof Error ? error.message : error}`);
      break;
    }
  }

  const docItems = [...articles.values()]
    .map(({ article, query, rank }) => normalize(article, category, query, rank, limit))
    .filter((item): item is FeedItem => Boolean(item))
    .slice(0, limit);
  if (docItems.length > 0) return docItems;

  const fallback = await fetchGkgFallback(category, limit);
  console.log(`[gdelt/gkg] ${category.label}：官方实时文件匹配 ${fallback.length} 条`);
  return fallback;
}
