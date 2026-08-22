import { useEffect, useState } from 'react';
import type { FeedItem } from '../../types';
import { SOURCE_META } from '../../types';
import { CATEGORY_META_BY_ID } from '../../categories';
import { categoryIdsFor, primaryCategoryId } from '../../dataModel';
import { formatNumber, formatDate } from '../format';
import ExpandableText from './ExpandableText';
import { displayDescription, displayTitle, type ContentLanguage } from '../preferences';

export default function DetailPage({
  item,
  items,
  language,
  isFavorite,
  detailState,
  onToggleFavorite,
  onShare,
}: {
  item?: FeedItem;
  items: FeedItem[];
  language: ContentLanguage;
  isFavorite: boolean;
  detailState: 'idle' | 'loading' | 'loaded' | 'error';
  onToggleFavorite: (item: FeedItem) => void;
  onShare: (item: FeedItem) => void;
}) {
  const screenshotCount = item?.screenshots?.length ?? 0;
  const [selectedScreenshot, setSelectedScreenshot] = useState<number | null>(null);

  useEffect(() => {
    if (selectedScreenshot === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedScreenshot(null);
      if (event.key === 'ArrowLeft') setSelectedScreenshot((index) => index === null ? null : (index - 1 + screenshotCount) % screenshotCount);
      if (event.key === 'ArrowRight') setSelectedScreenshot((index) => index === null ? null : (index + 1) % screenshotCount);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedScreenshot, screenshotCount]);

  if (!item) {
    return (
      <main className="min-h-screen bg-paper px-4 py-10 text-ink">
        <a href="#/" className="font-mono text-xs uppercase tracking-wider text-muted hover:text-accent">← Back to desk</a>
        <div className="mx-auto mt-16 max-w-3xl border border-line bg-panel px-6 py-20 text-center font-mono text-sm text-muted">This signal is no longer in the current snapshot.</div>
      </main>
    );
  }

  const meta = SOURCE_META[item.source];
  const cat = CATEGORY_META_BY_ID[primaryCategoryId(item)] ?? { label: primaryCategoryId(item), emoji: '', hex: '#ff6b45' };
  const index = items.findIndex((entry) => entry.id === item.id);
  const previous = index > 0 ? items[index - 1] : undefined;
  const next = index >= 0 && index < items.length - 1 ? items[index + 1] : undefined;
  const related = items
    .filter((entry) => entry.id !== item.id && categoryIdsFor(entry).some((id) => categoryIdsFor(item).includes(id)))
    .sort((a, b) => (b.heatScore ?? -Infinity) - (a.heatScore ?? -Infinity))
    .slice(0, 5);
  const longDesc = item.longDescription && item.longDescription !== item.description ? item.longDescription : undefined;
  const externalUrl = item.externalUrl && item.externalUrl !== item.url ? item.externalUrl : undefined;
  const stats = [
    item.heatScore !== undefined ? { label: 'Normalized heat', value: item.heatScore.toFixed(0) } : undefined,
    item.metrics?.rawScore !== undefined ? { label: meta.scoreLabel, value: formatNumber(item.metrics.rawScore) } : item.score !== undefined ? { label: meta.scoreLabel, value: formatNumber(item.score) } : undefined,
    item.rank !== undefined ? { label: 'Rank', value: 'No.' + item.rank } : undefined,
    item.metrics?.rating !== undefined ? { label: 'Rating', value: '★ ' + item.metrics.rating.toFixed(1) } : item.rating !== undefined ? { label: 'Rating', value: '★ ' + item.rating.toFixed(1) } : undefined,
    item.metrics?.comments !== undefined ? { label: 'Comments', value: formatNumber(item.metrics.comments) } : item.comments !== undefined ? { label: 'Comments', value: formatNumber(item.comments) } : undefined,
    item.price ? { label: 'Price', value: item.price } : undefined,
    item.publishedAt ? { label: 'Published', value: formatDate(item.publishedAt) } : undefined,
    ...(item.stats ?? []),
  ].filter((value): value is { label: string; value: string } => Boolean(value));

  const screenshots = item.screenshots ?? [];
  const activeScreenshot = selectedScreenshot !== null ? screenshots[selectedScreenshot] : undefined;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <a href="#/" className="flex items-center gap-3 font-mono text-sm font-semibold tracking-[0.12em]">
            <span className="flex h-9 w-9 items-center justify-center bg-accent text-white">DP</span>
            DAILYPULSE
          </a>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{String(index + 1).padStart(2, '0')} / {items.length}</span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <a href="#/" className="font-mono text-xs uppercase tracking-wider text-muted transition hover:text-accent">← Back to desk</a>
          <div className="flex gap-2">
            {previous && <a href={'#/item/' + encodeURIComponent(previous.id)} className="border border-line px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted hover:border-accent hover:text-accent">← Previous</a>}
            {next && <a href={'#/item/' + encodeURIComponent(next.id)} className="border border-line px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted hover:border-accent hover:text-accent">Next →</a>}
          </div>
        </div>

        <article className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-12">
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
              <span className="text-ink">{meta.label}</span>
              <span style={{ color: cat.hex }}>{cat.label}</span>
              {item.publishedAt && <span>{formatDate(item.publishedAt)}</span>}
              {item.stale && <span className="border border-accent/50 px-2 py-1 text-accent">Archived signal · {item.staleFrom ? formatDate(item.staleFrom) : 'recent snapshot'}</span>}
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.05] tracking-[-0.045em] sm:text-6xl">{displayTitle(item, language)}</h1>
            {item.developer && <p className="mt-5 font-mono text-xs uppercase tracking-wider text-muted">By {item.developer}</p>}
            {displayDescription(item, language) && <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">{displayDescription(item, language)}</p>}

            {detailState === 'loading' && <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-muted">Loading extended detail…</p>}
            {detailState === 'error' && <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-muted">Extended detail is unavailable; the captured summary remains readable.</p>}

            <div className="mt-8 flex flex-wrap gap-2">
              {item.tags?.map((tag) => <span key={tag} className="border border-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted">{tag}</span>)}
            </div>

            {longDesc && (
              <section className="mt-10 border-t border-line pt-6">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Full brief</h2>
                <ExpandableText text={longDesc} className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-8 text-ink/90" />
              </section>
            )}

            {screenshots.length > 0 && (
              <section className="mt-10 border-t border-line pt-6">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Screenshots</h2>
                <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                  {screenshots.map((screenshot, index) => (
                    <button
                      key={screenshot}
                      type="button"
                      aria-label={`查看第 ${index + 1} 张截图大图`}
                      className="group relative h-52 shrink-0 overflow-hidden border border-line bg-cream focus:outline-none focus:ring-2 focus:ring-accent"
                      onClick={() => setSelectedScreenshot(index)}
                    >
                      <img src={screenshot} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-auto object-contain transition duration-200 group-hover:scale-[1.03]" onError={(event) => event.currentTarget.parentElement?.remove()} />
                      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-left font-mono text-[9px] uppercase tracking-wider text-white opacity-0 transition group-hover:opacity-100">View larger ↗</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {related.length > 0 && (
              <section className="mt-10 border-t border-line pt-6">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">More from {cat.label}</h2>
                <div className="mt-3 border-t border-line">
                  {related.map((entry) => (
                    <a key={entry.id} href={'#/item/' + encodeURIComponent(entry.id)} className="group flex items-center gap-3 border-b border-line py-3 hover:bg-panel">
                      <span className="h-1.5 w-1.5" style={{ backgroundColor: cat.hex }} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium group-hover:text-accent">{entry.title}</span>
                      <span className="font-mono text-xs text-muted">{entry.heatScore !== undefined ? entry.heatScore.toFixed(0) : '—'}</span>
                      <span className="text-muted group-hover:text-accent">→</span>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="self-start lg:sticky lg:top-6">
            <div className="border border-line bg-panel">
              <div className="border-b border-line px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Signal data</div>
              <div className="grid grid-cols-2">
                {stats.map((stat) => <Stat key={stat.label + stat.value} label={stat.label} value={stat.value} />)}
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-between bg-accent px-4 font-mono text-xs font-semibold uppercase tracking-wider text-white hover:bg-accent-dark">Open source <span>↗</span></a>
              {externalUrl && <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-between border border-line px-4 font-mono text-xs uppercase tracking-wider text-muted hover:border-accent hover:text-accent">Open external link <span>↗</span></a>}
              {item.topicId && <a href={'#/topic/' + encodeURIComponent(item.topicId)} className="flex min-h-12 items-center justify-between border border-line px-4 font-mono text-xs uppercase tracking-wider text-muted hover:border-accent hover:text-accent">Open topic trail <span>→</span></a>}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => onToggleFavorite(item)} className={`min-h-12 border font-mono text-xs uppercase tracking-wider ${isFavorite ? 'border-accent bg-accent text-white' : 'border-line text-muted hover:border-accent hover:text-accent'}`}>{isFavorite ? 'Saved' : 'Save'}</button>
                <button type="button" onClick={() => onShare(item)} className="min-h-12 border border-line font-mono text-xs uppercase tracking-wider text-muted hover:border-accent hover:text-accent">Share</button>
              </div>
            </div>
            <p className="mt-4 break-all font-mono text-[10px] leading-5 text-muted">{item.url}</p>
          </aside>
        </article>
      </div>

      {activeScreenshot && selectedScreenshot !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="截图大图预览"
          onClick={() => setSelectedScreenshot(null)}
        >
          <button
            type="button"
            aria-label="关闭大图"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center border border-white/30 font-mono text-xl text-white transition hover:border-white hover:bg-white/10 sm:right-8 sm:top-8"
            onClick={() => setSelectedScreenshot(null)}
          >
            ×
          </button>
          {screenshots.length > 1 && (
            <>
              <button
                type="button"
                aria-label="上一张截图"
                className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/30 font-mono text-xl text-white transition hover:border-white hover:bg-white/10 sm:left-8"
                onClick={(event) => { event.stopPropagation(); setSelectedScreenshot((index) => index === null ? null : (index - 1 + screenshots.length) % screenshots.length); }}
              >
                ←
              </button>
              <button
                type="button"
                aria-label="下一张截图"
                className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/30 font-mono text-xl text-white transition hover:border-white hover:bg-white/10 sm:right-8"
                onClick={(event) => { event.stopPropagation(); setSelectedScreenshot((index) => index === null ? null : (index + 1) % screenshots.length); }}
              >
                →
              </button>
            </>
          )}
          <img
            src={activeScreenshot}
            alt=""
            className="max-h-[calc(100vh-5rem)] max-w-[calc(100vw-5rem)] object-contain"
            onClick={(event) => event.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-wider text-white/70 sm:bottom-8">
            {selectedScreenshot + 1} / {screenshots.length} · Esc to close
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-r border-line p-3 last:border-r-0">
      <div className="font-mono text-[9px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-2 break-words font-mono text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}
