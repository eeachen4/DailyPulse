import { useEffect, useMemo, useState } from 'react';
import type { FeedData, FeedDetail, FeedItem, Source } from '../types';
import { SOURCES, SOURCE_META } from '../types';
import { CATEGORIES } from '../categories';
import { categoryIdsFor, rawScoreFor } from '../dataModel';
import { buildIntelligence } from '../intelligence';
import CategoryFilter from './components/CategoryFilter';
import SourceFilter from './components/SourceFilter';
import FeedList from './components/FeedList';
import DetailPage from './components/DetailPage';
import TopicPage from './components/TopicPage';
import TopicsPage from './components/TopicsPage';
import HealthStrip from './components/HealthStrip';
import DailyBriefPanel from './components/DailyBriefPanel';
import SettingsPanel from './components/SettingsPanel';
import { formatDate } from './format';
import {
  displayTitle,
  itemAllowed,
  parsePreferences,
  preferenceScore,
  searchableText,
  type UserPreferences,
} from './preferences';

type SortKey = 'heat' | 'rank' | 'title' | 'publishedAt';
type Theme = 'dark' | 'light';
type HistoryEntry = { date: string; fetchedAt: string; count: number; path: string };
type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

const EMPTY: FeedData = { fetchedAt: null, items: [] };
const LOCAL_PREVIEW = import.meta.env.DEV;

function dataAssetPath(relativePath: string): string {
  return LOCAL_PREVIEW ? 'data/' + relativePath : relativePath;
}

function detailRequestPath(detailRef: string): string {
  return dataAssetPath(detailRef).replace(/%/g, '%25');
}

function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return hash;
}

function readStoredSet(key: string): Set<string> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? '[]') as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []);
  } catch {
    return new Set();
  }
}

function routeId(hash: string, prefix: string): string | null {
  if (!hash.startsWith(prefix)) return null;
  try {
    return decodeURIComponent(hash.slice(prefix.length));
  } catch {
    return hash.slice(prefix.length);
  }
}

