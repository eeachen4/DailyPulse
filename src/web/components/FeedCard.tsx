import type { FeedItem } from '../../types';
import { SOURCE_META } from '../../types';
import { CATEGORY_META } from '../../categories';
import { formatNumber, formatDate } from '../format';

export default function FeedCard({ item }: { item: FeedItem }) {
  const meta = SOURCE_META[item.source];
  const cat = CATEGORY_META[item.category] ?? { label: item.category, emoji: '', hex: '#6E675A' };

  return (
    <a
      href={`#/item/${encodeURIComponent(item.id)}`}
      className="group flex items-center gap-3 px-1 py-4 transition hover:bg-cream/60 sm:gap-4"
    >
      {/* 缩略图 / 短名占位 */}
      <div className="relative h-11 w-11 shrink-0 overflow-hidden border border-line bg-cream">
        <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-semibold text-muted">
          {meta.short}
        </span>
        {item.thumbnail && (
          <img
            src={item.thumbnail}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => e.currentTarget.remove()}
          />
        )}
      </div>

      {/* 主体 */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] uppercase tracking-wide text-muted">
          <span className="font-medium text-ink">{meta.label}</span>
          <span style={{ color: cat.hex }}>{cat.label}</span>
          {item.rank !== undefined && <span>No.{item.rank}</span>}
          {item.rating !== undefined && <span className="text-ink">★ {item.rating.toFixed(1)}</span>}
          {item.publishedAt && (
            <span className="hidden sm:inline">{formatDate(item.publishedAt)}</span>
          )}
        </div>
        <h3 className="mt-1 truncate text-[15px] font-semibold text-ink transition-colors group-hover:text-accent">
          {item.title}
        </h3>
        {item.description ? (
          <p className="mt-0.5 truncate text-sm text-muted">{item.description}</p>
        ) : item.tags?.length ? (
          <p className="mt-0.5 truncate font-mono text-xs text-muted">{item.tags.join(' · ')}</p>
        ) : null}
      </div>

      {/* 热度 */}
      {item.score !== undefined && (
        <div className="shrink-0 text-right">
          <div className="font-mono text-lg font-semibold tabular-nums leading-none text-ink">
            {formatNumber(item.score)}
          </div>
          <div className="mt-1 hidden font-mono text-[10px] uppercase tracking-wide text-muted sm:block">
            {meta.scoreLabel}
          </div>
        </div>
      )}

      {/* 箭头 */}
      <div className="shrink-0 text-line transition group-hover:translate-x-0.5 group-hover:text-accent">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </a>
  );
}
