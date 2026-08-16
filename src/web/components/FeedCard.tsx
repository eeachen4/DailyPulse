import type { FeedItem } from '../../types';
import { SOURCE_META } from '../../types';
import { formatNumber, formatDate } from '../format';

export default function FeedCard({ item }: { item: FeedItem }) {
  const meta = SOURCE_META[item.source];

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
          {meta.emoji}
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
          {item.rank !== undefined && (
            <span className="text-xs font-semibold text-slate-400">#{item.rank}</span>
          )}
          {item.category && (
            <span className="truncate text-xs text-slate-400">{item.category}</span>
          )}
        </div>

        <h3 className="mt-1 truncate font-semibold text-slate-900 transition group-hover:text-blue-600">
          {item.title}
        </h3>

        {item.description && (
          <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{item.description}</p>
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
