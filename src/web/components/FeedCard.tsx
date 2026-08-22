import type { FeedItem } from '../../types';
import { SOURCE_META } from '../../types';
import { CATEGORY_META_BY_ID } from '../../categories';
import { primaryCategoryId } from '../../dataModel';
import { formatDate } from '../format';
import { displayDescription, displayTitle, type ContentLanguage } from '../preferences';

export interface FeedCardProps {
  item: FeedItem;
  index: number;
  language: ContentLanguage;
  isFavorite: boolean;
  isRead: boolean;
  onToggleFavorite: (item: FeedItem) => void;
  onShare: (item: FeedItem) => void;
}

export default function FeedCard({
  item,
  index,
  language,
  isFavorite,
  isRead,
  onToggleFavorite,
  onShare,
}: FeedCardProps) {
  const meta = SOURCE_META[item.source];
  const cat = CATEGORY_META_BY_ID[primaryCategoryId(item)] ?? { label: primaryCategoryId(item), emoji: '', hex: '#ff6b45' };
  const itemHref = '#/item/' + encodeURIComponent(item.id);

  return (
    <article
      className={`feed-card group grid grid-cols-[30px_64px_minmax(0,1fr)] gap-3 border-b border-line px-4 py-4 transition hover:bg-panel-strong sm:grid-cols-[42px_72px_minmax(0,1fr)_92px_96px] sm:items-center sm:gap-4 sm:px-5 ${isRead ? 'bg-paper/60' : 'bg-panel'}`}
      style={{ animationDelay: Math.min(index, 12) * 28 + 'ms' }}
    >
      <div className="pt-1 font-mono text-xs tabular-nums text-muted">{String(index + 1).padStart(2, '0')}</div>

      <a href={itemHref} className="relative h-16 w-16 overflow-hidden border border-line bg-cream sm:h-[72px] sm:w-[72px]" aria-label={`打开 ${displayTitle(item, language)}`}>
        <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold tracking-[0.08em] text-muted sm:text-base">{meta.short}</span>
        {item.thumbnail && (
          <img src={item.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" onError={(event) => event.currentTarget.remove()} />
        )}
      </a>

      <div className="min-w-0 py-0.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
          <span className="text-ink">{meta.label}</span>
          <span style={{ color: cat.hex }}>{cat.label}</span>
          {item.stale && <span className="border border-accent/50 px-1.5 py-0.5 text-accent">archive</span>}
          {isRead && <span>read</span>}
          {item.publishedAt && <span className="hidden lg:inline">{formatDate(item.publishedAt)}</span>}
        </div>
        <a href={itemHref} className="mt-2 block">
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink transition-colors group-hover:text-accent sm:text-base">{displayTitle(item, language)}</h3>
          <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-muted sm:line-clamp-2 sm:text-sm">{displayDescription(item, language) || item.tags?.join(' · ') || '打开条目查看完整详情'}</p>
        </a>
        <div className="mt-2 flex items-center gap-2 sm:hidden">
          <button type="button" onClick={() => onToggleFavorite(item)} className="min-h-11 border border-line px-3 font-mono text-[10px] uppercase tracking-wider text-muted" aria-pressed={isFavorite}>{isFavorite ? 'Saved' : 'Save'}</button>
          <button type="button" onClick={() => onShare(item)} className="min-h-11 border border-line px-3 font-mono text-[10px] uppercase tracking-wider text-muted">Share</button>
          {item.topicId && <a href={'#/topic/' + encodeURIComponent(item.topicId)} className="flex min-h-11 items-center px-2 font-mono text-[10px] uppercase tracking-wider text-accent">Topic →</a>}
        </div>
      </div>

      <div className="hidden text-right sm:block">
        <div className="font-mono text-lg font-semibold tabular-nums text-ink">{item.heatScore !== undefined ? item.heatScore.toFixed(0) : '—'}</div>
        <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-muted">{item.heatScore !== undefined ? 'normalized heat' : '暂无热度'}</div>
        {item.topicId && <a href={'#/topic/' + encodeURIComponent(item.topicId)} className="mt-2 block font-mono text-[9px] uppercase tracking-wider text-accent">Topic →</a>}
      </div>

      <div className="hidden grid-cols-2 gap-1 sm:grid">
        <button type="button" onClick={() => onToggleFavorite(item)} className={`flex h-11 w-11 items-center justify-center border font-mono text-lg ${isFavorite ? 'border-accent bg-accent text-white' : 'border-line text-muted hover:border-accent hover:text-accent'}`} aria-label={isFavorite ? '取消收藏' : '收藏'} aria-pressed={isFavorite}>☆</button>
        <button type="button" onClick={() => onShare(item)} className="flex h-11 w-11 items-center justify-center border border-line font-mono text-sm text-muted hover:border-accent hover:text-accent" aria-label="分享">↗</button>
      </div>
    </article>
  );
}
