import axios from 'axios';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalId, sourceItemIdFor } from './dataModel';
import type { FeedItem } from './types';

interface TranslationEntry {
  fingerprint: string;
  titleZh?: string;
  descriptionZh?: string;
  translatedAt: string;
}

type TranslationCache = Record<string, TranslationEntry>;

function fingerprint(item: FeedItem): string {
  const value = `${item.title}\n${item.description ?? ''}`;
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function cacheKey(item: FeedItem): string {
  return canonicalId(item.source, sourceItemIdFor(item));
}

function containsChinese(value: string | undefined): boolean {
  return Boolean(value && /[\p{Script=Han}]/u.test(value));
}

function endpoint(): string | undefined {
  const configured = process.env.TRANSLATION_API_URL?.trim();
  if (!configured) return undefined;
  return configured.endsWith('/translate') ? configured : configured.replace(/\/$/, '') + '/translate';
}

async function readCache(filePath: string): Promise<TranslationCache> {
  try {
    return JSON.parse(await readFile(filePath, 'utf-8')) as TranslationCache;
  } catch {
    return {};
  }
}

async function writeCache(filePath: string, cache: TranslationCache): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = filePath + '.tmp';
  await writeFile(tempPath, JSON.stringify(cache, null, 2) + '\n', 'utf-8');
  await rename(tempPath, filePath);
}

async function translateText(apiUrl: string, values: string[]): Promise<string[]> {
  const payload = (q: string | string[]) => ({
    q,
    source: process.env.TRANSLATION_SOURCE_LANGUAGE || 'auto',
    target: process.env.TRANSLATION_TARGET_LANGUAGE || 'zh',
    format: 'text',
    api_key: process.env.TRANSLATION_API_KEY || undefined,
  });
  try {
    const response = await axios.post<{ translatedText?: string | string[] }>(apiUrl, payload(values), { timeout: 45_000 });
    const translated = response.data?.translatedText;
    if (Array.isArray(translated) && translated.length === values.length) return translated;
    if (typeof translated === 'string' && values.length === 1) return [translated];
  } catch (error) {
    if (values.length === 1) throw error;
  }
  return Promise.all(values.map(async (value) => {
    const response = await axios.post<{ translatedText?: string }>(apiUrl, payload(value), { timeout: 45_000 });
    if (!response.data?.translatedText) throw new Error('翻译接口没有返回 translatedText');
    return response.data.translatedText;
  }));
}

export async function translateFeedItems(items: FeedItem[]): Promise<FeedItem[]> {
  const apiUrl = endpoint();
  if (!apiUrl) {
    console.log('[translation] 未配置 TRANSLATION_API_URL，保留已有中文字段并跳过新增翻译');
    return items;
  }

  const cachePath = path.resolve(process.cwd(), 'data/translations.json');
  const cache = await readCache(cachePath);
  const configured = Number(process.env.TRANSLATION_MAX_ITEMS_PER_RUN || 300);
  let budget = Number.isInteger(configured) ? Math.max(0, configured) : 300;
  let cacheHits = 0;
  let translatedCount = 0;
  let failedCount = 0;
  const results: FeedItem[] = new Array(items.length);
  const pending: number[] = [];

  items.forEach((item, index) => {
    const itemFingerprint = fingerprint(item);
    const key = cacheKey(item);
    const cached = cache[key];
    if (cached?.fingerprint === itemFingerprint) {
      results[index] = { ...item, titleZh: cached.titleZh, descriptionZh: cached.descriptionZh };
      cacheHits += 1;
      return;
    }
    if (containsChinese(item.title)) {
      results[index] = { ...item, titleZh: item.title, descriptionZh: containsChinese(item.description) ? item.description : item.descriptionZh };
      return;
    }
    if (budget <= 0) {
      results[index] = item;
      return;
    }
    pending.push(index);
    budget -= 1;
  });

  const configuredConcurrency = Number(process.env.TRANSLATION_CONCURRENCY || 3);
  const concurrency = Number.isInteger(configuredConcurrency) ? Math.max(1, configuredConcurrency) : 3;
  const worker = async (): Promise<void> => {
    while (pending.length) {
      const index = pending.shift()!;
      const item = items[index];
      const itemFingerprint = fingerprint(item);
      const key = cacheKey(item);
      const values = [item.title];
      if (item.description) values.push(item.description.slice(0, 800));
      try {
        const translated = await translateText(apiUrl, values);
        const next = {
          ...item,
          titleZh: translated[0] || item.titleZh,
          descriptionZh: translated[1] || item.descriptionZh,
        };
        results[index] = next;
        cache[key] = {
          fingerprint: itemFingerprint,
          titleZh: next.titleZh,
          descriptionZh: next.descriptionZh,
          translatedAt: new Date().toISOString(),
        };
        translatedCount += 1;
      } catch (error) {
        failedCount += 1;
        results[index] = item;
        if (process.env.DEBUG) {
          console.warn(`[translation] ${item.id} 失败：${error instanceof Error ? error.message : error}`);
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, pending.length)) }, () => worker()));

  if (translatedCount > 0) await writeCache(cachePath, cache);
  console.log(`[translation] 缓存命中 ${cacheHits}，新增 ${translatedCount}，失败 ${failedCount}`);
  return results;
}
