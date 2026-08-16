import type { FeedItem } from '../../types';
import FeedCard from './FeedCard';

export default function FeedList({ items }: { items: FeedItem[] }) {
  if (items.length === 0) {
    return (
      <div className="border-y border-line py-16 text-center font-mono text-sm text-muted">
        当前筛选条件下暂无内容。
      </div>
    );
  }

  return (
    <div className="divide-y divide-line border-b border-line">
      {items.map((item) => (
        <FeedCard key={item.id} item={item} />
      ))}
    </div>
  );
}
