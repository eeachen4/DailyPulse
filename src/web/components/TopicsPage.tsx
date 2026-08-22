import type { TopicCluster } from '../../types';
import { SOURCE_META } from '../../types';
import type { ContentLanguage } from '../preferences';

export default function TopicsPage({ topics, language }: { topics: TopicCluster[]; language: ContentLanguage }) {
  const useZh = language !== 'original';
  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <a href="#/" className="flex items-center gap-3 font-mono text-sm font-semibold tracking-[0.12em]"><span className="flex h-9 w-9 items-center justify-center bg-accent text-white">DP</span>DAILYPULSE</a>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Topic index</span>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <a href="#/" className="font-mono text-xs uppercase tracking-wider text-muted hover:text-accent">← Back to desk</a>
        <div className="mt-8 border-b border-line pb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Cross-source index</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">Topics, not duplicates.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted">Related reporting, discussions, products and research are grouped into one navigable trail.</p>
        </div>
        <div className="border-x border-line">
          {topics.map((topic, index) => (
            <a key={topic.id} href={'#/topic/' + encodeURIComponent(topic.id)} className="grid gap-3 border-b border-line bg-panel px-4 py-5 transition hover:bg-panel-strong sm:grid-cols-[42px_minmax(0,1fr)_150px] sm:items-center sm:px-5">
              <span className="font-mono text-xs text-muted">{String(index + 1).padStart(2, '0')}</span>
              <span>
                <strong className="block text-base font-semibold">{useZh ? topic.titleZh ?? topic.title : topic.title}</strong>
                <span className="mt-2 flex flex-wrap gap-2 font-mono text-[9px] uppercase tracking-wider text-muted">
                  {topic.sources.slice(0, 4).map((source) => <span key={source}>{SOURCE_META[source].short}</span>)}
                  <span>{topic.itemIds.length} signals</span>
                  <span>{topic.trend.label}</span>
                </span>
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted sm:text-right">Heat <strong className="ml-2 text-xl text-ink">{topic.heatScore.toFixed(0)}</strong></span>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
