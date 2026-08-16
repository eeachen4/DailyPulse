import type { FeedItem } from '../../types';
import { SOURCE_META } from '../../types';
import { CATEGORY_META } from '../../categories';
import { formatNumber, formatDate } from '../format';

export default function DetailPage({ item }: { item?: FeedItem }) {
  if (!item) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <a
            href="#/"
            className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-900"
          >
            ← 返回列表
          </a>
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
            未找到该条目（数据可能已更新），请返回列表查看。
          </div>
        </div>
      </main>
    );
  }

  const meta = SOURCE_META[item.source];
  const cat = CATEGORY_META[item.category] ?? { label: item.category, emoji: '🏷️', hex: '#64748b' };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <a
          href="#/"
          className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← 返回列表
        </a>

        <article className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {/* 徽章 */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${meta.badgeClass}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
              {meta.label}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: `${cat.hex}1a`, color: cat.hex }}
            >
              {cat.emoji} {cat.label}
            </span>
            {item.rank !== undefined && (
              <span className="text-sm font-semibold text-slate-400">#{item.rank}</span>
            )}
          </div>

          {/* 标题 + 缩略图 */}
          <div className="mt-5 flex items-start gap-4">
            <div className="relative h-20 w-20 shrink-0">
              <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-100 text-4xl">
                {cat.emoji}
              </span>
              {item.thumbnail && (
                <img
                  src={item.thumbnail}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 h-full w-full rounded-2xl object-cover"
                  onError={(e) => e.currentTarget.remove()}
                />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold leading-snug text-slate-900">{item.title}</h1>
              {item.description && (
                <p className="mt-1.5 text-slate-600">{item.description}</p>
              )}
            </div>
          </div>

          {/* 标签 */}
          {item.tags && item.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {item.tags.map((t) => (
                <span key={t} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* 信息网格 */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {item.score !== undefined && (
              <Stat label={`热度 · ${meta.scoreLabel}`} value={formatNumber(item.score)} />
            )}
            {item.rank !== undefined && <Stat label="排名" value={`#${item.rank}`} />}
            <Stat label="来源平台" value={meta.label} />
            <Stat label="类别" value={`${cat.emoji} ${cat.label}`} />
            {item.publishedAt && <Stat label="发布时间" value={formatDate(item.publishedAt)} />}
          </div>

          {/* 打开原链接 */}
          <div className="mt-6 border-t border-slate-100 pt-6">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow transition hover:bg-blue-700"
            >
              打开原链接
              <span aria-hidden>↗</span>
            </a>
            <p className="mt-3 break-all text-xs text-slate-400">{item.url}</p>
          </div>
        </article>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-0.5 font-semibold text-slate-800">{value}</div>
    </div>
  );
}
