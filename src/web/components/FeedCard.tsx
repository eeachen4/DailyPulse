import type { FeedItem } from '../../types';
import { SOURCE_META } from '../../types';
import { CATEGORY_META } from '../../categories';
import { formatNumber, formatDate } from '../format';

export default function FeedCard({ item }: { item: FeedItem }) {
  const meta = SOURCE_META[item.source];
  const cat = CATEGORY_META[item.category] ?? { label: item.category, emoji: '🏷️', hex: '#64748b' };

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      {/* 缩略图：加载失败时自动回退到 emoji */}
      <div className="relative h-14 w-14 shrink-0">
        <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-100 text-2xl">
          {cat.emoji}
        </span>
        {item.thumbnail && (
          <img
            src={item.thumbnail}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full rounded-xl object-cover"
            onError={(e) => e.currentTarget.remove()}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.badgeClass}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
            {meta.label}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: `${cat.hex}1a`, color: cat.hex }}
          >
            {cat.emoji} {cat.label}
          </span>
          {item.rank !== undefined && (
            <span className="text-xs font-semibold text-slate-400">#{item.rank}</span>
          )}
        </div>

        <h3 className="mt-1 truncate font-semibold text-slate-900 transition group-hover:text-blue-600">
          {item.title}
        </h3>

        {item.description && (
          <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{item.description}</p>
        )}

        {item.tags && item.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
          {item.score !== undefined && (
            <>
              <span className="font-semibold text-slate-800">{formatNumber(item.score)}</span>
              <span className="text-slate-400">{meta.scoreLabel}</span>
            </>
          )}
          {item.publishedAt && <span className="ml-auto">{formatDate(item.publishedAt)}</span>}
        </div>
      </div>
    </a>
  );
}
