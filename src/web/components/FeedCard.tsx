import type { FeedItem } from '../../types';
import { SOURCE_META } from '../../types';
import { CATEGORY_META_BY_ID } from '../../categories';
import { primaryCategoryId } from '../../dataModel';
import { formatDate } from '../format';

export default function FeedCard({ item, index }: { item: FeedItem; index: number }) {
  const meta = SOURCE_META[item.source];
  const cat = CATEGORY_META_BY_ID[primaryCategoryId(item)] ?? { label: primaryCategoryId(item), emoji: '', hex: '#ff6b45' };

  return (
    <a
      href={'#/item/' + encodeURIComponent(item.id)}
      className="feed-card group grid grid-cols-[34px_64px_minmax(0,1fr)_auto_16px] items-center gap-3 border-b border-line bg-panel px-4 py-4 transition hover:bg-panel-strong sm:grid-cols-[42px_72px_minmax(0,1fr)_92px_18px] sm:gap-4 sm:px-5"
      style={{ animationDelay: Math.min(index, 12) * 28 + 'ms' }}
    >
      <div className="font-mono text-xs tabular-nums text-muted">{String(index + 1).padStart(2, '0')}</div>

      <div className="relative h-16 w-16 overflow-hidden border border-line bg-cream sm:h-[72px] sm:w-[72px]">
        <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-semibold text-muted">
          {meta.short}
        </span>
        {item.thumbnail && (
          <img
            src={item.thumbnail}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
            onError={(event) => event.currentTarget.remove()}
          />
        )}
      </div>

      <div className="min-w-0 self-stretch py-0.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
          <span className="text-ink">{meta.label}</span>
          <span style={{ color: cat.hex }}>{cat.label}</span>
          {item.publishedAt && <span className="hidden sm:inline">{formatDate(item.publishedAt)}</span>}
        </div>
        <h3 className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug text-ink transition-colors group-hover:text-accent sm:text-base">
          {item.title}
        </h3>
        <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-muted sm:line-clamp-2 sm:text-sm">
          {item.description || item.tags?.join(' · ') || '打开条目查看完整详情'}
        </p>
      </div>

      <div className="hidden text-right sm:block">
        <div className="font-mono text-lg font-semibold tabular-nums text-ink">
          {item.heatScore !== undefined ? item.heatScore.toFixed(0) : '—'}
        </div>
        <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-muted">
          {item.heatScore !== undefined ? 'normalized heat' : '暂无热度'}
        </div>
      </div>

      <span className="text-muted transition group-hover:translate-x-1 group-hover:text-accent" aria-hidden>
        →
      </span>
    </a>
  );
}
