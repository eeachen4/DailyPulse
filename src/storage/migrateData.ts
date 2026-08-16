import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  canonicalizeItems,
  detailSlug,
  toDetailFile,
  toSummary,
  withHeatScores,
} from '../dataModel';
import { DATA_SCHEMA_VERSION, type FeedData } from '../types';

async function main(): Promise<void> {
  const dataDir = path.resolve(process.cwd(), 'data');
  const sourcePath = path.join(dataDir, 'daily.json');
  const oldData = JSON.parse(await readFile(sourcePath, 'utf-8')) as FeedData;
  if (oldData.schemaVersion === DATA_SCHEMA_VERSION && oldData.items.every((item) => item.detailRef)) {
    console.log('[migrate:data] daily.json 已是 v2 摘要格式，无需重复迁移');
    return;
  }
  const items = withHeatScores(canonicalizeItems(oldData.items ?? []));
  const summaries = items.map(toSummary);
  const data: FeedData = {
    schemaVersion: DATA_SCHEMA_VERSION,
    fetchedAt: oldData.fetchedAt ?? new Date().toISOString(),
    isSample: oldData.isSample,
    items: summaries,
    runs: oldData.runs,
  };

  const detailsDir = path.join(dataDir, 'details');
  await mkdir(detailsDir, { recursive: true });
  await Promise.all(
    items.map((item) =>
      writeJsonAtomic(path.join(detailsDir, detailSlug(item.id) + '.json'), toDetailFile(item)),
    ),
  );
  await writeJsonAtomic(sourcePath, data);

  const historyDir = path.join(dataDir, 'history');
  await mkdir(historyDir, { recursive: true });
  const date = new Date(data.fetchedAt ?? Date.now()).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Shanghai',
  });
  await writeJsonAtomic(path.join(historyDir, date + '.json'), data);
  await writeJsonAtomic(path.join(historyDir, 'index.json'), [
    { date, fetchedAt: data.fetchedAt, count: summaries.length, path: date + '.json' },
  ]);

  console.log('[migrate:data] 已迁移 ' + items.length + ' 条摘要和详情文件');
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tempPath = filePath + '.tmp';
  await writeFile(tempPath, JSON.stringify(value, null, 2) + '\n', 'utf-8');
  await rename(tempPath, filePath);
}

main().catch((error) => {
  console.error('[migrate:data] 失败：', error instanceof Error ? error.message : error);
  process.exit(1);
});
