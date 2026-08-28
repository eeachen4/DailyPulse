import { appendFile, readFile } from 'node:fs/promises';

const SHANGHAI_TIME_ZONE = 'Asia/Shanghai';
const DEFAULT_MAX_AGE_HOURS = 12;

function dateInTimeZone(value, timeZone = SHANGHAI_TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function snapshotFreshness(snapshot, now = new Date(), maxAgeHours = DEFAULT_MAX_AGE_HOURS) {
  const fetchedAt = snapshot?.fetchedAt ? new Date(snapshot.fetchedAt) : undefined;
  if (!fetchedAt || !Number.isFinite(fetchedAt.getTime())) {
    return { fresh: false, reason: 'missing-or-invalid-fetchedAt' };
  }

  const ageHours = Math.max(0, (now.getTime() - fetchedAt.getTime()) / 3_600_000);
  const snapshotDate = dateInTimeZone(fetchedAt);
  const currentDate = dateInTimeZone(now);
  const fresh = snapshotDate === currentDate && ageHours <= maxAgeHours;
  return {
    fresh,
    reason: fresh ? 'current-shanghai-day' : snapshotDate !== currentDate ? 'previous-shanghai-day' : 'snapshot-too-old',
    snapshotDate,
    ageHours,
  };
}

async function readSnapshot() {
  try {
    return JSON.parse(await readFile('data/daily.json', 'utf8'));
  } catch {
    return undefined;
  }
}

async function writeOutputs(values) {
  const lines = Object.entries(values).map(([key, value]) => `${key}=${String(value)}\n`).join('');
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, lines, 'utf8');
  else process.stdout.write(lines);
}

const force = process.env.FORCE_FETCH === 'true';
const maxAgeHours = Number(process.env.FRESHNESS_MAX_AGE_HOURS || DEFAULT_MAX_AGE_HOURS);
const now = process.env.FRESHNESS_NOW ? new Date(process.env.FRESHNESS_NOW) : new Date();
const result = snapshotFreshness(await readSnapshot(), now, maxAgeHours);
const shouldFetch = force || !result.fresh;
await writeOutputs({
  should_fetch: shouldFetch,
  reason: force ? 'manual-force' : result.reason,
  snapshot_date: result.snapshotDate ?? 'missing',
  snapshot_age_hours: result.ageHours?.toFixed(2) ?? 'unknown',
});
console.log(`[freshness] ${shouldFetch ? 'fetch' : 'skip'} · ${force ? 'manual-force' : result.reason}`);
