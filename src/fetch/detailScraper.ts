import axios from 'axios';
import { load } from 'cheerio';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { toNumber } from './utils';
import { redditProxy } from './proxy';
import {
  canonicalId,
  detailForItem,
  detailSlug,
  hasDetail,
  sourceItemIdFor,
  type DetailFile,
} from '../dataModel';
import type { FeedDetail, FeedItem } from '../types';

/**
 * 从条目的来源网页抓取详情：解析 og:meta 与 JSON-LD 结构化数据，
 * 提取完整描述、高清图、截图、评分、价格、作者、发布日期等信息。
 */

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export interface ScrapedDetail {
  title?: string;
  description?: string;
  image?: string;
  screenshots?: string[];
  siteName?: string;
  rating?: number;
  reviewCount?: number;
  price?: string;
  author?: string;
  datePublished?: string;
}

type Cheerio = ReturnType<typeof load>;

async function fetchHtml(url: string): Promise<string> {
  // 仅 Reddit 详情走代理（其余源直连）
  let isReddit = false;
  try {
    isReddit = /(^|\.)reddit\.com$/.test(new URL(url).hostname);
  } catch {
    /* 忽略非法 URL */
  }
  const resp = await axios.get(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8' },
    proxy: isReddit ? redditProxy() : undefined,
    timeout: 15_000,
    maxRedirects: 5,
    validateStatus: (s) => s >= 200 && s < 400,
  });
  return typeof resp.data === 'string' ? resp.data : '';
}

function metaContent($: Cheerio, selectors: string[]): string | undefined {
  for (const sel of selectors) {
    const v = $(sel).first().attr('content')?.trim();
    if (v) return v;
  }
  return undefined;
}

function asStringArray(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) {
    return v.flatMap((x) => {
      if (typeof x === 'string') return [x];
      if (x && typeof x === 'object') {
        const o = x as Record<string, unknown>;
        if (typeof o.url === 'string') return [o.url];
        if (typeof o.contentUrl === 'string') return [o.contentUrl];
      }
      return [];
    });
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.url === 'string') return [o.url];
    if (typeof o.contentUrl === 'string') return [o.contentUrl];
  }
  return [];
}

function parseJsonLd($: Cheerio): Record<string, unknown> | undefined {
  let best: Record<string, unknown> | undefined;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() ?? '';
      if (!raw.trim()) return;
      const parsed: unknown = JSON.parse(raw);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const c of candidates) {
        if (!c || typeof c !== 'object') continue;
        const obj = c as Record<string, unknown>;
        const typeArr = obj['@type'];
        const type = Array.isArray(typeArr) ? String(typeArr[0]) : String(typeArr ?? '');
        if (/Product|SoftwareApplication|MobileApplication|WebApplication|Article|DiscussionForumPosting|NewsArticle|CreativeWork/i.test(type)) {
          best = obj;
        }
      }
    } catch {
      /* 忽略非法 JSON-LD */
    }
  });
  return best;
}

export async function scrapeDetail(url: string): Promise<ScrapedDetail> {
  const html = await fetchHtml(url);
  const $ = load(html);
  const out: ScrapedDetail = {};

  out.title = metaContent($, ['meta[property="og:title"]', 'meta[name="twitter:title"]']);
  out.description = metaContent($, [
    'meta[property="og:description"]',
    'meta[name="description"]',
    'meta[name="twitter:description"]',
  ]);
  out.image = metaContent($, [
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
    'meta[name="twitter:image:src"]',
  ]);
  out.siteName = metaContent($, ['meta[property="og:site_name"]']);

  const ld = parseJsonLd($);
  if (ld) {
    if (typeof ld.name === 'string' && ld.name.trim()) out.title = ld.name;
    if (typeof ld.description === 'string' && ld.description.trim()) out.description = ld.description;

    const images = asStringArray(ld.image);
    const shots = asStringArray(ld.screenshot);
    out.screenshots = shots.length ? shots : images.length > 1 ? images : undefined;
    if (!out.image && images[0]) out.image = images[0];

    const ar = ld.aggregateRating as Record<string, unknown> | undefined;
    if (ar) {
      out.rating = toNumber(ar.ratingValue);
      out.reviewCount = toNumber(ar.reviewCount ?? ar.ratingCount);
    }

    const offers = ld.offers as Record<string, unknown> | undefined;
    if (offers) {
      const price = offers.price ?? offers.lowPrice;
      out.price = typeof price === 'string' ? price : price !== undefined ? String(price) : undefined;
    }

    const author = ld.author as unknown;
    if (typeof author === 'string') out.author = author;
    else if (author && typeof author === 'object' && typeof (author as Record<string, unknown>).name === 'string') {
      out.author = String((author as Record<string, unknown>).name);
    }

    if (typeof ld.datePublished === 'string') out.datePublished = ld.datePublished;
  }

  return out;
}

