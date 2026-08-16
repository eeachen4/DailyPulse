import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FeedData, FeedItem } from '../types';
import { SOURCE_META } from '../types';
import { CATEGORIES, CATEGORY_META } from '../categories';

/**
 * 生成最终静态页面 dist/index.html：
 *   - 若 dist/index.html 已由 Vite 构建生成，则把数据序列化后注入到
 *     window.__DAILY_DATA__，供前端 React 组件读取（无需二次请求）。
 *   - 若尚未构建，则直接生成一个独立的静态 HTML（内联样式 + 服务端渲染），
 *     保证「只跑 npm run fetch」也能产出可浏览的页面。
 */
export async function generateHtml(): Promise<string> {
  const data = await readData();
  const distDir = path.resolve(process.cwd(), 'dist');
  const indexPath = path.join(distDir, 'index.html');

  let html: string;
  let injected = false;
  try {
    html = await readFile(indexPath, 'utf-8');
    // 先移除历史注入，保证重复运行不会累积多份数据脚本
    html = html.replace(INJECTED_SCRIPT_RE, '');
    const headRe = /<head([^>]*)>/i;
    if (headRe.test(html)) {
      html = html.replace(headRe, `<head$1>\n    ${dataScript(data)}`);
    } else {
      html = `${dataScript(data)}\n${html}`;
    }
    injected = true;
  } catch {
    html = renderStandalone(data);
    await mkdir(distDir, { recursive: true });
  }

  await writeFile(indexPath, html, 'utf-8');
  console.log(`[generateHtml] ${injected ? '已注入数据到' : '已生成独立静态页'} dist/index.html`);
  return indexPath;
}

