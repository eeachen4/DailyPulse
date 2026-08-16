import { useEffect, useMemo, useState } from 'react';
import type { FeedData, Source } from '../types';
import { SOURCES, SOURCE_META } from '../types';
import SourceFilter from './components/SourceFilter';
import FeedList from './components/FeedList';
import { formatDate } from './format';

type SortKey = 'score' | 'rank' | 'title' | 'publishedAt';

const EMPTY: FeedData = { fetchedAt: null, items: [] };

export default function App() {
  const [data, setData] = useState<FeedData>(() => window.__DAILY_DATA__ ?? EMPTY);
  const [filter, setFilter] = useState<Source | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('score');

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
    const list = filter === 'all' ? data.items : data.items.filter((it) => it.source === filter);
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
  }, [data, filter, sort]);

  const counts = useMemo(() => {
    const c: Record<Source, number> = { appstore: 0, googleplay: 0, producthunt: 0, reddit: 0 };
    for (const it of data.items) c[it.source] += 1;
    return c;
  }, [data]);

  const isEmpty = data.items.length === 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-lg font-black text-white shadow">
              DP
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                DailyPulse
                {data.isSample && (
                  <span className="ml-2 inline-block translate-y-[-2px] rounded-full bg-amber-100 px-2 py-0.5 align-middle text-xs font-medium text-amber-700">
                    示例数据
                  </span>
                )}
              </h1>
              <p className="text-sm text-slate-500">每日全球热点「信息早餐」</p>
            </div>
          </div>
          {data.fetchedAt && (
            <p className="mt-4 text-sm text-slate-400">采集时间：{formatDate(data.fetchedAt)}</p>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-6">
        {isEmpty ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-lg font-semibold text-slate-700">还没有采集数据</p>
            <p className="mt-2 text-sm text-slate-500">
              配置 <code className="rounded bg-slate-100 px-1 py-0.5">APIFY_API_KEY</code> 后运行{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">npm run fetch</code>
              ，或等待 GitHub Actions 每日定时任务（北京时间 08:00）自动执行。
            </p>
          </div>
        ) : (
          <>
            {/* 统计栏 */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SOURCES.map((s) => (
                <div key={s} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span className={`h-2 w-2 rounded-full ${SOURCE_META[s].dotClass}`} />
                    {SOURCE_META[s].label}
                  </div>
                  <div className="mt-1 text-2xl font-bold">{counts[s]}</div>
                </div>
              ))}
            </div>

            {/* 筛选 + 排序 */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SourceFilter value={filter} onChange={setFilter} counts={counts} />
              <div className="flex items-center gap-2 text-sm">
                <label htmlFor="sort" className="text-slate-500">
                  排序
                </label>
                <select
                  id="sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 outline-none focus:border-blue-500"
                >
                  <option value="score">按热度</option>
                  <option value="rank">按排名</option>
                  <option value="title">按标题</option>
                  <option value="publishedAt">按时间</option>
                </select>
              </div>
            </div>

            {/* 卡片列表 */}
            <div className="mt-4">
              <FeedList items={items} />
            </div>
          </>
        )}

        <footer className="mt-10 pb-10 text-center text-xs text-slate-400">
          DailyPulse · 每天 08:00 (UTC+8) 自动更新 · 数据来源：App Store / Google Play / Product
          Hunt / Reddit
        </footer>
      </section>
    </main>
  );
}
