import type { FeedItem } from '../../types';
import FeedCard from './FeedCard';

export default function FeedList({ items }: { items: FeedItem[] }) {
  if (items.length === 0) {
    return <div className="border border-line bg-panel px-6 py-20 text-center font-mono text-sm text-muted">当前筛选条件下暂无内容。</div>;
  }

  return <div className="overflow-hidden border border-line">{items.map((item, index) => <FeedCard key={item.id} item={item} index={index} />)}</div>;
}
