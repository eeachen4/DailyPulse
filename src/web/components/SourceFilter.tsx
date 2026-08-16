import type { Source } from '../../types';
import { SOURCES, SOURCE_META } from '../../types';

interface Props {
  value: Source | 'all';
  onChange: (v: Source | 'all') => void;
  counts: Record<Source, number>;
}

export default function SourceFilter({ value, onChange, counts }: Props) {
  return (
    <div className="space-y-1">
      <SourceRow active={value === 'all'} label="全部来源" count={Object.values(counts).reduce((a, b) => a + b, 0)} onClick={() => onChange('all')} />
      {SOURCES.map((source) => (
        <SourceRow
          key={source}
          active={value === source}
          label={SOURCE_META[source].label}
          count={counts[source]}
          color={SOURCE_META[source].hex}
          onClick={() => onChange(source)}
        />
      ))}
    </div>
  );
}

function SourceRow({
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
        ? 'flex min-h-11 w-full items-center justify-between border border-line bg-cream px-3 text-left font-mono text-xs text-ink transition'
        : 'flex min-h-11 w-full items-center justify-between border border-transparent px-3 text-left font-mono text-xs text-muted transition hover:border-line hover:text-ink'}
    >
      <span className="flex items-center gap-2">
        <span className="h-1.5 w-1.5" style={{ backgroundColor: color ?? 'rgb(var(--muted))' }} />
        {label}
      </span>
      <span>{String(count).padStart(2, '0')}</span>
    </button>
  );
}
