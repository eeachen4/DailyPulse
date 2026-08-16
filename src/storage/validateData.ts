import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FeedData, Source } from '../types';

const SOURCES: Source[] = ['appstore', 'googleplay', 'producthunt', 'reddit'];

async function main(): Promise<void> {
  const filePath = path.resolve(process.cwd(), 'data/daily.json');
  const data = JSON.parse(await readFile(filePath, 'utf-8')) as FeedData;
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('daily.json 没有任何条目');
  }

  const ids = new Set<string>();
  for (const item of data.items) {
    if (!item.id || ids.has(item.id)) throw new Error(`ID 缺失或重复：${item.id || '(empty)'}`);
    if (!item.title || !item.category) throw new Error(`条目字段缺失：${item.id}`);
    if (!SOURCES.includes(item.source)) throw new Error(`未知来源 ${item.source}：${item.id}`);
    if (!/^https?:\/\//.test(item.url)) throw new Error(`非法 URL：${item.id}`);
    ids.add(item.id);
  }

  console.log(`[validate:data] 通过：${data.items.length} 条，${ids.size} 个唯一 ID`);
}

main().catch((error) => {
  console.error(`[validate:data] 失败：${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
