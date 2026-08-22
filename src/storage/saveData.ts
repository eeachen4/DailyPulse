import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  canonicalizeItems,
  detailForItem,
  detailSlug,
  hasDetail,
  toDetailFile,
  toSummary,
  withHeatScores,
} from '../dataModel';
import { DATA_SCHEMA_VERSION, type FeedData, type FeedItem, type FetchRun, type SourceHealth } from '../types';

/**
 * 将采集结果规范化后写入轻量摘要、详情文件和每日历史快照。
 */
export async function saveData(
  items: FeedItem[],
  fetchedAt: string,
  runs: FetchRun[] = [],
  sourceHealth: SourceHealth[] = [],
): Promise<string> {
  const canonicalItems = withHeatScores(canonicalizeItems(items));
  const summaries = canonicalItems.map(toSummary);
  const data: FeedData = {
    schemaVersion: DATA_SCHEMA_VERSION,
    fetchedAt,
    isSample: false,
    items: summaries,
    runs,
    sourceHealth,
  };
  const dataDir = path.resolve(process.cwd(), 'data');
  await mkdir(dataDir, { recursive: true });
  const filePath = path.join(dataDir, 'daily.json');

  const detailDir = path.join(dataDir, 'details');
  await mkdir(detailDir, { recursive: true });
  await Promise.all(
    canonicalItems
      // 历史保底条目是轻量摘要，不能用它覆盖原有完整详情文件。
      .filter((item) => !item.stale && hasDetail(detailForItem(item)))
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
  entries = await pruneHistory(historyDir, entries, fetchedAt);
  await writeJsonAtomic(indexPath, entries);
  await pruneDetails(detailDir, data, historyDir, entries);

  return filePath;
}

function retentionCutoff(fetchedAt: string): string {
  const configured = Number(process.env.DATA_RETENTION_DAYS || 30);
  const retentionDays = Number.isFinite(configured) ? Math.max(0, configured) : 30;
  const cutoff = new Date(new Date(fetchedAt).getTime() - retentionDays * 24 * 60 * 60 * 1_000);
  return cutoff.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
}

async function pruneHistory(
  historyDir: string,
  entries: Array<{ date: string; fetchedAt: string; count: number; path: string }>,
  fetchedAt: string,
): Promise<typeof entries> {
  const cutoff = retentionCutoff(fetchedAt);
  const retained = entries.filter((entry) => entry.date >= cutoff);
  const removed = entries.filter((entry) => entry.date < cutoff);
  await Promise.all(removed.map(async (entry) => {
    try {
      await unlink(path.join(historyDir, entry.path));
    } catch {
      // 文件已不存在时无需中断采集。
    }
  }));
  if (removed.length) console.log(`[storage] 已清理 ${removed.length} 份过期历史快照（保留 ${cutoff} 之后）`);
  return retained;
}

function addDetailRefs(data: FeedData, referenced: Set<string>): void {
  for (const item of data.items) {
    if (item.detailRef) referenced.add(path.basename(item.detailRef));
  }
}

async function pruneDetails(
  detailDir: string,
  current: FeedData,
  historyDir: string,
  entries: Array<{ path: string }>,
): Promise<void> {
  const referenced = new Set<string>();
  addDetailRefs(current, referenced);
  for (const entry of entries) {
    try {
      const snapshot = JSON.parse(await readFile(path.join(historyDir, entry.path), 'utf-8')) as FeedData;
      addDetailRefs(snapshot, referenced);
    } catch {
      console.warn(`[storage] 无法读取历史快照 ${entry.path}，为避免误删，本轮跳过详情清理`);
      return;
    }
  }

  const files = (await readdir(detailDir)).filter((file) => file.endsWith('.json'));
  const staleFiles = files.filter((file) => !referenced.has(file));
  await Promise.all(staleFiles.map((file) => unlink(path.join(detailDir, file))));
  if (staleFiles.length) console.log(`[storage] 已清理 ${staleFiles.length} 个无引用详情文件`);
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tempPath = filePath + '.tmp';
  await writeFile(tempPath, JSON.stringify(value, null, 2) + '\n', 'utf-8');
  await rename(tempPath, filePath);
}
