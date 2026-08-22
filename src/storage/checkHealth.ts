import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { healthGateFailures } from '../sourceHealth';
import { SOURCE_META, type FeedData, type SourceHealth } from '../types';

function statusLabel(entry: SourceHealth): string {
  switch (entry.status) {
    case 'healthy':
      return '✅ healthy';
    case 'stale':
      return '♻️ stale';
    case 'degraded':
      return '⚠️ degraded';
    default:
      return '❌ failed';
  }
}

function markdownTable(health: SourceHealth[]): string {
  const rows = health.map((entry) => [
    SOURCE_META[entry.source].label,
    statusLabel(entry),
    `${entry.currentCount} / ${entry.minCount}`,
    String(entry.publishedCount),
    entry.fallbackUsed ? `是（${entry.staleFrom ?? 'unknown'}）` : '否',
    `${entry.consecutiveFailures} / ${entry.maxConsecutiveFailures}`,
    entry.critical ? '是' : '否',
  ]);
  return [
    '## DailyPulse 来源健康',
    '',
    '| 来源 | 状态 | 当前 / 门槛 | 发布条数 | 历史保底 | 连续失败 / 上限 | 关键来源 |',
    '| --- | --- | ---: | ---: | --- | ---: | --- |',
    ...rows.map((row) => `| ${row.join(' | ')} |`),
    '',
  ].join('\n');
}

async function main(): Promise<void> {
  const filePath = path.resolve(process.cwd(), 'data/daily.json');
  const data = JSON.parse(await readFile(filePath, 'utf-8')) as FeedData;
  const health = data.sourceHealth ?? [];
  if (!health.length) {
    console.warn('[check:health] 当前数据没有 sourceHealth，跳过健康门禁。');
    return;
  }

  const report = markdownTable(health);
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, report + '\n', 'utf-8');
  }

  const failures = healthGateFailures(health);
  if (failures.length) {
    throw new Error(
      `关键来源超过连续失败上限：${failures.map((entry) => `${entry.source}(${entry.consecutiveFailures})`).join(', ')}`,
    );
  }
  console.log('[check:health] 通过');
}

main().catch((error) => {
  console.error(`[check:health] 失败：${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
