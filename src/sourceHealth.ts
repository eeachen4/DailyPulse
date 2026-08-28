import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CATEGORIES } from './categories';
import { canonicalId, categoryIdsFor, sourceItemIdFor } from './dataModel';
import {
  SOURCES,
  type CategoryHealth,
  type FeedData,
  type FeedItem,
  type FetchRun,
  type Source,
  type SourceHealth,
} from './types';

export interface SourceHealthPolicy {
  minCount: number;
  minCategoryCount: number;
  critical: boolean;
  maxConsecutiveFailures: number;
  maxStaleDays: number;
}

const DEFAULT_POLICIES: Record<Source, SourceHealthPolicy> = {
  appstore: { minCount: 50, minCategoryCount: 5, critical: true, maxConsecutiveFailures: 2, maxStaleDays: 7 },
  googleplay: { minCount: 40, minCategoryCount: 5, critical: true, maxConsecutiveFailures: 2, maxStaleDays: 7 },
  producthunt: { minCount: 10, minCategoryCount: 1, critical: false, maxConsecutiveFailures: 3, maxStaleDays: 7 },
  reddit: { minCount: 1, minCategoryCount: 1, critical: false, maxConsecutiveFailures: 3, maxStaleDays: 3 },
  bluesky: { minCount: 1, minCategoryCount: 1, critical: false, maxConsecutiveFailures: 3, maxStaleDays: 3 },
  mastodon: { minCount: 20, minCategoryCount: 2, critical: false, maxConsecutiveFailures: 3, maxStaleDays: 3 },
  gdelt: { minCount: 1, minCategoryCount: 1, critical: false, maxConsecutiveFailures: 3, maxStaleDays: 3 },
  hackernews: { minCount: 20, minCategoryCount: 2, critical: true, maxConsecutiveFailures: 2, maxStaleDays: 5 },
  github: { minCount: 20, minCategoryCount: 2, critical: true, maxConsecutiveFailures: 2, maxStaleDays: 7 },
  huggingface: { minCount: 20, minCategoryCount: 2, critical: false, maxConsecutiveFailures: 3, maxStaleDays: 7 },
  stackoverflow: { minCount: 1, minCategoryCount: 1, critical: false, maxConsecutiveFailures: 3, maxStaleDays: 5 },
  arxiv: { minCount: 20, minCategoryCount: 2, critical: true, maxConsecutiveFailures: 2, maxStaleDays: 7 },
  rss: { minCount: 10, minCategoryCount: 1, critical: true, maxConsecutiveFailures: 2, maxStaleDays: 7 },
};

function envKey(prefix: string, source: Source): string {
  return `${prefix}_${source.replace(/[^a-z0-9]/gi, '_').toUpperCase()}`;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function sourceHealthPolicy(source: Source): SourceHealthPolicy {
  const defaults = DEFAULT_POLICIES[source];
  return {
    ...defaults,
    minCount: positiveInt(process.env[envKey('SOURCE_HEALTH_MIN', source)], defaults.minCount),
    minCategoryCount: positiveInt(
      process.env[envKey('SOURCE_HEALTH_MIN_CATEGORY', source)],
      defaults.minCategoryCount,
    ),
    maxConsecutiveFailures: positiveInt(
      process.env[envKey('SOURCE_HEALTH_MAX_FAILURES', source)],
      defaults.maxConsecutiveFailures,
    ),
    maxStaleDays: positiveInt(
      process.env[envKey('SOURCE_HEALTH_MAX_STALE_DAYS', source)],
      positiveInt(process.env.SOURCE_HEALTH_MAX_STALE_DAYS, defaults.maxStaleDays),
    ),
  };
}

async function readJson<T>(filePath: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(filePath, 'utf-8')) as T;
  } catch {
    return undefined;
  }
}

function shanghaiDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
}

async function loadPreviousData(): Promise<FeedData | undefined> {
  return readJson<FeedData>(path.resolve(process.cwd(), 'data/daily.json'));
}

async function loadHistoricalSnapshots(currentDate: string): Promise<FeedData[]> {
  const historyDir = path.resolve(process.cwd(), 'data/history');
  const index = await readJson<Array<{ date?: string; path?: string }>>(path.join(historyDir, 'index.json'));
  if (!Array.isArray(index)) return [];

  const snapshots: FeedData[] = [];
  for (const entry of index.slice(0, 30)) {
    if (!entry.path || entry.date === currentDate) continue;
    const snapshot = await readJson<FeedData>(path.join(historyDir, entry.path));
    if (snapshot) snapshots.push(snapshot);
  }
  return snapshots;
}

function countForSource(runs: FetchRun[] | undefined, source: Source): number {
  return (runs ?? [])
    .filter((run) => run.source === source)
    .reduce((sum, run) => sum + Math.max(0, run.count || 0), 0);
}

function snapshotWasHealthy(snapshot: FeedData, source: Source, policy: SourceHealthPolicy): boolean {
  const recorded = snapshot.sourceHealth?.find((entry) => entry.source === source);
  if (recorded) return recorded.status === 'healthy';
  return countForSource(snapshot.runs, source) >= policy.minCount;
}

function previousFailureStreak(snapshots: FeedData[], source: Source, policy: SourceHealthPolicy): number {
  let streak = 0;
  for (const snapshot of snapshots) {
    if (snapshotWasHealthy(snapshot, source, policy)) break;
    streak += 1;
  }
  return streak;
}

function itemKey(item: FeedItem): string {
  return canonicalId(item.source, sourceItemIdFor(item));
}

function includesCategory(item: FeedItem, categoryId: string): boolean {
  return categoryIdsFor(item).includes(categoryId);
}