function applyDetail(item: FeedItem, d: ScrapedDetail): FeedItem {
  const next: FeedItem = { ...item };

  // GKG 实时文件没有标题字段，先使用 URL slug；详情页可访问时以站点正式标题覆盖。
  if (item.source === 'gdelt' && d.title) next.title = d.title;
  if (d.description && (!item.longDescription || d.description.length > item.longDescription.length)) {
    next.longDescription = d.description;
  }
  if (d.description && !item.description) next.description = d.description.slice(0, 280);
  if (d.image && !item.thumbnail) next.thumbnail = d.image;
  if (d.screenshots && d.screenshots.length) next.screenshots = d.screenshots.slice(0, 8);
  if (d.rating !== undefined && item.rating === undefined) next.rating = d.rating;
  if (d.reviewCount !== undefined && item.comments === undefined) next.comments = d.reviewCount;
  if (d.price && !item.price) next.price = d.price;
  if (d.author && !item.developer) next.developer = d.author;
  if (d.datePublished && !item.publishedAt) next.publishedAt = d.datePublished;

  const stats = [...(item.stats ?? [])];
  if (d.siteName && !stats.some((s) => s.label === '网站')) {
    stats.push({ label: '网站', value: d.siteName });
  }
  next.stats = stats.length ? stats : undefined;

  return next;
}

function applyCachedDetail(item: FeedItem, detail: FeedDetail): FeedItem {
  const next: FeedItem = { ...item };
  if (detail.longDescription && (!next.longDescription || detail.longDescription.length > next.longDescription.length)) {
    next.longDescription = detail.longDescription;
  }
  if (!next.externalUrl && detail.externalUrl) next.externalUrl = detail.externalUrl;
  if ((!next.screenshots || next.screenshots.length === 0) && detail.screenshots?.length) next.screenshots = detail.screenshots;
  if (next.rating === undefined && detail.rating !== undefined) next.rating = detail.rating;
  if (!next.price && detail.price) next.price = detail.price;
  if (!next.developer && detail.developer) next.developer = detail.developer;
  if (next.comments === undefined && detail.comments !== undefined) next.comments = detail.comments;
  if ((!next.stats || next.stats.length === 0) && detail.stats?.length) next.stats = detail.stats;
  return next;
}

function detailCachePath(item: FeedItem): string {
  const id = canonicalId(item.source, sourceItemIdFor(item));
  return path.resolve(process.cwd(), 'data/details', detailSlug(id) + '.json');
}

async function readCachedDetail(item: FeedItem): Promise<DetailFile | undefined> {
  try {
    return JSON.parse(await readFile(detailCachePath(item), 'utf-8')) as DetailFile;
  } catch {
    return undefined;
  }
}

function cacheIsFresh(cache: DetailFile, item: FeedItem, now: number): boolean {
  if (cache.sourceUrl && cache.sourceUrl !== item.url) return false;
  // 兼容尚未写入 fetchedAt 的旧详情；首次命中后会自动迁移为带时间戳的新格式。
  if (!cache.fetchedAt) return true;
  const fetchedAt = new Date(cache.fetchedAt).getTime();
  if (!Number.isFinite(fetchedAt)) return false;
  const configured = Number(process.env.SCRAPE_DETAILS_CACHE_DAYS || 7);
  const cacheDays = Number.isFinite(configured) ? Math.max(0, configured) : 7;
  return now - fetchedAt <= cacheDays * 24 * 60 * 60 * 1_000;
}

/**
 * 并发抓取一批条目的来源网页详情。单个失败不影响整体（保留原数据）。
 */
export async function enrichFeed(items: FeedItem[], concurrency?: number): Promise<FeedItem[]> {
  const configured = concurrency ?? Number(process.env.SCRAPE_DETAILS_CONCURRENCY || 4);
  const limit = Number.isInteger(configured) ? Math.max(1, configured) : 4;
  const queue = items.map((_, index) => index);
  const results: FeedItem[] = new Array(items.length);
  const now = Date.now();
  const refreshedAt = new Date(now).toISOString();
  let done = 0;
  let cacheHits = 0;
  let cacheFallbacks = 0;
  let networkFetches = 0;

  const worker = async (): Promise<void> => {
    while (queue.length) {
      const index = queue.shift()!;
      const item = items[index];
      const cache = await readCachedDetail(item);
      if (cache && cacheIsFresh(cache, item, now)) {
        const cachedItem = applyCachedDetail(item, cache.detail);
        results[index] = {
          ...cachedItem,
          detailFetchedAt: cache.fetchedAt ?? refreshedAt,
          detailSourceUrl: item.url,
        };
        cacheHits += 1;
        done += 1;
        if (done % 50 === 0) console.log(`[scrape] 进度 ${done}/${items.length}`);
        continue;
      }
      try {
        networkFetches += 1;
        const d = await scrapeDetail(item.url);
        const enriched = applyDetail(item, d);
        results[index] = hasDetail(detailForItem(enriched))
          ? { ...enriched, detailFetchedAt: refreshedAt, detailSourceUrl: item.url }
          : enriched;
      } catch (err) {
        if (cache) {
          results[index] = {
            ...applyCachedDetail(item, cache.detail),
            detailFetchedAt: cache.fetchedAt,
            detailSourceUrl: cache.sourceUrl ?? item.url,
          };
          cacheFallbacks += 1;
        } else {
          results[index] = item; // 抓取失败则保留原数据
        }
        if (process.env.DEBUG) {
          console.warn(`[scrape] ${item.url} 失败：${err instanceof Error ? err.message : err}`);
        }
      }
      done += 1;
      if (done % 50 === 0) console.log(`[scrape] 进度 ${done}/${items.length}`);
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker()));
  console.log(`[scrape] 缓存命中 ${cacheHits}，网络抓取 ${networkFetches}，过期缓存保底 ${cacheFallbacks}`);
  return results;
}
