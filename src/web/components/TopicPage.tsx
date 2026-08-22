import type { FeedItem, TopicCluster } from '../../types';
import { SOURCE_META } from '../../types';
import FeedList from './FeedList';
import type { ContentLanguage } from '../preferences';

interface TopicPageProps {
  topic?: TopicCluster;
  items: FeedItem[];
  language: ContentLanguage;
  favorites: Set<string>;
  readItems: Set<string>;
  onToggleFavorite: (item: FeedItem) => void;
  onShare: (item: FeedItem) => void;
}

export default function TopicPage({ topic, items, language, favorites, readItems, onToggleFavorite, onShare }: TopicPageProps) {
  if (!topic) {
    return (
      <main className="min-h-screen bg-paper px-4 py-10 text-ink">
        <a href="#/" className="font-mono text-xs uppercase tracking-wider text-muted hover:text-accent">← Back to desk</a>
        <div className="mx-auto mt-16 max-w-3xl border border-line bg-panel px-6 py-20 text-center font-mono text-sm text-muted">This topic is no longer in the current snapshot.</div>
      </main>
    );
  }
  const topicItems = topic.itemIds.map((id) => items.find((item) => item.id === id)).filter((item): item is FeedItem => Boolean(item));
  const useZh = language !== 'original';
  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <a href="#/" className="flex items-center gap-3 font-mono text-sm font-semibold tracking-[0.12em]"><span className="flex h-9 w-9 items-center justify-center bg-accent text-white">DP</span>DAILYPULSE</a>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Topic cluster</span>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <a href="#/" className="font-mono text-xs uppercase tracking-wider text-muted hover:text-accent">← Back to desk</a>
        <section className="mt-8 border-b border-line pb-10">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
            {topic.sources.map((source) => <span key={source} className="border border-line px-2 py-1">{SOURCE_META[source].label}</span>)}
            <span className="text-accent">{topic.trend.label}</span>
          </div>
          <h1 className="mt-5 max-w-5xl text-4xl font-semibold leading-[1.05] tracking-[-0.045em] sm:text-6xl">{useZh ? topic.titleZh ?? topic.title : topic.title}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted">{useZh ? topic.summaryZh ?? topic.summary : topic.summary}</p>
          <div className="mt-8 grid max-w-3xl grid-cols-3 border border-line bg-panel">
            <Stat label="Signals" value={String(topicItems.length)} />
            <Stat label="Sources" value={String(topic.sources.length)} />
            <Stat label="Heat" value={topic.heatScore.toFixed(0)} />
          </div>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-muted">{useZh ? topic.whyHotZh ?? topic.whyHot : topic.whyHot}</p>
        </section>
        <section className="py-8">
          <div className="mb-4 flex items-end justify-between">
            <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Source trail</p><h2 className="mt-2 text-2xl font-semibold">Related signals</h2></div>
            <span className="font-mono text-[10px] text-muted">{topicItems.length}</span>
          </div>
          <FeedList items={topicItems} language={language} favorites={favorites} readItems={readItems} onToggleFavorite={onToggleFavorite} onShare={onShare} />
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="border-r border-line p-4 last:border-r-0"><div className="font-mono text-[9px] uppercase tracking-wider text-muted">{label}</div><div className="mt-2 font-mono text-xl font-semibold">{value}</div></div>;
}
