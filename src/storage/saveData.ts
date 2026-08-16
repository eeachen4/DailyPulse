import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  canonicalizeItems,
  detailSlug,
  toDetailFile,
  toSummary,
  withHeatScores,
} from '../dataModel';
import { DATA_SCHEMA_VERSION, type FeedData, type FeedItem, type FetchRun } from '../types';

/**
 * 将采集结果规范化后写入轻量摘要、详情文件和每日历史快照。
 */
export async function saveData(items: FeedItem[], fetchedAt: string, runs: FetchRun[] = []): Promise<string> {
  const canonicalItems = withHeatScores(canonicalizeItems(items));
  const summaries = canonicalItems.map(toSummary);
  const data: FeedData = {
    schemaVersion: DATA_SCHEMA_VERSION,
    fetchedAt,
    isSample: false,
    items: summaries,
    runs,
  };
  const dataDir = path.resolve(process.cwd(), 'data');
  await mkdir(dataDir, { recursive: true });
  const filePath = path.join(dataDir, 'daily.json');

  const detailDir = path.join(dataDir, 'details');
  await mkdir(detailDir, { recursive: true });
  await Promise.all(
    canonicalItems
      .filter((item) => summaries.some((summary) => summary.id === item.id && summary.detailRef))
      .map((item) => writeJsonAtomic(path.join(detailDir, detailSlug(item.id) + '.json'), toDetailFile(item))),
  );

  // 详情全部写成功后再替换摘要，避免 daily.json 引用半成品详情。
  await writeJsonAtomic(filePath, data);

  const historyDir = path.join(dataDir, 'history');
  await mkdir(historyDir, { recursive: true });
  const date = new Date(fetchedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
  await writeJsonAtomic(path.join(historyDir, date + '.json'), data);

  const indexPath = path.join(historyDir, 'index.json');
  let entries: Array<{ date: string; fetchedAt: string; count: number; path: string }> = [];
  try {
    entries = JSON.parse(await readFile(indexPath, 'utf-8')) as typeof entries;
  } catch {
    // 首次写入历史目录时不存在索引，按空列表处理。
  }
  entries = entries.filter((entry) => entry.date !== date);
  entries.push({ date, fetchedAt, count: summaries.length, path: date + '.json' });
  entries.sort((a, b) => b.date.localeCompare(a.date));
  await writeJsonAtomic(indexPath, entries);

  return filePath;
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tempPath = filePath + '.tmp';
  await writeFile(tempPath, JSON.stringify(value, null, 2) + '\n', 'utf-8');
  await rename(tempPath, filePath);
}