export default function App() {
  const liveData = useMemo(() => window.__DAILY_DATA__ ?? EMPTY, []);
  const [data, setData] = useState<FeedData>(liveData);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyState, setHistoryState] = useState<LoadState>('loading');
  const [selectedDate, setSelectedDate] = useState('');
  const [category, setCategory] = useState('all');
  const [source, setSource] = useState<Source | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('heat');
  const [selectedDetail, setSelectedDetail] = useState<FeedDetail | null>(null);
  const [detailState, setDetailState] = useState<LoadState>('idle');
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(48);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [preferences, setPreferences] = useState<UserPreferences>(() => parsePreferences(window.localStorage.getItem('dailypulse-preferences')));
  const [favorites, setFavorites] = useState<Set<string>>(() => readStoredSet('dailypulse-favorites'));
  const [readItems, setReadItems] = useState<Set<string>>(() => readStoredSet('dailypulse-read'));
  const [theme, setTheme] = useState<Theme>(() => window.localStorage.getItem('dailypulse-theme') === 'light' ? 'light' : 'dark');
  const hash = useHashRoute();

  const intelligence = useMemo(() => {
    if (data.topics?.length && data.brief) return { items: data.items, topics: data.topics, brief: data.brief };
    return buildIntelligence(data.items, data.fetchedAt ?? new Date().toISOString());
  }, [data]);

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    window.localStorage.setItem('dailypulse-theme', theme);
  }, [theme]);
  useEffect(() => window.localStorage.setItem('dailypulse-preferences', JSON.stringify(preferences)), [preferences]);
  useEffect(() => window.localStorage.setItem('dailypulse-favorites', JSON.stringify([...favorites])), [favorites]);
  useEffect(() => window.localStorage.setItem('dailypulse-read', JSON.stringify([...readItems])), [readItems]);

  useEffect(() => {
    fetch(dataAssetPath('history/index.json'))
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then((entries: HistoryEntry[]) => {
        setHistory(Array.isArray(entries) ? entries : []);
        setHistoryState('loaded');
      })
      .catch(() => {
        setHistory([]);
        setHistoryState('error');
      });
  }, []);

  useEffect(() => {
    if (!selectedDate) {
      setData(liveData);
      return;
    }
    let cancelled = false;
    setHistoryState('loading');
    fetch(dataAssetPath('history/' + selectedDate + '.json'))
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then((json: FeedData) => {
        if (!cancelled && Array.isArray(json.items)) {
          setData(json);
          setHistoryState('loaded');
        }
      })
      .catch(() => {
        if (!cancelled) setHistoryState('error');
      });
    return () => { cancelled = true; };
  }, [liveData, selectedDate]);

  useEffect(() => {
    if (!window.__DAILY_DATA__ && !selectedDate) {
      fetch('data/daily.json')
        .then((response) => {
          if (!response.ok) throw new Error(String(response.status));
          return response.json();
        })
        .then((json: FeedData) => {
          if (Array.isArray(json.items)) setData(json);
        })
        .catch(() => setHistoryState('error'));
    }
  }, [selectedDate]);

  const itemId = routeId(hash, '#/item/');
  const topicId = routeId(hash, '#/topic/');
  const showingTopics = hash === '#/topics';

  useEffect(() => { window.scrollTo(0, 0); }, [itemId, topicId, showingTopics]);
  useEffect(() => {
    if (!itemId) return;
    setReadItems((current) => new Set(current).add(itemId));
  }, [itemId]);

  useEffect(() => {
    setSelectedDetail(null);
    const selectedItem = itemId ? intelligence.items.find((item) => item.id === itemId) : undefined;
    if (!selectedItem?.detailRef) {
      setDetailState('idle');
      return;
    }
    let cancelled = false;
    setDetailState('loading');
    fetch(detailRequestPath(selectedItem.detailRef))
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then((json: { detail?: FeedDetail }) => {
        if (!cancelled) {
          setSelectedDetail(json.detail ?? null);
          setDetailState(json.detail ? 'loaded' : 'error');
        }
      })
      .catch(() => { if (!cancelled) setDetailState('error'); });
    return () => { cancelled = true; };
  }, [intelligence.items, itemId]);

  const toggleFavorite = (item: FeedItem) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
      return next;
    });
  };
  const shareItem = async (item: FeedItem) => {
    const url = `${window.location.origin}${window.location.pathname}#/item/${encodeURIComponent(item.id)}`;
    const canShare = typeof navigator.share === 'function';
    try {
      if (canShare) await navigator.share({ title: displayTitle(item, preferences.language), url });
      else await navigator.clipboard.writeText(url);
      setNotice(canShare ? 'Share sheet opened' : 'Link copied');
    } catch {
      setNotice('Sharing was cancelled');
    }
    window.setTimeout(() => setNotice(''), 1800);
  };

  const allowedItems = useMemo(
    () => intelligence.items.filter((item) => itemAllowed(item, preferences)),
    [intelligence.items, preferences],
  );
  const items = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    let list = allowedItems;
    if (category !== 'all') list = list.filter((item) => categoryIdsFor(item).includes(category));
    if (source !== 'all') list = list.filter((item) => item.source === source);
    if (favoritesOnly) list = list.filter((item) => favorites.has(item.id));
    if (normalizedQuery) list = list.filter((item) => searchableText(item).includes(normalizedQuery));
    return [...list].sort((left, right) => {
      switch (sort) {
        case 'rank': return (left.rank ?? Infinity) - (right.rank ?? Infinity);
        case 'title': return displayTitle(left, preferences.language).localeCompare(displayTitle(right, preferences.language));
        case 'publishedAt': return (right.publishedAt ?? '').localeCompare(left.publishedAt ?? '');
        default: return preferenceScore(right, preferences) - preferenceScore(left, preferences);
      }
    });
  }, [allowedItems, category, source, favoritesOnly, favorites, query, sort, preferences]);

  useEffect(() => { setVisibleCount(48); }, [category, source, sort, query, selectedDate, favoritesOnly, preferences]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(CATEGORIES.map((entry) => [entry.id, 0]));
    for (const item of allowedItems) for (const categoryId of categoryIdsFor(item)) counts[categoryId] = (counts[categoryId] ?? 0) + 1;
    return counts;
  }, [allowedItems]);
  const sourceCounts = useMemo(() => {
    const counts = Object.fromEntries(SOURCES.map((entry) => [entry, 0])) as Record<Source, number>;
    for (const item of allowedItems) counts[item.source] += 1;
    return counts;
  }, [allowedItems]);

  const topics = useMemo(() => intelligence.topics.filter((topic) => {
    if (!topic.categoryIds.some((id) => preferences.enabledCategories.includes(id))) return false;
    if (!topic.sources.some((entry) => preferences.sourceWeights[entry] > 0)) return false;
    const text = `${topic.title} ${topic.titleZh ?? ''} ${topic.summary} ${topic.summaryZh ?? ''}`.toLocaleLowerCase();
    return !preferences.blockedKeywords.some((keyword) => text.includes(keyword.toLocaleLowerCase()));
  }).sort((left, right) => {
    const score = (topic: typeof left) => {
      const averageWeight = topic.sources.reduce((sum, entry) => sum + preferences.sourceWeights[entry], 0) / topic.sources.length;
      const text = `${topic.title} ${topic.titleZh ?? ''}`.toLocaleLowerCase();
      const boost = preferences.watchKeywords.some((keyword) => text.includes(keyword.toLocaleLowerCase())) ? 20 : 0;
      return (topic.heatScore + boost) * averageWeight + topic.sources.length * 8;
    };
    return score(right) - score(left);
  }), [intelligence.topics, preferences]);

  const personalizedBrief = useMemo(() => {
    const highlights = topics.slice(0, 3).map((topic) => ({
      topicId: topic.id,
      title: topic.title,
      titleZh: topic.titleZh,
      whyHot: topic.whyHot,
      whyHotZh: topic.whyHotZh,
      trend: topic.trend,
    }));
    if (!intelligence.brief) return undefined;
    return {
      ...intelligence.brief,
      headline: highlights.length ? `Today's three signals: ${highlights.map((entry) => entry.title).join(' · ')}` : intelligence.brief.headline,
      headlineZh: highlights.length ? `今日三件事：${highlights.map((entry) => entry.titleZh ?? entry.title).join(' · ')}` : intelligence.brief.headlineZh,
      highlights,
    };
  }, [intelligence.brief, topics]);

  if (itemId !== null) {
    const selectedItem = intelligence.items.find((item) => item.id === itemId);
    const detailedItem = selectedItem && selectedDetail ? { ...selectedItem, ...selectedDetail } : selectedItem;
    return <DetailPage item={detailedItem} items={intelligence.items} language={preferences.language} isFavorite={Boolean(selectedItem && favorites.has(selectedItem.id))} detailState={detailState} onToggleFavorite={toggleFavorite} onShare={shareItem} />;
  }
  if (topicId !== null) {
    return <TopicPage topic={intelligence.topics.find((topic) => topic.id === topicId)} items={intelligence.items} language={preferences.language} favorites={favorites} readItems={readItems} onToggleFavorite={toggleFavorite} onShare={shareItem} />;
  }
  if (showingTopics) return <TopicsPage topics={topics} language={preferences.language} />;

  const displayedItems = items.slice(0, visibleCount);
  const topItem = items[0] ?? [...allowedItems].sort((left, right) => (right.heatScore ?? rawScoreFor(right) ?? -Infinity) - (left.heatScore ?? rawScoreFor(left) ?? -Infinity))[0];
  const activeSourceCount = SOURCES.filter((entry) => sourceCounts[entry] > 0).length;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line bg-paper/95">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <a href="#/" className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center bg-accent font-mono text-sm font-semibold text-white">DP</span><span className="font-mono text-sm font-semibold tracking-[0.12em]">DAILYPULSE</span></a>
            <div className="flex items-center gap-2">
              <a href="#/topics" className="hidden min-h-10 items-center border border-line px-3 font-mono text-[10px] uppercase tracking-wider text-muted hover:border-accent hover:text-accent sm:flex">Topics</a>
              <button type="button" onClick={() => setSettingsOpen(true)} className="min-h-10 border border-line px-3 font-mono text-[10px] uppercase tracking-wider text-muted hover:border-accent hover:text-accent">Settings</button>
              <button type="button" aria-label="切换主题" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="min-h-10 border border-line px-3 font-mono text-[10px] uppercase tracking-wider text-muted hover:border-accent hover:text-ink">{theme === 'dark' ? 'Light' : 'Dark'}</button>
            </div>
          </div>
        </div>
      </header>
      <HealthStrip health={data.sourceHealth} />

      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <section className="grid gap-6 border-b border-line py-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-10 lg:py-14">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">Morning intelligence / 08:00 UTC+8</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl">What moved while<br className="hidden sm:block" /> you slept.</h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-muted sm:text-base">Products, research and conversations—clustered into topics and tuned to your signal preferences.</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs text-muted">
              <span>{data.fetchedAt ? 'Pulse ' + formatDate(data.fetchedAt) : 'Waiting for first pulse'}</span>
              <span className="text-ink">{data.items.length} signals</span>
              <span>{topics.filter((topic) => topic.sources.length > 1).length} cross-source topics</span>
              {data.isSample && <span className="border border-line px-2 py-1 text-accent">sample snapshot</span>}
            </div>
          </div>
          <div className="border border-line bg-panel p-5">
            <div className="flex items-center justify-between border-b border-line pb-4"><span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Highest signal</span><span className="font-mono text-[10px] text-accent">01 / 04</span></div>
            <a href={topItem ? '#/item/' + encodeURIComponent(topItem.id) : '#/'} className="mt-5 block">
              <div className="line-clamp-3 text-xl font-semibold leading-tight transition hover:text-accent">{topItem ? displayTitle(topItem, preferences.language) : 'No signal yet'}</div>
              <div className="mt-4 flex items-end justify-between border-t border-line pt-4"><span className="font-mono text-xs text-muted">{topItem ? SOURCE_META[topItem.source].label : '—'}</span><span className="font-mono text-2xl font-semibold text-accent">{topItem?.heatScore?.toFixed(0) ?? '—'}</span></div>
            </a>
          </div>
        </section>

        <DailyBriefPanel brief={personalizedBrief} topics={topics} language={preferences.language} />

        {data.items.length === 0 ? (
          <div className="border border-line bg-panel px-6 py-24 text-center"><p className="text-xl font-semibold">还没有采集数据</p><p className="mt-3 font-mono text-sm text-muted">运行 npm run fetch，或等待每日 08:00 定时任务。</p></div>
        ) : (
          <div className="grid gap-8 pt-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
            <aside className="space-y-8 lg:sticky lg:top-6 lg:self-start">
              <div><div className="mb-3 flex items-center justify-between"><h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Topics</h2><span className="font-mono text-[10px] text-muted">{preferences.enabledCategories.length}/{CATEGORIES.length}</span></div><CategoryFilter value={category} onChange={setCategory} counts={categoryCounts} total={allowedItems.length} /></div>
              <div><div className="mb-3 flex items-center justify-between"><h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Sources</h2><span className="font-mono text-[10px] text-muted">{activeSourceCount} active</span></div><SourceFilter value={source} onChange={setSource} counts={sourceCounts} /></div>
              <div className="border-t border-line pt-5">
                <label htmlFor="history" className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Archive</label>
                <select id="history" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="mt-3 min-h-11 w-full border border-line bg-panel px-3 font-mono text-xs text-ink outline-none"><option value="">Latest pulse</option>{history.map((entry) => <option key={entry.date} value={entry.date}>{entry.date} · {entry.count}</option>)}</select>
                {historyState === 'loading' && <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-muted">Loading archive…</p>}
                {historyState === 'error' && <p className="mt-2 font-mono text-[9px] leading-4 text-muted">Archive unavailable. Current snapshot is unchanged.</p>}
              </div>
              <div className="border-t border-line pt-5"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Exports</p><div className="mt-3 grid grid-cols-2 gap-2"><a href={LOCAL_PREVIEW ? 'dist/rss.xml' : 'rss.xml'} className="flex min-h-11 items-center justify-center border border-line font-mono text-[10px] uppercase tracking-wider text-muted hover:border-accent hover:text-accent">RSS</a><a href={LOCAL_PREVIEW ? 'dist/feed.json' : 'feed.json'} className="flex min-h-11 items-center justify-center border border-line font-mono text-[10px] uppercase tracking-wider text-muted hover:border-accent hover:text-accent">JSON</a></div></div>
            </aside>

            <section className="min-w-0">
              <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Signal stream</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{favoritesOnly ? 'Saved signals' : 'Today’s pulse'}</h2></div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setFavoritesOnly((value) => !value)} className={`min-h-11 border px-3 font-mono text-[10px] uppercase tracking-wider ${favoritesOnly ? 'border-accent bg-accent text-white' : 'border-line text-muted'}`}>Saved {favorites.size}</button>
                  <label htmlFor="search" className="sr-only">搜索</label><input id="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="中英文搜索…" className="h-11 w-full border border-line bg-panel px-3 font-mono text-xs text-ink placeholder:text-muted outline-none focus:border-accent sm:w-52" />
                  <select id="sort" value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="h-11 border border-line bg-panel px-3 font-mono text-xs text-ink outline-none"><option value="heat">Personal heat</option><option value="rank">Rank</option><option value="title">Title</option><option value="publishedAt">Newest</option></select>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-muted"><span>{items.length} matching signals</span><span>{readItems.size} read</span></div>
              <div className="mt-3"><FeedList items={displayedItems} language={preferences.language} favorites={favorites} readItems={readItems} onToggleFavorite={toggleFavorite} onShare={shareItem} /></div>
              {visibleCount < items.length && <button type="button" onClick={() => setVisibleCount((count) => count + 48)} className="mt-4 min-h-12 w-full border border-line bg-panel font-mono text-xs uppercase tracking-[0.16em] text-muted hover:border-accent hover:text-accent">Load more · {items.length - visibleCount} remaining</button>}
            </section>
          </div>
        )}

        <footer className="mt-12 flex flex-col gap-2 border-t border-line pt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted sm:flex-row sm:items-center sm:justify-between"><span>DailyPulse / intelligence desk</span><span>{SOURCES.map((entry) => SOURCE_META[entry].label).join(' · ')}</span></footer>
      </div>

      <SettingsPanel open={settingsOpen} value={preferences} onChange={setPreferences} onClose={() => setSettingsOpen(false)} />
      {notice && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 border border-line bg-panel px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink">{notice}</div>}
    </main>
  );
}
