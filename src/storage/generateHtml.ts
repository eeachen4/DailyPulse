import { readFile, writeFile, mkdir, readdir, copyFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FeedData, FeedItem } from '../types';
import { SOURCES, SOURCE_META } from '../types';
import { CATEGORIES, CATEGORY_META_BY_ID } from '../categories';
import { categoryIdsFor, primaryCategoryId, rawScoreFor } from '../dataModel';

/**
 * 生成最终静态页面 dist/index.html：
 *   - 若 dist/index.html 已由 Vite 构建生成，则移除旧版内联数据；前端异步读取
 *     feed.json，避免 1MB+ JSON 阻塞 HTML 解析和首屏资源发现。
 *   - 若尚未构建，则直接生成一个独立的静态 HTML（内联样式 + 服务端渲染），
 *     保证「只跑 npm run fetch」也能产出可浏览的页面。
 */
export async function generateHtml(): Promise<string> {
  const data = await readData();
  const distDir = path.resolve(process.cwd(), 'dist');
  const indexPath = path.join(distDir, 'index.html');

  let html: string;
  let builtApp = false;
  try {
    html = await readFile(indexPath, 'utf-8');
    // 先移除历史注入，保证重复运行不会累积多份数据脚本
    html = html.replace(INJECTED_SCRIPT_RE, '');
    builtApp = true;
  } catch {
    html = renderStandalone(data);
    await mkdir(distDir, { recursive: true });
  }

  await writeFile(indexPath, html, 'utf-8');
  await syncHistory(distDir);
  await syncDetails(distDir);
  await writeExports(distDir, data);
  console.log(`[generateHtml] ${builtApp ? '已生成轻量应用入口' : '已生成独立静态页'} dist/index.html`);
  return indexPath;
}

async function syncHistory(distDir: string): Promise<void> {
  const sourceDir = path.resolve(process.cwd(), 'data/history');
  const targetDir = path.join(distDir, 'history');
  try {
    const files = (await readdir(sourceDir)).filter((file) => file.endsWith('.json'));
    await mkdir(targetDir, { recursive: true });
    await removeExtraJsonFiles(targetDir, new Set(files));
    await Promise.all(files.map((file) => copyFile(path.join(sourceDir, file), path.join(targetDir, file))));
    console.log('[generateHtml] 已同步 ' + files.length + ' 份历史快照');
  } catch {
    // 历史目录在首次采集前不存在，不影响当前页面生成。
  }
}

async function syncDetails(distDir: string): Promise<void> {
  const sourceDir = path.resolve(process.cwd(), 'data/details');
  const targetDir = path.join(distDir, 'details');
  try {
    const files = (await readdir(sourceDir)).filter((file) => file.endsWith('.json'));
    await mkdir(targetDir, { recursive: true });
    await removeExtraJsonFiles(targetDir, new Set(files));
    await Promise.all(files.map((file) => copyFile(path.join(sourceDir, file), path.join(targetDir, file))));
    console.log('[generateHtml] 已同步 ' + files.length + ' 个详情文件');
  } catch {
    // 首次采集前没有详情目录，不影响当前页面生成。
  }
}

async function removeExtraJsonFiles(targetDir: string, expected: Set<string>): Promise<void> {
  const existing = (await readdir(targetDir)).filter((file) => file.endsWith('.json'));
  await Promise.all(existing.filter((file) => !expected.has(file)).map((file) => unlink(path.join(targetDir, file))));
}

