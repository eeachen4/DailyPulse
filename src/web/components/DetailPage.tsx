import type { FeedItem } from '../../types';
import { SOURCE_META } from '../../types';
import { CATEGORY_META } from '../../categories';
import { formatNumber, formatDate } from '../format';
import ExpandableText from './ExpandableText';

export default function DetailPage({ item, items }: { item?: FeedItem; items: FeedItem[] }) {
  if (!item) {
    return (
      <main className="min-h-screen bg-paper px-4 py-10 text-ink">
        <a href="#/" className="font-mono text-xs uppercase tracking-wider text-muted hover:text-accent">← Back to desk</a>
        <div className="mx-auto mt-16 max-w-3xl border border-line bg-panel px-6 py-20 text-center font-mono text-sm text-muted">This signal is no longer in the current snapshot.</div>
      </main>
    );
  }

  const meta = SOURCE_META[item.source];
  const cat = CATEGORY_META[item.category] ?? { label: item.category, emoji: '', hex: '#ff6b45' };
  const index = items.findIndex((entry) => entry.id === item.id);
  const previous = index > 0 ? items[index - 1] : undefined;
  const next = index >= 0 && index < items.length - 1 ? items[index + 1] : undefined;
  const related = items
    .filter((entry) => entry.id !== item.id && entry.category === item.category)
    .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
    .slice(0, 5);
  const longDesc = item.longDescription && item.longDescription !== item.description ? item.longDescription : undefined;
  const externalUrl = item.externalUrl && item.externalUrl !== item.url ? item.externalUrl : undefined;
  const stats = [
    item.score !== undefined ? { label: meta.scoreLabel, value: formatNumber(item.score) } : undefined,
    item.rank !== undefined ? { label: 'Rank', value: 'No.' + item.rank } : undefined,
    item.rating !== undefined ? { label: 'Rating', value: '★ ' + item.rating.toFixed(1) } : undefined,
    item.comments !== undefined ? { label: 'Comments', value: formatNumber(item.comments) } : undefined,
    item.price ? { label: 'Price', value: item.price } : undefined,
    item.publishedAt ? { label: 'Published', value: formatDate(item.publishedAt) } : undefined,
    ...(item.stats ?? []),
  ].filter((value): value is { label: string; value: string } => Boolean(value));

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
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.05] tracking-[-0.045em] sm:text-6xl">{item.title}</h1>
            {item.developer && <p className="mt-5 font-mono text-xs uppercase tracking-wider text-muted">By {item.developer}</p>}
            {item.description && <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">{item.description}</p>}

            <div className="mt-8 flex flex-wrap gap-2">
              {item.tags?.map((tag) => <span key={tag} className="border border-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted">{tag}</span>)}
            </div>

            {longDesc && (
              <section className="mt-10 border-t border-line pt-6">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Full brief</h2>
                <ExpandableText text={longDesc} className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-8 text-ink/90" />
              </section>
            )}

            {item.screenshots && item.screenshots.length > 0 && (
              <section className="mt-10 border-t border-line pt-6">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Screenshots</h2>
                <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                  {item.screenshots.map((screenshot) => (
                    <img key={screenshot} src={screenshot} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-52 w-auto shrink-0 border border-line bg-cream object-contain" onError={(event) => event.currentTarget.remove()} />
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
                      <span className="font-mono text-xs text-muted">{entry.score !== undefined ? formatNumber(entry.score) : '—'}</span>
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
            </div>
            <p className="mt-4 break-all font-mono text-[10px] leading-5 text-muted">{item.url}</p>
          </aside>
        </article>
      </div>
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
