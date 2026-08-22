import { SOURCE_META, type SourceHealth } from '../../types';

export default function HealthStrip({ health }: { health?: SourceHealth[] }) {
  if (!health?.length) {
    return (
      <div className="border-b border-line bg-panel/50 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted sm:px-6 lg:px-8">
        Source health will appear after the next collection run.
      </div>
    );
  }
  const healthy = health.filter((entry) => entry.status === 'healthy').length;
  const stale = health.filter((entry) => entry.status === 'stale').length;
  const unavailable = health.filter((entry) => entry.status === 'degraded' || entry.status === 'failed').length;

  return (
    <details className="group border-b border-line bg-panel/50">
      <summary className="mx-auto flex min-h-10 max-w-7xl cursor-pointer list-none items-center gap-3 px-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted sm:px-6 lg:px-8">
        <span className="h-1.5 w-1.5 bg-emerald-500" />
        <span>{healthy}/{health.length} sources current</span>
        {stale > 0 && <span className="text-accent">{stale} using recent archive</span>}
        {unavailable > 0 && <span>{unavailable} unavailable</span>}
        <span className="ml-auto transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="mx-auto grid max-w-7xl border-t border-line sm:grid-cols-2 lg:grid-cols-4">
        {health.map((entry) => {
          const affected = entry.categories?.filter((category) => category.status !== 'healthy').length ?? 0;
          return (
            <div key={entry.source} className="flex items-center justify-between border-b border-r border-line px-4 py-3 font-mono text-[10px]">
              <span className="text-ink">{SOURCE_META[entry.source].label}</span>
              <span className={entry.status === 'healthy' ? 'text-muted' : entry.status === 'stale' ? 'text-accent' : 'text-muted'}>
                {entry.status === 'healthy' ? `${entry.currentCount} current` : entry.status === 'stale' ? `${affected} archived` : 'unavailable'}
              </span>
            </div>
          );
        })}
      </div>
    </details>
  );
}