async function readData(): Promise<FeedData> {
  const p = path.resolve(process.cwd(), 'data/daily.json');
  try {
    const raw = await readFile(p, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<FeedData>;
    return {
      fetchedAt: parsed.fetchedAt ?? null,
      isSample: parsed.isSample,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    return { fetchedAt: null, items: [] };
  }
}

function dataScript(data: FeedData): string {
  // 转义 "<" 防止序列化结果中的 "</script>" 提前闭合标签
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<script>window.__DAILY_DATA__ = ${json};</script>`;
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
  const meta = SOURCE_META[item.source];
  const cat = CATEGORY_META[item.category] ?? { label: item.category, emoji: '🏷️', hex: '#64748b' };
  const thumb = item.thumbnail
    ? `<img class="thumb" src="${escapeHtml(item.thumbnail)}" loading="lazy" onerror="this.style.display='none'" alt="">`
    : `<div class="thumb emoji">${cat.emoji}</div>`;
  const rank = item.rank !== undefined ? `<span class="rank">#${item.rank}</span>` : '';
  const score =
    item.score !== undefined
      ? `<span class="score">${fmtNum(item.score)} <i>${escapeHtml(meta.scoreLabel)}</i></span>`
      : '';
  const desc = item.description ? `<p class="desc">${escapeHtml(item.description)}</p>` : '';
  const tags =
    item.tags && item.tags.length
      ? `<div class="tags">${item.tags
          .slice(0, 3)
          .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
          .join('')}</div>`
      : '';
  const time = item.publishedAt ? `<span class="time">${fmtDate(item.publishedAt)}</span>` : '';

  return `
      <a class="card" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
        ${thumb}
        <div class="card-body">
          <div class="meta">
            <span class="badge" style="background:${meta.hex}1a;color:${meta.hex}">${escapeHtml(meta.label)}</span>
            <span class="badge" style="background:${cat.hex}1a;color:${cat.hex}">${cat.emoji} ${escapeHtml(cat.label)}</span>
            ${rank}
          </div>
          <h3>${escapeHtml(item.title)}</h3>
          ${desc}
          ${tags}
          <div class="foot">${score}${time}</div>
        </div>
      </a>`;
}

function countByCategory(items: FeedItem[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const cat of CATEGORIES) c[cat.label] = 0;
  for (const it of items) c[it.category] = (c[it.category] ?? 0) + 1;
  return c;
}

function renderStandalone(data: FeedData): string {
  const cards = data.items.map(renderCard).join('');
  const counts = countByCategory(data.items);
  const stats = CATEGORIES.map(
    (c) => `
        <div class="stat">
          <span class="stat-label"><i class="dot" style="background:${c.hex}"></i>${c.emoji} ${c.label}</span>
          <span class="stat-num">${counts[c.label] ?? 0}</span>
        </div>`,
  ).join('');

  const fetched = data.fetchedAt ? `<p class="fetched">采集时间：${fmtDate(data.fetchedAt)}</p>` : '';
  const sample = data.isSample ? '<span class="sample">示例数据</span>' : '';

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DailyPulse · 每日全球热点</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
             background: #f8fafc; color: #0f172a; line-height: 1.5; -webkit-font-smoothing: antialiased; }
      .wrap { max-width: 960px; margin: 0 auto; padding: 32px 16px 48px; }
      header { display: flex; align-items: center; gap: 12px; }
      .logo { width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg,#2563eb,#4f46e5);
              color: #fff; font-weight: 800; font-size: 18px; display: flex; align-items: center; justify-content: center; }
      h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
      .sub { color: #64748b; font-size: 14px; }
      .sample { display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 999px;
                background: #fef3c7; color: #b45309; font-size: 12px; font-weight: 500; }
      .fetched { margin-top: 12px; color: #94a3b8; font-size: 13px; }
      .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 20px 0; }
      .stat { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; }
      .stat-label { display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 13px; }
      .dot { width: 8px; height: 8px; border-radius: 50%; }
      .stat-num { display: block; font-size: 24px; font-weight: 700; margin-top: 4px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
      .card { display: flex; gap: 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;
              padding: 14px; text-decoration: none; color: inherit; transition: box-shadow .15s, transform .15s; }
      .card:hover { box-shadow: 0 6px 18px rgba(15,23,42,.08); transform: translateY(-2px); }
      .thumb { width: 52px; height: 52px; flex: none; border-radius: 12px; background: #f1f5f9; object-fit: cover; }
      .emoji { display: flex; align-items: center; justify-content: center; font-size: 24px; }
      .card-body { min-width: 0; flex: 1; }
      .meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .badge { padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
      .rank { color: #94a3b8; font-size: 12px; font-weight: 600; }
      h3 { font-size: 15px; font-weight: 600; margin-top: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .desc { color: #64748b; font-size: 13px; margin-top: 2px; display: -webkit-box; -webkit-line-clamp: 2;
              -webkit-box-orient: vertical; overflow: hidden; }
      .tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
      .tag { background: #f1f5f9; color: #64748b; font-size: 11px; padding: 1px 6px; border-radius: 6px; }
      .foot { display: flex; gap: 12px; margin-top: 8px; color: #64748b; font-size: 12px; }
      .score { font-weight: 600; color: #334155; } .score i { font-style: normal; color: #94a3b8; }
      .empty { border: 1px dashed #cbd5e1; border-radius: 16px; background: #fff; padding: 48px 16px;
               text-align: center; color: #64748b; }
      footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 32px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header>
        <div class="logo">DP</div>
        <div>
          <h1>DailyPulse ${sample}</h1>
          <div class="sub">每日全球热点「信息早餐」</div>
        </div>
      </header>
      ${fetched}
      <div class="stats">${stats}</div>
      ${data.items.length ? `<div class="grid">${cards}</div>` : '<div class="empty">暂无采集数据，请配置 APIFY_API_KEY 后运行 npm run fetch。</div>'}
      <footer>DailyPulse · 每天 08:00 (UTC+8) 自动更新 · 数据来源：App Store / Google Play / Product Hunt / Reddit</footer>
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
