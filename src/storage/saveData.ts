import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FeedData, FeedItem } from '../types';

/**
 * 将采集结果写入 data/daily.json，并附带采集时间戳。
 */
export async function saveData(items: FeedItem[], fetchedAt: string): Promise<string> {
  const data: FeedData = { fetchedAt, items };
  const dataDir = path.resolve(process.cwd(), 'data');
  await mkdir(dataDir, { recursive: true });
  const filePath = path.join(dataDir, 'daily.json');
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return filePath;
}
