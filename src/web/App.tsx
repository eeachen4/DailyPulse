import { useEffect, useMemo, useState } from 'react';
import type { FeedData, Source } from '../types';
import { SOURCES } from '../types';
import { CATEGORIES } from '../categories';
import CategoryFilter from './components/CategoryFilter';
import SourceFilter from './components/SourceFilter';
import FeedList from './components/FeedList';
import DetailPage from './components/DetailPage';
import { formatDate } from './format';

type SortKey = 'score' | 'rank' | 'title' | 'publishedAt';

const EMPTY: FeedData = { fetchedAt: null, items: [] };

/** 轻量 hash 路由，兼容 GitHub Pages 子路径（无需服务端配置） */
function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return hash;
}

export default function App() {
  const [data, setData] = useState<FeedData>(() => window.__DAILY_DATA__ ?? EMPTY);
  const [category, setCategory] = useState<string>('all');
  const [source, setSource] = useState<Source | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('score');
  const hash = useHashRoute();

  // 开发模式兜底：若构建产物未注入数据，则尝试相对路径读取 data/daily.json。
  useEffect(() => {
    if (!window.__DAILY_DATA__) {
      fetch('data/daily.json')
        .then((r) => (r.ok ? r.json() : null))
        .then((json: FeedData | null) => {
          if (json && Array.isArray(json.items)) setData(json);
        })
        .catch(() => {
          /* 忽略，保持空状态 */
        });
    }
  }, []);

  const items = useMemo(() => {
    let list = data.items;
    if (category !== 'all') list = list.filter((it) => it.category === category);
    if (source !== 'all') list = list.filter((it) => it.source === source);
    return [...list].sort((a, b) => {
      switch (sort) {
        case 'rank':
          return (a.rank ?? Number.POSITIVE_INFINITY) - (b.rank ?? Number.POSITIVE_INFINITY);
        case 'title':
          return a.title.localeCompare(b.title);
        case 'publishedAt':
          return (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '');
        case 'score':
        default:
          return (b.score ?? Number.NEGATIVE_INFINITY) - (a.score ?? Number.NEGATIVE_INFINITY);
      }
    });
  }, [data, category, source, sort]);

  const categoryCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const cat of CATEGORIES) c[cat.label] = 0;
    for (const it of data.items) c[it.category] = (c[it.category] ?? 0) + 1;
    return c;
  }, [data]);

  const sourceCounts = useMemo(() => {
    const c: Record<Source, number> = { appstore: 0, googleplay: 0, producthunt: 0, reddit: 0 };
    for (const it of data.items) c[it.source] += 1;
    return c;
  }, [data]);

  // 路由解析：列表页 或 详情页 #/item/<id>
  const prefix = '#/item/';
  let selectedId: string | null = null;
  if (hash.startsWith(prefix)) {
    try {
      selectedId = decodeURIComponent(hash.slice(prefix.length));
    } catch {
      selectedId = hash.slice(prefix.length);
    }
  }

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [selectedId]);

  if (selectedId !== null) {
    return (
      <DetailPage item={data.items.find((it) => it.id === selectedId)} items={data.items} />
    );
  }

  const isEmpty = data.items.length === 0;

  return (
    <main className="min-h-screen bg-paper text-ink">
      {/* 刊头 */}
      <header className="border-b border-line">
        <div className="mx-auto max-w-4xl px-4 pb-8 pt-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
            Daily Pulse · 每日全球热点「信息早餐」
          </p>
          <div className="mt-3 flex items-center gap-3">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">DailyPulse</h1>
            {data.isSample && (
              <span className="inline-block border border-line px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-muted">
                示例数据
              </span>
            )}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-xs text-muted">
            {data.fetchedAt && <span>采集 {formatDate(data.fetchedAt)}</span>}
            <span>共 {data.items.length} 条</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              Live
            </span>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-6">
        {isEmpty ? (
          <div className="border-y border-line py-16 text-center">
            <p className="font-semibold">还没有采集数据</p>
            <p className="mt-2 font-mono text-sm text-muted">
              配置 APIFY_API_KEY 后运行 npm run fetch，或等待每日 08:00 定时任务。
            </p>
          </div>
        ) : (
          <>
            {/* 类别筛选 */}
            <div>
              <CategoryFilter value={category} onChange={setCategory} counts={categoryCounts} />
            </div>

            {/* 来源筛选 + 排序 */}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SourceFilter value={source} onChange={setSource} counts={sourceCounts} />
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-muted">
                <label htmlFor="sort">排序</label>
                <select
                  id="sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="border-b border-line bg-transparent py-1 font-mono text-sm text-ink outline-none focus:border-accent"
                >
                  <option value="score">按热度</option>
                  <option value="rank">按排名</option>
                  <option value="title">按标题</option>
                  <option value="publishedAt">按时间</option>
                </select>
              </div>
            </div>

            {/* 列表 */}
            <div className="mt-2">
              <FeedList items={items} />
            </div>
          </>
        )}

        <footer className="mt-12 border-t border-line pb-12 pt-6 text-center font-mono text-xs text-muted">
          DailyPulse · 每天 08:00 (UTC+8) 自动更新 · App Store / Google Play / Product Hunt /
          Reddit
        </footer>
      </section>
    </main>
  );
}