async function readData(): Promise<FeedData> {
  const p = path.resolve(process.cwd(), 'data/daily.json');
  try {
    const raw = await readFile(p, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<FeedData>;
    return {
      schemaVersion: parsed.schemaVersion,
      fetchedAt: parsed.fetchedAt ?? null,
      isSample: parsed.isSample,
      items: Array.isArray(parsed.items) ? parsed.items : [],
      runs: Array.isArray(parsed.runs) ? parsed.runs : undefined,
      sourceHealth: Array.isArray(parsed.sourceHealth) ? parsed.sourceHealth : undefined,
      topics: Array.isArray(parsed.topics) ? parsed.topics : undefined,
      brief: parsed.brief,
    };
  } catch {
    return { fetchedAt: null, items: [] };
  }
}

function xmlEscape(value: string): string {
  return value.replace(/[<>&"']/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  })[character] ?? character);
}

async function writeExports(distDir: string, data: FeedData): Promise<void> {
  // 生产数据单独缓存与传输；保持单行可进一步降低未压缩体积。
  await writeFile(path.join(distDir, 'feed.json'), JSON.stringify(data) + '\n', 'utf-8');
  const sourceCounts = Object.fromEntries(SOURCES.map((source) => [
    source,
    data.items.filter((item) => item.source === source).length,
  ]));
  const metrics = {
    fetchedAt: data.fetchedAt,
    totalItems: data.items.length,
    activeSources: Object.values(sourceCounts).filter((count) => count > 0).length,
    sourceCounts,
    translatedTitles: data.items.filter((item) => Boolean(item.titleZh)).length,
    descriptionCoverage: Number((data.items.filter((item) => Boolean(item.description)).length / Math.max(1, data.items.length)).toFixed(4)),
    thumbnailCoverage: Number((data.items.filter((item) => Boolean(item.thumbnail)).length / Math.max(1, data.items.length)).toFixed(4)),
    publishedAtCoverage: Number((data.items.filter((item) => Boolean(item.publishedAt)).length / Math.max(1, data.items.length)).toFixed(4)),
    topicCount: data.topics?.length ?? 0,
    crossSourceTopics: data.topics?.filter((topic) => topic.sources.length > 1).length ?? 0,
  };
  await writeFile(path.join(distDir, 'metrics.json'), JSON.stringify(metrics, null, 2) + '\n', 'utf-8');
  const siteUrl = (process.env.SITE_URL || 'https://eeachen4.github.io/DailyPulse/').replace(/\/?$/, '/');
  const entries = [...data.items]
    .sort((left, right) => (right.heatScore ?? 0) - (left.heatScore ?? 0))
    .slice(0, 100)
    .map((item) => `    <item>
      <title>${xmlEscape(item.titleZh ?? item.title)}</title>
      <link>${xmlEscape(item.url)}</link>
      <guid isPermaLink="false">${xmlEscape(item.id)}</guid>
${item.publishedAt ? `      <pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate>\n` : ''}      <description>${xmlEscape(item.descriptionZh ?? item.description ?? '')}</description>
      <category>${xmlEscape(item.category ?? item.categoryId ?? '')}</category>
    </item>`)
    .join('\n');
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>DailyPulse</title>
    <link>${xmlEscape(siteUrl)}</link>
    <description>Daily global product, developer and AI signals.</description>
    <lastBuildDate>${new Date(data.fetchedAt ?? Date.now()).toUTCString()}</lastBuildDate>
${entries}
  </channel>
</rss>
`;
  await writeFile(path.join(distDir, 'rss.xml'), rss, 'utf-8');
  console.log('[generateHtml] 已生成 feed.json、metrics.json 与 rss.xml');
}

// 匹配此前注入的数据脚本，用于幂等清理（序列化后不含 "</script>"，故可安全非贪婪匹配）
const INJECTED_SCRIPT_RE = /<script>\s*window\.__DAILY_DATA__\s*=\s*[\s\S]*?<\/script>/g;

/* ------------------------------ 独立静态页 ------------------------------ */

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function fmtNum(n?: number): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function renderCard(item: FeedItem): string {
  item = { ...item, score: item.heatScore, rating: item.metrics?.rating ?? item.rating };
  const meta = SOURCE_META[item.source];
  const cat = CATEGORY_META_BY_ID[primaryCategoryId(item)] ?? { label: primaryCategoryId(item), emoji: '', hex: '#6E675A' };
  const thumb = item.thumbnail
    ? `<img class="thumb" src="${escapeHtml(item.thumbnail)}" loading="lazy" onerror="this.style.display='none'" alt="">`
    : `<div class="thumb mono">${escapeHtml(meta.short)}</div>`;
  const rank = item.rank !== undefined ? `<span>No.${item.rank}</span>` : '';
  const time = item.publishedAt ? `<span>${fmtDate(item.publishedAt)}</span>` : '';
  const rating = item.rating !== undefined ? `<span>★${item.rating.toFixed(1)}</span>` : '';
  const price = item.price ? `<span>${escapeHtml(item.price)}</span>` : '';
  const desc = item.description
    ? `<p class="desc">${escapeHtml(item.description)}</p>`
    : item.tags && item.tags.length
      ? `<p class="desc mono">${escapeHtml(item.tags.join(' · '))}</p>`
      : '';
  const score =
    item.score !== undefined
      ? `<div class="score"><b>${fmtNum(item.score)}</b><i>${escapeHtml(meta.scoreLabel)}</i></div>`
      : '';

  return `
      <a class="row" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
        ${thumb}
        <div class="body">
          <div class="meta"><b>${escapeHtml(meta.label)}</b><span style="color:${cat.hex}">${escapeHtml(cat.label)}</span>${rank}${rating}${price}${time}</div>
          <h3>${escapeHtml(item.title)}</h3>
          ${desc}
        </div>
        ${score}
      </a>`;
}

function countByCategory(items: FeedItem[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const cat of CATEGORIES) c[cat.id] = 0;
  for (const it of items) {
    for (const categoryId of categoryIdsFor(it)) c[categoryId] = (c[categoryId] ?? 0) + 1;
  }
  return c;
}

function renderStandalone(data: FeedData): string {
  const rows = data.items.map(renderCard).join('');
  const counts = countByCategory(data.items);
  const stats = CATEGORIES.map(
    (c, i) => `
        <div class="stat"${i > 0 ? ' style="border-left:1px solid #E3DDCE"' : ''}>
          <span class="stat-label"><i class="dot" style="background:${c.hex}"></i>${c.label}</span>
          <span class="stat-num">${counts[c.id] ?? 0}</span>
        </div>`,
  ).join('');

  const fetched = data.fetchedAt ? `<span>采集 ${fmtDate(data.fetchedAt)}</span>` : '';
  const sample = data.isSample ? '<span class="sample">示例数据</span>' : '';

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DailyPulse · 每日全球热点</title>
    <!-- Cloudflare Web Analytics -->
    <script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "42f834881a60415bb99371644825e450"}'></script>
    <!-- End Cloudflare Web Analytics -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Sora:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: "Sora", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
             background: #FAF8F3; color: #17150F; line-height: 1.5; -webkit-font-smoothing: antialiased; }
      .mono, .meta, .stat-label, .stat-num, .score, .kicker, .meta-line, footer { font-family: "IBM Plex Mono", ui-monospace, monospace; }
      .wrap { max-width: 900px; margin: 0 auto; padding: 44px 20px 48px; }
      header { border-bottom: 1px solid #E3DDCE; padding-bottom: 28px; }
      .kicker { font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: #6E675A; }
      h1 { font-size: 40px; font-weight: 800; letter-spacing: -0.02em; margin-top: 10px; }
      .sample { font-family: "IBM Plex Mono", monospace; font-size: 11px; font-weight: 400; text-transform: uppercase;
                letter-spacing: .1em; color: #6E675A; border: 1px solid #E3DDCE; padding: 2px 8px; vertical-align: 4px; margin-left: 12px; }
      .meta-line { display: flex; flex-wrap: wrap; gap: 8px 24px; margin-top: 18px; font-size: 12px; color: #6E675A; }
      .meta-line .live { display: inline-flex; align-items: center; gap: 6px; }
      .live i { width: 6px; height: 6px; border-radius: 50%; background: #E8542E; }
      .stats { display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 1px solid #E3DDCE; }
      .stat { padding: 18px 16px; }
      .stat-label { display: flex; align-items: center; gap: 8px; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: #6E675A; }
      .dot { width: 8px; height: 8px; }
      .stat-num { display: block; font-size: 28px; font-weight: 600; margin-top: 6px; }
      .list { border-bottom: 1px solid #E3DDCE; }
      .row { display: flex; align-items: center; gap: 14px; padding: 14px 4px; border-bottom: 1px solid #E3DDCE;
             text-decoration: none; color: inherit; transition: background .12s; }
      .row:last-child { border-bottom: none; }
      .row:hover { background: #F1EDE4; }
      .thumb { width: 44px; height: 44px; flex: none; border: 1px solid #E3DDCE; background: #F1EDE4;
               object-fit: cover; display: flex; align-items: center; justify-content: center;
               font-family: "IBM Plex Mono", monospace; font-size: 11px; font-weight: 600; color: #6E675A; }
      .body { min-width: 0; flex: 1; }
      .meta { display: flex; flex-wrap: wrap; gap: 2px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #6E675A; }
      .meta b { color: #17150F; font-weight: 500; }
      h3 { font-size: 15px; font-weight: 600; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .desc { color: #6E675A; font-size: 13px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .desc.mono { font-size: 12px; }
      .score { flex: none; text-align: right; }
      .score b { display: block; font-size: 18px; font-weight: 600; }
      .score i { font-style: normal; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: #6E675A; }
      .empty { border: 1px solid #E3DDCE; padding: 64px 16px; text-align: center; color: #6E675A; }
      footer { border-top: 1px solid #E3DDCE; margin-top: 40px; padding-top: 20px; text-align: center; font-size: 12px; color: #6E675A; }
      @media (max-width: 640px) {
        h1 { font-size: 32px; }
        .stats { grid-template-columns: repeat(2, 1fr); }
        .stat:nth-child(3) { border-left: none !important; }
        .score i { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header>
        <p class="kicker">Daily Pulse · 每日全球热点「信息早餐」</p>
        <h1>DailyPulse${sample}</h1>
        <div class="meta-line">
          ${fetched}
          <span>共 ${data.items.length} 条</span>
          <span class="live"><i></i>Live</span>
        </div>
      </header>
      <div class="stats">${stats}</div>
      ${data.items.length ? `<div class="list">${rows}</div>` : '<div class="empty">暂无采集数据，请配置 APIFY_API_KEY 后运行 npm run fetch。</div>'}
      <footer>DailyPulse · 每天 08:00 (UTC+8) 自动更新 · ${SOURCES.map((source) => SOURCE_META[source].label).join(' / ')}</footer>
    </div>
  </body>
</html>`;
}

/* ------------------------------ 脚本直跑 ------------------------------ */

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  generateHtml()
    .then((p) => console.log(`[generateHtml] 完成：${p}`))
    .catch((err) => {
      console.error('[generateHtml] 失败：', err);
      process.exit(1);
    });
}
