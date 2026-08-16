import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FeedData } from '../types';
import { DATA_SCHEMA_VERSION, SOURCES } from '../types';
import { categoryIdsFor } from '../dataModel';

async function main(): Promise<void> {
  const filePath = path.resolve(process.cwd(), 'data/daily.json');
  const data = JSON.parse(await readFile(filePath, 'utf-8')) as FeedData;
  if (data.schemaVersion !== DATA_SCHEMA_VERSION) {
    throw new Error(`schemaVersion 必须为 ${DATA_SCHEMA_VERSION}，当前为 ${data.schemaVersion ?? '(missing)'}`);
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('daily.json 没有任何条目');
  }

  const ids = new Set<string>();
  for (const item of data.items) {
    if (!item.id || ids.has(item.id)) throw new Error(`ID 缺失或重复：${item.id || '(empty)'}`);
    if (!item.title || categoryIdsFor(item).length === 0) throw new Error(`条目字段缺失：${item.id}`);
    if (!SOURCES.includes(item.source)) throw new Error(`未知来源 ${item.source}：${item.id}`);
    if (!/^https?:\/\//.test(item.url)) throw new Error(`非法 URL：${item.id}`);
    if (item.heatScore !== undefined && (item.heatScore < 0 || item.heatScore > 100)) {
      throw new Error(`heatScore 超出范围：${item.id}`);
    }
    if (item.detailRef) {
      try {
        await access(path.resolve(process.cwd(), 'data', item.detailRef));
      } catch {
        throw new Error(`详情文件不存在：${item.id} -> ${item.detailRef}`);
      }
    }
    ids.add(item.id);
  }

  for (const run of data.runs ?? []) {
    if (!SOURCES.includes(run.source) || !run.categoryId || !run.status) {
      throw new Error(`采集批次记录不完整：${JSON.stringify(run)}`);
    }
  }

  console.log(`[validate:data] 通过：${data.items.length} 条，${ids.size} 个唯一 ID`);
}

main().catch((error) => {
  console.error(`[validate:data] 失败：${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
