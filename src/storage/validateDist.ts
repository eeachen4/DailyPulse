import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { FeedData } from '../types';

async function main(): Promise<void> {
  const distDir = path.resolve(process.cwd(), 'dist');
  const indexPath = path.join(distDir, 'index.html');
  const index = await readFile(indexPath, 'utf-8');
  const indexSize = (await stat(indexPath)).size;
  const maxIndexBytes = Number(process.env.MAX_INDEX_HTML_BYTES || 100_000);
  if (indexSize > maxIndexBytes) throw new Error(`index.html 过大：${indexSize} > ${maxIndexBytes}`);
  if (/window\.__DAILY_DATA__\s*=/.test(index)) throw new Error('index.html 不应重新内联完整快照');

  const feed = JSON.parse(await readFile(path.join(distDir, 'feed.json'), 'utf-8')) as FeedData;
  if (!Array.isArray(feed.items) || feed.items.length === 0) throw new Error('dist/feed.json 没有数据');
  const metrics = JSON.parse(await readFile(path.join(distDir, 'metrics.json'), 'utf-8')) as { totalItems?: number };
  if (metrics.totalItems !== feed.items.length) throw new Error('metrics.json 与 feed.json 条目数不一致');
  await access(path.join(distDir, 'rss.xml'));

  const assetRefs = [...index.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g)].map((match) => match[1]);
  await Promise.all(assetRefs.filter((asset) => asset.startsWith('assets/')).map((asset) => access(path.join(distDir, asset))));
  console.log(`[validate:dist] 通过：index ${indexSize} bytes，feed ${feed.items.length} 条，资源 ${assetRefs.length} 个`);
}

main().catch((error) => {
  console.error(`[validate:dist] 失败：${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
