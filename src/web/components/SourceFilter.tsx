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
      <FilterButton
        active={value === 'all'}
        activeClass="bg-slate-900 text-white border-slate-900"
        label="全部"
        count={total}
        onClick={() => onChange('all')}
      />
      {SOURCES.map((s) => (
        <FilterButton
          key={s}
          active={value === s}
          activeClass={SOURCE_META[s].badgeClass}
          label={SOURCE_META[s].label}
          count={counts[s]}
          onClick={() => onChange(s)}
        />
      ))}
    </div>
  );
}

function FilterButton({
  active,
  activeClass,
  label,
  count,
  onClick,
}: {
  active: boolean;
  activeClass: string;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
        active
          ? `${activeClass} border-transparent shadow-sm`
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
      }`}
    >
      {label}
      <span className="rounded-full bg-black/10 px-1.5 text-xs font-semibold">{count}</span>
    </button>
  );
}
