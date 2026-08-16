import { CATEGORIES } from '../../categories';

interface Props {
  value: string; // 'all' 或类别 label
  onChange: (v: string) => void;
  counts: Record<string, number>;
}

export default function CategoryFilter({ value, onChange, counts }: Props) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-wrap items-center gap-x-7 gap-y-1 border-b border-line">
      <Tab active={value === 'all'} label="全部" count={total} onClick={() => onChange('all')} />
      {CATEGORIES.map((c) => (
        <Tab
          key={c.id}
          active={value === c.label}
          label={c.label}
          count={counts[c.label] ?? 0}
          hex={c.hex}
          onClick={() => onChange(c.label)}
        />
      ))}
    </div>
  );
}

function Tab({
  active,
  label,
  count,
  hex,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  hex?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-h-11 items-center gap-2 border-b-2 px-1 font-mono text-sm transition ${
        active ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
      }`}
    >
      {hex && <span className="h-1.5 w-1.5" style={{ backgroundColor: hex }} />}
      {label}
      <span className={`text-xs tabular-nums ${active ? 'text-accent' : 'text-muted/70'}`}>
        {count}
      </span>
    </button>
  );
}
