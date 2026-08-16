import type { Source } from '../../types';
import { SOURCES, SOURCE_META } from '../../types';

interface Props {
  value: Source | 'all';
  onChange: (v: Source | 'all') => void;
  counts: Record<Source, number>;
}

export default function SourceFilter({ value, onChange, counts }: Props) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip active={value === 'all'} label="全部" count={total} onClick={() => onChange('all')} />
      {SOURCES.map((s) => (
        <Chip
          key={s}
          active={value === s}
          label={SOURCE_META[s].label}
          count={counts[s]}
          hex={SOURCE_META[s].hex}
          onClick={() => onChange(s)}
        />
      ))}
    </div>
  );
}

function Chip({
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
      className={`inline-flex min-h-11 items-center gap-1.5 border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition ${
        active
          ? 'border-ink bg-ink text-paper'
          : 'border-line text-muted hover:border-muted hover:text-ink'
      }`}
    >
      {hex && <span className="h-1.5 w-1.5" style={{ backgroundColor: hex }} />}
      {label}
      <span className={active ? 'opacity-60' : 'text-muted/70'}>{count}</span>
    </button>
  );
}
