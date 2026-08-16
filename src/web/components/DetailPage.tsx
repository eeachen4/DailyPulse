import type { FeedItem } from '../../types';
import { SOURCE_META } from '../../types';
import { CATEGORY_META } from '../../categories';
import { formatNumber, formatDate } from '../format';

export default function DetailPage({ item }: { item?: FeedItem }) {
  if (!item) {
    return (
      <main className="min-h-screen bg-paper text-ink">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <a
            href="#/"
            className="font-mono text-xs uppercase tracking-wider text-muted transition hover:text-ink"
          >
            ← 返回
          </a>
          <div className="mt-6 border-y border-line py-16 text-center font-mono text-sm text-muted">
            未找到该条目（数据可能已更新），请返回列表查看。
          </div>
        </div>
      </main>
    );
  }

  const meta = SOURCE_META[item.source];
  const cat = CATEGORY_META[item.category] ?? { label: item.category, emoji: '', hex: '#6E675A' };

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <a
          href="#/"
          className="font-mono text-xs uppercase tracking-wider text-muted transition hover:text-ink"
        >
          ← 返回
        </a>

        <article className="mt-6 border-t-2 border-ink pt-6">
          {/* 元信息 */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs uppercase tracking-wide text-muted">
            <span className="font-medium text-ink">{meta.label}</span>
            <span style={{ color: cat.hex }}>{cat.label}</span>
            {item.rank !== undefined && <span>No.{item.rank}</span>}
            {item.publishedAt && <span>{formatDate(item.publishedAt)}</span>}
          </div>

          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {item.title}
          </h1>
          {item.description && (
            <p className="mt-4 text-lg leading-relaxed text-muted">{item.description}</p>
          )}

          {/* 缩略图 + 标签 */}
          <div className="mt-6 flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden border border-line bg-cream">
              <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-semibold text-muted">
                {meta.short}
              </span>
              {item.thumbnail && (
                <img
                  src={item.thumbnail}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(e) => e.currentTarget.remove()}
                />
              )}
            </div>
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {item.tags.map((t) => (
                  <span key={t} className="border border-line px-2 py-0.5 font-mono text-xs text-muted">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 信息网格（hairline 分隔） */}
          <div className="mt-8 grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
            {item.score !== undefined && (
              <Stat label={`热度 · ${meta.scoreLabel}`} value={formatNumber(item.score)} />
            )}
            {item.rank !== undefined && <Stat label="排名" value={`No.${item.rank}`} />}
            <Stat label="来源" value={meta.label} />
            <Stat label="类别" value={cat.label} />
            {item.publishedAt && <Stat label="发布时间" value={formatDate(item.publishedAt)} />}
          </div>

          {/* 打开原链接 */}
          <div className="mt-8 border-t border-line pt-6">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 bg-accent px-6 py-3 font-mono text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-accent-dark"
            >
              打开原链接
              <span aria-hidden>↗</span>
            </a>
            <p className="mt-3 break-all font-mono text-xs text-muted">{item.url}</p>
          </div>
        </article>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper p-3">
      <div className="font-mono text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 font-mono text-base font-semibold">{value}</div>
    </div>
  );
}
