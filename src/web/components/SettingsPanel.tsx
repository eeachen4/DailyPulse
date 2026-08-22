import { CATEGORIES } from '../../categories';
import { SOURCES, SOURCE_META, type Source } from '../../types';
import { DEFAULT_PREFERENCES, normalizeKeywords, type UserPreferences } from '../preferences';

export default function SettingsPanel({
  open,
  value,
  onChange,
  onClose,
}: {
  open: boolean;
  value: UserPreferences;
  onChange: (value: UserPreferences) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  const setWeight = (source: Source, weight: number) => onChange({
    ...value,
    sourceWeights: { ...value.sourceWeights, [source]: weight },
  });
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/55" role="dialog" aria-modal="true" aria-label="Personal signal settings" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-line bg-paper p-5 text-ink sm:p-7" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line pb-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Personal desk</p>
            <h2 className="mt-2 text-2xl font-semibold">Signal settings</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center border border-line text-xl text-muted hover:border-accent hover:text-accent" aria-label="关闭设置">×</button>
        </div>

        <section className="border-b border-line py-6">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Content language</h3>
          <div className="mt-3 grid grid-cols-3">
            {([['auto', '中文优先'], ['zh', '中文'], ['original', '原文']] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => onChange({ ...value, language: id })} className={`min-h-11 border border-line px-2 font-mono text-xs ${value.language === id ? 'bg-accent text-white' : 'text-muted hover:text-ink'}`}>{label}</button>
            ))}
          </div>
        </section>

        <section className="border-b border-line py-6">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Enabled topics</h3>
          <div className="mt-3 grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
            {CATEGORIES.map((category) => {
              const checked = value.enabledCategories.includes(category.id);
              return (
                <label key={category.id} className="flex min-h-11 cursor-pointer items-center gap-2 bg-panel px-3 font-mono text-xs">
                  <input type="checkbox" checked={checked} onChange={() => onChange({
                    ...value,
                    enabledCategories: checked
                      ? value.enabledCategories.filter((id) => id !== category.id)
                      : [...value.enabledCategories, category.id],
                  })} />
                  {category.label}
                </label>
              );
            })}
          </div>
        </section>

        <section className="grid gap-5 border-b border-line py-6 sm:grid-cols-2">
          <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Watch keywords
            <textarea defaultValue={value.watchKeywords.join(', ')} onBlur={(event) => onChange({ ...value, watchKeywords: normalizeKeywords(event.target.value) })} placeholder="MCP, local AI, Rust" className="mt-3 min-h-24 w-full resize-y border border-line bg-panel p-3 font-sans text-sm normal-case tracking-normal text-ink outline-none focus:border-accent" />
          </label>
          <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Blocked keywords
            <textarea defaultValue={value.blockedKeywords.join(', ')} onBlur={(event) => onChange({ ...value, blockedKeywords: normalizeKeywords(event.target.value) })} placeholder="crypto, giveaway" className="mt-3 min-h-24 w-full resize-y border border-line bg-panel p-3 font-sans text-sm normal-case tracking-normal text-ink outline-none focus:border-accent" />
          </label>
        </section>

        <section className="py-6">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Source weights</h3>
          <div className="mt-3 divide-y divide-line border-y border-line">
            {SOURCES.map((source) => (
              <label key={source} className="grid min-h-11 grid-cols-[120px_minmax(0,1fr)_40px] items-center gap-3 font-mono text-[10px]">
                <span>{SOURCE_META[source].label}</span>
                <input type="range" min="0" max="2" step="0.25" value={value.sourceWeights[source]} onChange={(event) => setWeight(source, Number(event.target.value))} />
                <span className="text-right text-muted">{value.sourceWeights[source].toFixed(2)}</span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">0 hides a source; watched keywords receive a ranking boost. Preferences stay in this browser.</p>
        </section>

        <div className="flex gap-2 border-t border-line pt-5">
          <button type="button" onClick={() => onChange({ ...DEFAULT_PREFERENCES, sourceWeights: { ...DEFAULT_PREFERENCES.sourceWeights } })} className="min-h-11 flex-1 border border-line font-mono text-xs uppercase tracking-wider text-muted hover:border-accent hover:text-accent">Reset</button>
          <button type="button" onClick={onClose} className="min-h-11 flex-1 bg-accent font-mono text-xs font-semibold uppercase tracking-wider text-white hover:bg-accent-dark">Done</button>
        </div>
      </div>
    </div>
  );
}
