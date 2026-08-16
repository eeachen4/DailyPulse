import type { FeedItem } from '../../types';
import { SOURCE_META } from '../../types';
import { CATEGORY_META } from '../../categories';
import { formatNumber, formatDate } from '../format';
import ExpandableText from './ExpandableText';

export default function DetailPage({ item, items }: { item?: FeedItem; items: FeedItem[] }) {
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

  // 信息网格单元（含附加 stats）
  const cells: Array<{ label: string; value: string }> = [];
  if (item.score !== undefined) cells.push({ label: `热度 · ${meta.scoreLabel}`, value: formatNumber(item.score) });
  if (item.rank !== undefined) cells.push({ label: '排名', value: `No.${item.rank}` });
  if (item.rating !== undefined) cells.push({ label: '评分', value: `★ ${item.rating.toFixed(1)}` });
  if (item.price) cells.push({ label: '价格', value: item.price });
  if (item.comments !== undefined) cells.push({ label: '评论', value: formatNumber(item.comments) });
  cells.push({ label: '来源', value: meta.label });
  cells.push({ label: '类别', value: cat.label });
  if (item.publishedAt) cells.push({ label: '发布时间', value: formatDate(item.publishedAt) });
  if (item.stats) cells.push(...item.stats);

  const longDesc = item.longDescription && item.longDescription !== item.description ? item.longDescription : undefined;
  const externalUrl = item.externalUrl && item.externalUrl !== item.url ? item.externalUrl : undefined;

  const related = items
    .filter((it) => it.id !== item.id && it.category === item.category)
    .sort((a, b) => (b.score ?? Number.NEGATIVE_INFINITY) - (a.score ?? Number.NEGATIVE_INFINITY))
    .slice(0, 6);

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
            {item.rating !== undefined && <span className="text-ink">★ {item.rating.toFixed(1)}</span>}
            {item.price && <span>{item.price}</span>}
            {item.publishedAt && <span>{formatDate(item.publishedAt)}</span>}
          </div>

          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {item.title}
          </h1>

          {item.developer && (
            <p className="mt-3 font-mono text-sm text-muted">开发者 / 作者 · {item.developer}</p>
          )}

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

          {/* 完整描述 / 正文 */}
          {longDesc && (
            <section className="mt-7 border-t border-line pt-5">
              <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted">详情</h2>
              <ExpandableText
                text={longDesc}
                className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink/90"
              />
            </section>
          )}

          {/* 截图 */}
          {item.screenshots && item.screenshots.length > 0 && (
            <section className="mt-7 border-t border-line pt-5">
              <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted">截图</h2>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {item.screenshots.map((s) => (
                  <img
                    key={s}
                    src={s}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-44 w-auto shrink-0 border border-line bg-cream object-contain"
                    onError={(e) => e.currentTarget.remove()}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 信息网格（hairline 分隔） */}
          {cells.length > 0 && (
            <div className="mt-7 grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
              {cells.map((c) => (
                <Stat key={c.label + c.value} label={c.label} value={c.value} />
              ))}
            </div>
          )}

          {/* 链接 */}
          <div className="mt-8 border-t border-line pt-6">
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 bg-accent px-6 py-3 font-mono text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-accent-dark"
              >
                打开原链接
                <span aria-hidden>↗</span>
              </a>
              {externalUrl && (
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 border border-ink px-5 py-2.5 font-mono text-sm font-semibold uppercase tracking-wide text-ink transition hover:bg-ink hover:text-paper"
                >
                  访问原文
                  <span aria-hidden>↗</span>
                </a>
              )}
            </div>
            <p className="mt-3 break-all font-mono text-xs text-muted">{item.url}</p>
            {externalUrl && <p className="mt-1 break-all font-mono text-xs text-muted">{externalUrl}</p>}
          </div>

          {/* 相关推荐 */}
          {related.length > 0 && (
            <section className="mt-8 border-t border-line pt-6">
              <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted">
                相关推荐 · {cat.label}
              </h2>
              <div className="mt-1">
                {related.map((r) => {
                  const rMeta = SOURCE_META[r.source];
                  const rCat = CATEGORY_META[r.category] ?? { label: r.category, emoji: '', hex: '#6E675A' };
                  return (
                    <a
                      key={r.id}
                      href={`#/item/${encodeURIComponent(r.id)}`}
                      className="group flex items-center gap-3 border-b border-line py-3 last:border-b-0 transition hover:bg-cream/50"
                    >
                      <span className="h-1.5 w-1.5 shrink-0" style={{ backgroundColor: rCat.hex }} />
                      <span className="shrink-0 font-mono text-[11px] uppercase text-muted">{rMeta.short}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink transition group-hover:text-accent">
                        {r.title}
                      </span>
                      {r.score !== undefined && (
                        <span className="shrink-0 font-mono text-sm tabular-nums text-muted">
                          {formatNumber(r.score)}
                        </span>
                      )}
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="shrink-0 text-line transition group-hover:translate-x-0.5 group-hover:text-accent"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </a>
                  );
                })}
              </div>
            </section>
          )}
        </article>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper p-3">
      <div className="font-mono text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 break-words font-mono text-base font-semibold">{value}</div>
    </div>
  );
}
