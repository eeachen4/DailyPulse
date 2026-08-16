import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FeedData, FeedItem } from '../types';

/**
 * 将采集结果写入 data/daily.json，并附带采集时间戳。
 */
export async function saveData(items: FeedItem[], fetchedAt: string): Promise<string> {
  const data: FeedData = { fetchedAt, isSample: false, items };
  const dataDir = path.resolve(process.cwd(), 'data');
  await mkdir(dataDir, { recursive: true });
  const filePath = path.join(dataDir, 'daily.json');

  await writeJsonAtomic(filePath, data);

  // 保留每天一份快照，供后续回看和离线分析使用。
  const historyDir = path.join(dataDir, 'history');
  await mkdir(historyDir, { recursive: true });
  const date = new Date(fetchedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
  const historyPath = path.join(historyDir, `${date}.json`);
  await writeJsonAtomic(historyPath, data);

  const indexPath = path.join(historyDir, 'index.json');
  let entries: Array<{ date: string; fetchedAt: string; count: number; path: string }> = [];
  try {
    entries = JSON.parse(await readFile(indexPath, 'utf-8')) as typeof entries;
  } catch {
    // 首次写入历史目录时不存在索引，按空列表处理。
  }
  entries = entries.filter((entry) => entry.date !== date);
  entries.push({ date, fetchedAt, count: items.length, path: `${date}.json` });
  entries.sort((a, b) => b.date.localeCompare(a.date));
  await writeJsonAtomic(indexPath, entries);

  return filePath;
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
  await rename(tempPath, filePath);
}
