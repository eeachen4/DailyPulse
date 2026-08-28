import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { CATEGORIES } from './categories';
import { fetchAppStore } from './fetch/appStore';
import { fetchGooglePlay } from './fetch/googlePlay';
import { fetchProductHunt } from './fetch/productHunt';
import { fetchReddit } from './fetch/reddit';
import { fetchBluesky } from './fetch/bluesky';
import { fetchMastodon } from './fetch/mastodon';
import { fetchGdelt } from './fetch/gdelt';
import { fetchHackerNews } from './fetch/hackerNews';
import { fetchGitHub } from './fetch/github';
import { fetchHuggingFace } from './fetch/huggingFace';
import { fetchStackOverflow } from './fetch/stackOverflow';
import { fetchArxiv } from './fetch/arxiv';
import { fetchRss } from './fetch/rss';
import { enrichFeed } from './fetch/detailScraper';
import { saveData } from './storage/saveData';
import { generateHtml } from './storage/generateHtml';
import { applySourceHealth } from './sourceHealth';
import { translateFeedItems } from './translation';
import type { FeedItem, FetchRun } from './types';

/**
 * 主入口：按「类别 × 数据源」顺序采集 -> 合并 -> 写入 JSON -> 生成静态页面。
 * 每个源独立 try-catch，单个源失败不会导致整体崩溃。
 */
export async function main(): Promise<void> {
  const apiKey = process.env.APIFY_API_KEY || '';
  const phToken = process.env.PRODUCT_HUNT_TOKEN || process.env.PH_DEVELOPER_TOKEN || '';
  if (!phToken && !apiKey) {
    console.warn('⚠️  未配置 PRODUCT_HUNT_TOKEN / APIFY_API_KEY，Product Hunt 将被跳过（其余源不受影响）。');
  }
  if (!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET) && !process.env.REDDIT_PROXY) {
    console.warn('⚠️  未配置 Reddit OAuth 或 REDDIT_PROXY；CI 数据中心出口可能持续 403。');
  }
  if (!(process.env.BSKY_IDENTIFIER && process.env.BSKY_APP_PASSWORD)) {
    console.warn('⚠️  未配置 Bluesky App Password；公共 AppView 受限时将降级为 Jetstream 近期关键词流（无互动排行）。');
  }
  if (!(process.env.GITHUB_API_TOKEN || process.env.GITHUB_TOKEN)) {
    console.warn('⚠️  未配置 GitHub Token，将使用较低的匿名 API 限额。');
  }

  console.log(`DailyPulse 开始采集…（${new Date().toISOString()}）`);

  const collected: FeedItem[] = [];
  const runs: FetchRun[] = [];
  for (const category of CATEGORIES) {
    console.log(`\n▶ 类别「${category.label}」`);
    const tasks: Array<[string, () => Promise<FeedItem[]>]> = [
      ['appstore', () => fetchAppStore(category)],
      ['googleplay', () => fetchGooglePlay(category)],
      ['producthunt', () => fetchProductHunt(apiKey, category)],
      ['reddit', () => fetchReddit(category)],
      ['bluesky', () => fetchBluesky(category)],
      ['mastodon', () => fetchMastodon(category)],
      ['gdelt', () => fetchGdelt(category)],
      ['hackernews', () => fetchHackerNews(category)],
      ['github', () => fetchGitHub(category)],
      ['huggingface', () => fetchHuggingFace(category)],
      ['stackoverflow', () => fetchStackOverflow(category)],
      ['arxiv', () => fetchArxiv(category)],
      ['rss', () => fetchRss(category)],
    ];
    for (const [source, fn] of tasks) {
      const startedAt = Date.now();
      const runFetchedAt = new Date().toISOString();
      try {
        const items = await fn();
        runs.push({
          source: source as FetchRun['source'],
          categoryId: category.id,
          fetchedAt: runFetchedAt,
          status: items.length > 0 ? 'success' : 'partial',
          count: items.length,
          durationMs: Date.now() - startedAt,
        });
        console.log(`[${category.label}/${source}] ✅ 采集 ${items.length} 条`);
        collected.push(...items);
      } catch (err) {
        runs.push({
          source: source as FetchRun['source'],
          categoryId: category.id,
          fetchedAt: runFetchedAt,
          status: 'failed',
          count: 0,
          durationMs: Date.now() - startedAt,
          error: err instanceof Error ? err.message : String(err),
        });
        console.error(
          `[${category.label}/${source}] ❌ 采集失败：`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  const healthResult = await applySourceHealth(collected, runs);
  for (const entry of healthResult.health) {
    const fallback = entry.fallbackUsed ? `，回退 ${entry.publishedCount} 条` : '';
    console.log(
      `[health/${entry.source}] ${entry.status} · 当前 ${entry.currentCount}/${entry.minCount}${fallback} · 连续失败 ${entry.consecutiveFailures}`,
    );
  }

  // 当前数据和历史保底都为空时，禁止覆盖上一份 daily.json。
  if (healthResult.currentItems.length === 0 && healthResult.fallbackItems.length === 0) {
    throw new Error('本次采集没有得到任何数据，且没有可用历史保底，已保留上一份 daily.json');
  }

  // 从来源网页抓取详情（完整描述 / 截图 / 评分等），可关闭
  let currentItems = healthResult.currentItems;
  if (process.env.SCRAPE_DETAILS !== 'false' && currentItems.length > 0) {
    console.log(`[scrape] 开始从来源网站抓取详情（${currentItems.length} 条）…`);
    currentItems = await enrichFeed(currentItems);
    console.log('[scrape] 详情抓取完成');
  }
  const allItems = await translateFeedItems([...currentItems, ...healthResult.fallbackItems]);

  const fetchedAt = new Date().toISOString();
  const filePath = await saveData(allItems, fetchedAt, runs, healthResult.health);
  console.log(`✅ 已保存 ${allItems.length} 条数据到 ${filePath}`);

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
