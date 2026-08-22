import type { DailyBrief, TopicCluster } from '../../types';
import type { ContentLanguage } from '../preferences';

function trendMark(direction: TopicCluster['trend']['direction']): string {
  if (direction === 'up') return '↑';
  if (direction === 'down') return '↓';
  if (direction === 'new') return 'NEW';
  return '—';
}

export default function DailyBriefPanel({
  brief,
  topics,
  language,
}: {
  brief?: DailyBrief;
  topics: TopicCluster[];
  language: ContentLanguage;
}) {
  if (!brief?.highlights.length) return null;
  const useZh = language !== 'original';
  return (
    <section className="border-b border-line py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Daily edit / 今日三件事</p>
          <h2 className="mt-2 max-w-4xl text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
            {useZh ? brief.headlineZh : brief.headline}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">{useZh ? brief.overviewZh : brief.overview}</p>
        </div>
        <a href="#/topics" className="flex min-h-11 items-center border border-line px-4 font-mono text-[10px] uppercase tracking-wider text-muted hover:border-accent hover:text-accent">
          Browse topics →
        </a>
      </div>
      <div className="mt-6 border-t border-line">
        {brief.highlights.map((highlight, index) => (
          <a key={highlight.topicId} href={'#/topic/' + encodeURIComponent(highlight.topicId)} className="grid gap-2 border-b border-line py-4 transition hover:bg-panel sm:grid-cols-[42px_minmax(0,1fr)_auto] sm:items-center sm:px-3">
            <span className="font-mono text-xs tabular-nums text-muted">0{index + 1}</span>
            <span>
              <strong className="block text-sm font-semibold sm:text-base">{useZh ? highlight.titleZh ?? highlight.title : highlight.title}</strong>
              <span className="mt-1 block font-mono text-[10px] leading-5 text-muted">{useZh ? highlight.whyHotZh ?? highlight.whyHot : highlight.whyHot}</span>
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-accent">
              {trendMark(highlight.trend.direction)} {highlight.trend.label}
            </span>
          </a>
        ))}
      </div>
      {topics.length > 3 && <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted">{topics.length} topic clusters indexed</p>}
    </section>
  );
}
