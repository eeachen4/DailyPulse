import { CATEGORIES } from '../../categories';

interface Props {
  value: string; // 'all' 或类别 label
  onChange: (v: string) => void;
  counts: Record<string, number>;
}

export default function CategoryFilter({ value, onChange, counts }: Props) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CatButton
        active={value === 'all'}
        label="全部"
        emoji="🗂️"
        count={total}
        hex="#0f172a"
        onClick={() => onChange('all')}
      />
      {CATEGORIES.map((c) => (
        <CatButton
          key={c.id}
          active={value === c.label}
          label={c.label}
          emoji={c.emoji}
          count={counts[c.label] ?? 0}
          hex={c.hex}
          onClick={() => onChange(c.label)}
        />
      ))}
    </div>
  );
}

function CatButton({
  active,
  label,
  emoji,
  count,
  hex,
  onClick,
}: {
  active: boolean;
  label: string;
  emoji: string;
  count: number;
  hex: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition"
      style={
        active
          ? { backgroundColor: `${hex}1a`, color: hex, borderColor: hex }
          : { backgroundColor: '#fff', color: '#475569', borderColor: '#e2e8f0' }
      }
    >
      <span>{emoji}</span>
      {label}
      <span
        className="rounded-full px-1.5 text-xs font-semibold"
        style={{ backgroundColor: active ? `${hex}26` : '#f1f5f9', color: active ? hex : '#64748b' }}
      >
        {count}
      </span>
    </button>
  );
}
