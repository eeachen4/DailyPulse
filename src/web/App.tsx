import { useEffect, useMemo, useState } from 'react';
import type { FeedData, Source } from '../types';
import { SOURCES, SOURCE_META } from '../types';
import { CATEGORIES } from '../categories';
import CategoryFilter from './components/CategoryFilter';
import SourceFilter from './components/SourceFilter';
import FeedList from './components/FeedList';
import DetailPage from './components/DetailPage';
import { formatDate, formatNumber } from './format';

type SortKey = 'score' | 'rank' | 'title' | 'publishedAt';
type Theme = 'dark' | 'light';
type HistoryEntry = { date: string; fetchedAt: string; count: number; path: string };

const EMPTY: FeedData = { fetchedAt: null, items: [] };

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
  const liveData = useMemo(() => window.__DAILY_DATA__ ?? EMPTY, []);
  const [data, setData] = useState<FeedData>(liveData);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [category, setCategory] = useState('all');
  const [source, setSource] = useState<Source | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('score');
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(48);
  const [theme, setTheme] = useState<Theme>(() => {
    return window.localStorage.getItem('dailypulse-theme') === 'light' ? 'light' : 'dark';
  });
  const hash = useHashRoute();

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    window.localStorage.setItem('dailypulse-theme', theme);
  }, [theme]);

  useEffect(() => {
    fetch('history/index.json')
      .then((response) => (response.ok ? response.json() : []))
      .then((entries: HistoryEntry[]) => setHistory(Array.isArray(entries) ? entries : []))
      .catch(() => setHistory([]));
  }, []);

  useEffect(() => {
    if (!selectedDate) {
      setData(liveData);
      return;
    }
    let cancelled = false;
    fetch('history/' + selectedDate + '.json')
      .then((response) => (response.ok ? response.json() : null))
      .then((json: FeedData | null) => {
        if (!cancelled && json && Array.isArray(json.items)) setData(json);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [liveData, selectedDate]);

  useEffect(() => {
    if (!window.__DAILY_DATA__ && !selectedDate) {
      fetch('data/daily.json')
        .then((response) => (response.ok ? response.json() : null))
        .then((json: FeedData | null) => {
          if (json && Array.isArray(json.items)) setData(json);
        })
        .catch(() => undefined);
    }
  }, [selectedDate]);

  const items = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    let list = data.items;
    if (category !== 'all') list = list.filter((item) => item.category === category);
    if (source !== 'all') list = list.filter((item) => item.source === source);
    if (normalizedQuery) {
      list = list.filter((item) => {
        const haystack = [
          item.title,
          item.description,
          item.longDescription,
          item.developer,
          ...(item.tags ?? []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase();
        return haystack.includes(normalizedQuery);
      });
    }
    return [...list].sort((a, b) => {
      switch (sort) {
        case 'rank':
          return (a.rank ?? Number.POSITIVE_INFINITY) - (b.rank ?? Number.POSITIVE_INFINITY);
        case 'title':
          return a.title.localeCompare(b.title);
        case 'publishedAt':
          return (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '');
        default:
          return (b.score ?? Number.NEGATIVE_INFINITY) - (a.score ?? Number.NEGATIVE_INFINITY);
      }
    });
  }, [data, category, source, sort, query]);

  useEffect(() => {
    setVisibleCount(48);
  }, [category, source, sort, query, selectedDate]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const categoryDef of CATEGORIES) counts[categoryDef.label] = 0;
    for (const item of data.items) counts[item.category] = (counts[item.category] ?? 0) + 1;
    return counts;
  }, [data]);

  const sourceCounts = useMemo(() => {
    const counts: Record<Source, number> = { appstore: 0, googleplay: 0, producthunt: 0, reddit: 0 };
    for (const item of data.items) counts[item.source] += 1;
    return counts;
  }, [data]);

  const topItem = useMemo(
    () => [...data.items].sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))[0],
    [data],
  );
  const activeSourceCount = SOURCES.filter((item) => sourceCounts[item] > 0).length;
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
    return <DetailPage item={data.items.find((item) => item.id === selectedId)} items={data.items} />;
  }

  const isEmpty = data.items.length === 0;
  const displayedItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line bg-paper/95">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <a href="#/" className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center bg-accent font-mono text-sm font-semibold text-white">DP</span>
              <span className="font-mono text-sm font-semibold tracking-[0.12em]">DAILYPULSE</span>
            </a>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted sm:flex">
                <span className="h-1.5 w-1.5 animate-pulse bg-accent" /> Live brief
              </div>
              <button
                type="button"
                aria-label="切换主题"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex h-10 items-center gap-2 border border-line px-3 font-mono text-[10px] uppercase tracking-wider text-muted transition hover:border-accent hover:text-ink"
              >
                {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <section className="grid gap-6 border-b border-line py-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-10 lg:py-14">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">Morning intelligence / 08:00 UTC+8</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl">
              What moved while<br className="hidden sm:block" /> you slept.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-muted sm:text-base">
              A concise signal desk for the products, tools and conversations shaping today.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs text-muted">
              <span>{data.fetchedAt ? 'Pulse ' + formatDate(data.fetchedAt) : 'Waiting for first pulse'}</span>
              <span className="text-ink">{data.items.length} signals</span>
              {data.isSample && <span className="border border-line px-2 py-1 text-accent">sample snapshot</span>}
            </div>
          </div>

          <div className="border border-line bg-panel p-5">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Desk readout</span>
              <span className="font-mono text-[10px] text-accent">01 / 04</span>
            </div>
            <div className="mt-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Highest signal</div>
              <a href={topItem ? '#/item/' + encodeURIComponent(topItem.id) : '#/'} className="mt-3 block">
                <div className="line-clamp-3 text-xl font-semibold leading-tight transition hover:text-accent">
                  {topItem?.title ?? 'No signal yet'}
                </div>
                <div className="mt-4 flex items-end justify-between border-t border-line pt-4">
                  <span className="font-mono text-xs text-muted">{topItem ? SOURCE_META[topItem.source].label : '—'}</span>
                  <span className="font-mono text-2xl font-semibold text-accent">{topItem?.score !== undefined ? formatNumber(topItem.score) : '—'}</span>
                </div>
              </a>
            </div>
          </div>
        </section>

        {isEmpty ? (
          <div className="border border-line bg-panel px-6 py-24 text-center">
            <p className="text-xl font-semibold">还没有采集数据</p>
            <p className="mt-3 font-mono text-sm text-muted">运行 npm run fetch，或等待每日 08:00 定时任务。</p>
          </div>
        ) : (
          <div className="grid gap-8 pt-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
            <aside className="space-y-8 lg:sticky lg:top-6 lg:self-start">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Topics</h2>
                  <span className="font-mono text-[10px] text-muted">{CATEGORIES.length}</span>
                </div>
                <CategoryFilter value={category} onChange={setCategory} counts={categoryCounts} />
              </div>
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Sources</h2>
                  <span className="font-mono text-[10px] text-muted">{activeSourceCount} active</span>
                </div>
                <SourceFilter value={source} onChange={setSource} counts={sourceCounts} />
              </div>
              <div className="border-t border-line pt-5">
                <label htmlFor="history" className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Archive</label>
                <select
                  id="history"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="mt-3 min-h-11 w-full border border-line bg-panel px-3 font-mono text-xs text-ink outline-none"
                >
                  <option value="">Latest pulse</option>
                  {history.map((entry) => <option key={entry.date} value={entry.date}>{entry.date} · {entry.count}</option>)}
                </select>
              </div>
            </aside>

            <section className="min-w-0">
              <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Signal stream</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Today’s pulse</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="search" className="sr-only">搜索</label>
                  <input
                    id="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search signals..."
                    className="h-11 w-full border border-line bg-panel px-3 font-mono text-xs text-ink placeholder:text-muted outline-none transition focus:border-accent sm:w-52"
                  />
                  <select
                    id="sort"
                    value={sort}
                    onChange={(event) => setSort(event.target.value as SortKey)}
                    className="h-11 border border-line bg-panel px-3 font-mono text-xs text-ink outline-none"
                  >
                    <option value="score">Heat</option>
                    <option value="rank">Rank</option>
                    <option value="title">Title</option>
                    <option value="publishedAt">Newest</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                <span>{items.length} matching signals</span>
                <span>Sorted by {sort === 'score' ? 'heat' : sort}</span>
              </div>
              <div className="mt-3">
                <FeedList items={displayedItems} />
              </div>
              {hasMore && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((count) => count + 48)}
                  className="mt-4 min-h-12 w-full border border-line bg-panel font-mono text-xs uppercase tracking-[0.16em] text-muted transition hover:border-accent hover:text-accent"
                >
                  Load more · {items.length - visibleCount} remaining
                </button>
              )}
            </section>
          </div>
        )}

        <footer className="mt-12 flex flex-col gap-2 border-t border-line pt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>DailyPulse / intelligence desk</span>
          <span>App Store · Google Play · Product Hunt · Reddit</span>
        </footer>
      </div>
    </main>
  );
}
