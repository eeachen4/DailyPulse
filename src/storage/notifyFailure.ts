import axios from 'axios';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { SOURCE_META, type FeedData } from '../types';

async function healthSummary(): Promise<string> {
  try {
    const data = JSON.parse(await readFile(path.resolve(process.cwd(), 'data/daily.json'), 'utf-8')) as FeedData;
    const unhealthy = (data.sourceHealth ?? []).filter((entry) => entry.status !== 'healthy');
    if (!unhealthy.length) return '未生成可用的来源健康明细。';
    return unhealthy.map((entry) => {
      const categories = entry.categories?.filter((category) => category.status !== 'healthy').map((category) => category.categoryId).join(', ');
      return `${SOURCE_META[entry.source].label}: ${entry.status}, 连续 ${entry.consecutiveFailures} 次${categories ? `, 类别 ${categories}` : ''}`;
    }).join('\n');
  } catch {
    return '未能读取 data/daily.json。';
  }
}

async function main(): Promise<void> {
  const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : undefined;
  const text = [
    'DailyPulse 每日采集失败',
    `时间：${new Date().toISOString()}`,
    await healthSummary(),
    runUrl ? `运行：${runUrl}` : undefined,
  ].filter(Boolean).join('\n');
  const deliveries: Promise<unknown>[] = [];

  if (process.env.ALERT_WEBHOOK_URL) {
    deliveries.push(axios.post(process.env.ALERT_WEBHOOK_URL, { text, content: text }, { timeout: 20_000 }));
  }
  if (process.env.FEISHU_WEBHOOK_URL) {
    deliveries.push(axios.post(process.env.FEISHU_WEBHOOK_URL, {
      msg_type: 'text',
      content: { text },
    }, { timeout: 20_000 }));
  }
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    deliveries.push(axios.post(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      { chat_id: process.env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true },
      { timeout: 20_000 },
    ));
  }
  if (!deliveries.length) {
    console.log('[notify:failure] 未配置告警通道，跳过外部通知');
    return;
  }
  const results = await Promise.allSettled(deliveries);
  const failed = results.filter((result) => result.status === 'rejected');
  if (failed.length === results.length) throw new Error('所有外部告警通道均发送失败');
  console.log(`[notify:failure] 已发送 ${results.length - failed.length}/${results.length} 个告警`);
}

main().catch((error) => {
  console.error(`[notify:failure] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
