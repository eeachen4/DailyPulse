import { CATEGORIES } from '../../categories';

interface Props {
  value: string;
  onChange: (v: string) => void;
  counts: Record<string, number>;
}

export default function CategoryFilter({ value, onChange, counts }: Props) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-1">
      <FilterRow active={value === 'all'} label="全部信号" count={total} onClick={() => onChange('all')} />
      {CATEGORIES.map((category) => (
        <FilterRow
          key={category.id}
          active={value === category.id}
          label={category.label}
          count={counts[category.id] ?? 0}
          color={category.hex}
          onClick={() => onChange(category.id)}
        />
      ))}
    </div>
  );
}

function FilterRow({
  active,
  label,
  count,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active
        ? 'flex min-h-11 w-full items-center justify-between border border-accent bg-accent-soft px-3 text-left font-mono text-xs text-ink transition'
        : 'flex min-h-11 w-full items-center justify-between border border-transparent px-3 text-left font-mono text-xs text-muted transition hover:border-line hover:bg-cream/50 hover:text-ink'}
    >
      <span className="flex items-center gap-2">
        <span className="h-1.5 w-1.5" style={{ backgroundColor: color ?? 'rgb(var(--accent))' }} />
        {label}
      </span>
      <span className={active ? 'text-accent' : 'text-muted'}>{String(count).padStart(2, '0')}</span>
    </button>
  );
}
