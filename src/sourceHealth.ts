import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { SOURCES, type FeedData, type FeedItem, type FetchRun, type Source, type SourceHealth } from './types';

export interface SourceHealthPolicy {
  minCount: number;
  critical: boolean;
  maxConsecutiveFailures: number;
}

const DEFAULT_POLICIES: Record<Source, SourceHealthPolicy> = {
  appstore: { minCount: 50, critical: true, maxConsecutiveFailures: 2 },
  googleplay: { minCount: 40, critical: true, maxConsecutiveFailures: 2 },
  producthunt: { minCount: 10, critical: false, maxConsecutiveFailures: 3 },
  reddit: { minCount: 1, critical: false, maxConsecutiveFailures: 3 },
  bluesky: { minCount: 1, critical: false, maxConsecutiveFailures: 3 },
  mastodon: { minCount: 20, critical: false, maxConsecutiveFailures: 3 },
  gdelt: { minCount: 1, critical: false, maxConsecutiveFailures: 3 },
  hackernews: { minCount: 20, critical: true, maxConsecutiveFailures: 2 },
  github: { minCount: 20, critical: true, maxConsecutiveFailures: 2 },
  huggingface: { minCount: 20, critical: false, maxConsecutiveFailures: 3 },
  stackoverflow: { minCount: 1, critical: false, maxConsecutiveFailures: 3 },
  arxiv: { minCount: 20, critical: true, maxConsecutiveFailures: 2 },
  rss: { minCount: 10, critical: true, maxConsecutiveFailures: 2 },
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
    maxConsecutiveFailures: positiveInt(
      process.env[envKey('SOURCE_HEALTH_MAX_FAILURES', source)],
      defaults.maxConsecutiveFailures,
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

function previousFailureStreak(
  snapshots: FeedData[],
  source: Source,
  policy: SourceHealthPolicy,
): number {
  let streak = 0;
  for (const snapshot of snapshots) {
    if (snapshotWasHealthy(snapshot, source, policy)) break;
    streak += 1;
  }
  return streak;
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
  const currentItems: FeedItem[] = [];
  const fallbackItems: FeedItem[] = [];
  const health: SourceHealth[] = [];

  for (const source of SOURCES) {
    const policy = sourceHealthPolicy(source);
    const sourceItems = collected.filter((item) => item.source === source);
    const currentCount = countForSource(runs, source);
    const healthy = currentCount >= policy.minCount;
    const previousSourceItems = previous?.items.filter((item) => item.source === source) ?? [];
    const fallbackUsed = !healthy && previousSourceItems.length > 0;
    const errors = [...new Set(
      runs
        .filter((run) => run.source === source && run.error)
        .map((run) => run.error as string),
    )];

    if (healthy || !fallbackUsed) {
      currentItems.push(...sourceItems);
    } else {
      fallbackItems.push(...previousSourceItems.map((item) => ({
        ...item,
        stale: true,
        staleFrom: item.staleFrom ?? previous?.fetchedAt ?? undefined,
      })));
    }

    const status: SourceHealth['status'] = healthy
      ? 'healthy'
      : fallbackUsed
        ? 'stale'
        : currentCount > 0
          ? 'degraded'
          : 'failed';
    const consecutiveFailures = healthy ? 0 : previousFailureStreak(snapshots, source, policy) + 1;

    health.push({
      source,
      status,
      currentCount,
      publishedCount: fallbackUsed ? previousSourceItems.length : sourceItems.length,
      minCount: policy.minCount,
      critical: policy.critical,
      consecutiveFailures,
      maxConsecutiveFailures: policy.maxConsecutiveFailures,
      fallbackUsed,
      staleFrom: fallbackUsed ? previous?.fetchedAt ?? undefined : undefined,
      errors: errors.length ? errors : undefined,
    });
  }

  return { currentItems, fallbackItems, health };
}

export function healthGateFailures(health: SourceHealth[]): SourceHealth[] {
  return health.filter(
    (entry) => entry.critical
      && entry.status !== 'healthy'
      && entry.consecutiveFailures > entry.maxConsecutiveFailures,
  );
}
