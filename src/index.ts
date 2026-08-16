import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { CATEGORIES } from './categories';
import { fetchAppStore } from './fetch/appStore';
import { fetchGooglePlay } from './fetch/googlePlay';
import { fetchProductHunt } from './fetch/productHunt';
import { fetchReddit } from './fetch/reddit';
import { saveData } from './storage/saveData';
import { generateHtml } from './storage/generateHtml';
import type { FeedItem } from './types';

async function safeFetch(label: string, fn: () => Promise<FeedItem[]>): Promise<FeedItem[]> {
  try {
    const items = await fn();
    console.log(`[${label}] ✅ 采集 ${items.length} 条`);
    return items;
  } catch (err) {
    console.error(`[${label}] ❌ 采集失败：`, err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * 主入口：按「类别 × 数据源」顺序采集 -> 合并 -> 写入 JSON -> 生成静态页面。
 * 每个源独立 try-catch，单个源失败不会导致整体崩溃。
 */
export async function main(): Promise<void> {
  const apiKey = process.env.APIFY_API_KEY || '';
  if (!apiKey) {
    console.warn('⚠️  未配置 APIFY_API_KEY，App Store / Google Play / Product Hunt 将被跳过（仅 Reddit 可用）。');
  }

  console.log(`DailyPulse 开始采集…（${new Date().toISOString()}）`);

  const collected: FeedItem[] = [];
  for (const category of CATEGORIES) {
    console.log(`\n▶ 类别「${category.label}」`);
    const tasks: Array<[string, boolean, () => Promise<FeedItem[]>]> = [
      ['appstore', true, () => fetchAppStore(apiKey, category)],
      ['googleplay', true, () => fetchGooglePlay(apiKey, category)],
      ['producthunt', true, () => fetchProductHunt(apiKey, category)],
      ['reddit', false, () => fetchReddit(category)],
    ];
    for (const [source, needsKey, fn] of tasks) {
      if (needsKey && !apiKey) {
        console.warn(`[${category.label}/${source}] ⚠️ 跳过（未配置 APIFY_API_KEY）`);
        continue;
      }
      collected.push(...(await safeFetch(`${category.label}/${source}`, fn)));
    }
  }

  const fetchedAt = new Date().toISOString();
  const filePath = await saveData(collected, fetchedAt);
  console.log(`✅ 已保存 ${collected.length} 条数据到 ${filePath}`);

  await generateHtml();
  console.log('✅ DailyPulse 采集与生成完成。');
}

/* 作为脚本直接运行时执行 */
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  main().catch((err) => {
    console.error('DailyPulse 运行失败：', err);
    process.exit(1);
  });
}
