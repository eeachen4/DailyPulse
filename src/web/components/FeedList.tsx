import type { FeedItem } from '../../types';
import FeedCard from './FeedCard';
import type { ContentLanguage } from '../preferences';

export default function FeedList({
  items,
  language,
  favorites,
  readItems,
  onToggleFavorite,
  onShare,
}: {
  items: FeedItem[];
  language: ContentLanguage;
  favorites: Set<string>;
  readItems: Set<string>;
  onToggleFavorite: (item: FeedItem) => void;
  onShare: (item: FeedItem) => void;
}) {
  if (items.length === 0) {
    return <div className="border border-line bg-panel px-6 py-20 text-center font-mono text-sm text-muted">当前筛选条件下暂无内容。</div>;
  }

  return <div className="overflow-hidden border border-line">{items.map((item, index) => (
    <FeedCard
      key={item.id}
      item={item}
      index={index}
      language={language}
      isFavorite={favorites.has(item.id)}
      isRead={readItems.has(item.id)}
      onToggleFavorite={onToggleFavorite}
      onShare={onShare}
    />
  ))}</div>;
}
