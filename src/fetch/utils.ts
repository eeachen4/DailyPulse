/**
 * 防御性的字段归一化工具。
 * 不同 Apify Actor 的输出字段名可能略有差异，这里统一用「候选键」取值，
 * 保证单个字段缺失不影响整体采集。
 */

export function pickStr(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return undefined;
}

export function pickValue(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

export function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    if (cleaned === '' || cleaned === '-' || cleaned === '.') return undefined;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function pickNum(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const n = toNumber(obj?.[k]);
    if (n !== undefined) return n;
  }
  return undefined;
}

export function toIso(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** 构造附加键值对，值为空时返回 null。 */
export function kv(label: string, value: unknown): { label: string; value: string } | null {
  if (value === undefined || value === null || value === '') return null;
  const s = String(value).trim();
  return s ? { label, value: s } : null;
}

/** 将「字符串数组 / 对象数组 / 单个字符串」统一合并为逗号分隔的字符串。 */
export function toJoined(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const parts = value
      .map((v) => {
        if (typeof v === 'string') return v;
        if (v && typeof v === 'object') {
          const o = v as Record<string, unknown>;
          return String(o.name ?? o.title ?? o.slug ?? '');
        }
        return '';
      })
      .filter((s) => s !== '');
    return parts.length ? parts.join(', ') : undefined;
  }
  if (typeof value === 'string' && value.trim() !== '') return value;
  return undefined;
}