function staleIsAllowed(staleFrom: string | undefined, fetchedAt: string, maxStaleDays: number): boolean {
  if (!staleFrom) return false;
  const age = new Date(fetchedAt).getTime() - new Date(staleFrom).getTime();
  return Number.isFinite(age) && age <= maxStaleDays * 24 * 60 * 60 * 1_000;
}

function mergeFallbackCategory(current: FeedItem, fallback: FeedItem, categoryId: string): FeedItem {
  return {
    ...current,
    categoryIds: [...new Set([...categoryIdsFor(current), ...categoryIdsFor(fallback), categoryId])],
    tags: [...new Set([...(current.tags ?? []), ...(fallback.tags ?? [])])],
  };
}

export interface SourceHealthResult {
  currentItems: FeedItem[];
  fallbackItems: FeedItem[];
  health: SourceHealth[];
}

export async function applySourceHealth(
  collected: FeedItem[],
  runs: FetchRun[],
  fetchedAt = new Date().toISOString(),
): Promise<SourceHealthResult> {
  const previous = await loadPreviousData();
  const snapshots = await loadHistoricalSnapshots(shanghaiDate(fetchedAt));
  const allCurrent: FeedItem[] = [];
  const allFallback: FeedItem[] = [];
  const health: SourceHealth[] = [];

  for (const source of SOURCES) {
    const policy = sourceHealthPolicy(source);
    const sourceItems = collected.filter((item) => item.source === source);
    const previousSourceItems = previous?.items.filter((item) => item.source === source) ?? [];
    const published = new Map<string, FeedItem>();
    const freshKeys = new Set<string>();
    for (const item of sourceItems) {
      const key = itemKey(item);
      const existing = published.get(key);
      published.set(key, existing ? mergeFallbackCategory({ ...existing, ...item }, existing, categoryIdsFor(item)[0] ?? 'uncategorized') : item);
      freshKeys.add(key);
    }

    const categories: CategoryHealth[] = [];
    for (const category of CATEGORIES) {
      const run = runs.find((entry) => entry.source === source && entry.categoryId === category.id);
      const currentCount = Math.max(0, run?.count ?? sourceItems.filter((item) => includesCategory(item, category.id)).length);
      const healthy = currentCount >= policy.minCategoryCount;
      let fallbackAdded = 0;
      let staleFrom: string | undefined;

      if (!healthy) {
        for (const item of previousSourceItems.filter((entry) => includesCategory(entry, category.id))) {
          const candidateStaleFrom = item.staleFrom ?? previous?.fetchedAt ?? undefined;
          if (!staleIsAllowed(candidateStaleFrom, fetchedAt, policy.maxStaleDays)) continue;
          const key = itemKey(item);
          const existing = published.get(key);
          if (existing) {
            published.set(key, mergeFallbackCategory(existing, item, category.id));
            continue;
          }
          published.set(key, { ...item, stale: true, staleFrom: candidateStaleFrom });
          fallbackAdded += 1;
          staleFrom = staleFrom ?? candidateStaleFrom;
        }
      }

      const publishedCount = [...published.values()].filter((item) => includesCategory(item, category.id)).length;
      const fallbackUsed = fallbackAdded > 0;
      categories.push({
        categoryId: category.id,
        status: healthy ? 'healthy' : fallbackUsed ? 'stale' : currentCount > 0 ? 'degraded' : 'failed',
        currentCount,
        publishedCount,
        minCount: policy.minCategoryCount,
        fallbackUsed,
        staleFrom,
        error: run?.error,
      });
    }

    const currentCount = countForSource(runs, source);
    const sourceHealthy = currentCount >= policy.minCount && categories.every((entry) => entry.status === 'healthy');
    const fallbackUsed = categories.some((entry) => entry.fallbackUsed);
    const errors = [...new Set(
      runs.filter((run) => run.source === source && run.error).map((run) => run.error as string),
    )];
    const status: SourceHealth['status'] = sourceHealthy
      ? 'healthy'
      : fallbackUsed
        ? 'stale'
        : currentCount > 0
          ? 'degraded'
          : 'failed';
    const consecutiveFailures = sourceHealthy ? 0 : previousFailureStreak(snapshots, source, policy) + 1;
    const publishedItems = [...published.entries()];
    allCurrent.push(...publishedItems.filter(([key]) => freshKeys.has(key)).map(([, item]) => item));
    allFallback.push(...publishedItems.filter(([key]) => !freshKeys.has(key)).map(([, item]) => item));

    health.push({
      source,
      status,
      currentCount,
      publishedCount: published.size,
      minCount: policy.minCount,
      critical: policy.critical,
      consecutiveFailures,
      maxConsecutiveFailures: policy.maxConsecutiveFailures,
      maxStaleDays: policy.maxStaleDays,
      fallbackUsed,
      staleFrom: categories.find((entry) => entry.staleFrom)?.staleFrom,
      errors: errors.length ? errors : undefined,
      categories,
    });
  }

  return { currentItems: allCurrent, fallbackItems: allFallback, health };
}

export function healthGateFailures(health: SourceHealth[]): SourceHealth[] {
  return health.filter(
    (entry) => entry.critical
      && entry.status !== 'healthy'
      && entry.consecutiveFailures > entry.maxConsecutiveFailures,
  );
}

/** 当前采集必须实际覆盖的来源；历史保底条目不能冒充本轮成功。 */
export function coverageGateFailures(health: SourceHealth[], requiredSources: readonly Source[] = SOURCES): SourceHealth[] {
  const required = new Set(requiredSources);
  return health.filter((entry) => required.has(entry.source) && entry.currentCount < 1);
}
