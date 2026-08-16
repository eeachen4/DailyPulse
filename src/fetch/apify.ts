import axios from 'axios';

const API_BASE = 'https://api.apify.com/v2';

export interface ApifyRunOptions {
  actorId: string;
  input: Record<string, unknown>;
  apiKey: string;
  timeoutSecs?: number;
  pollIntervalMs?: number;
  retries?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, label: string, retries: number): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      const delay = 1_000 * 2 ** attempt;
      console.warn(`[apify] ${label} 失败，${delay}ms 后重试（${attempt + 1}/${retries}）`);
      await sleep(delay);
    }
  }
  throw lastError;
}

/**
 * 通用 Apify Actor 调用流程：
 *   1. POST /v2/acts/{actorId}/runs 启动一次 run
 *   2. 轮询 GET /v2/actor-runs/{runId} 直到 SUCCEEDED / FAILED / ABORTED / TIMED-OUT
 *   3. GET /v2/actor-runs/{runId}/dataset/items 读取结果
 *
 * 不依赖任何 SDK，直接调用 REST 端点，token 通过查询参数传入。
 */
export async function runApifyActor(opts: ApifyRunOptions): Promise<unknown[]> {
  const { actorId, input, apiKey } = opts;
  const timeoutSecs = opts.timeoutSecs ?? 300;
  const pollIntervalMs = opts.pollIntervalMs ?? 10_000;
  const retries = opts.retries ?? Number(process.env.APIFY_RETRIES || 3);
  const token = encodeURIComponent(apiKey);

  // 1. 启动 run
  const startResp = await withRetry(
    () => axios.post(`${API_BASE}/acts/${actorId}/runs?token=${token}`, input, { timeout: 30_000 }),
    '启动 run',
    retries,
  );
  const runId: string | undefined = startResp.data?.data?.id;
  if (!runId) {
    throw new Error(`Apify 启动失败（${actorId}）：${JSON.stringify(startResp.data)}`);
  }
  console.log(`[apify] ${actorId} run 已启动：${runId}`);

  // 2. 轮询直到结束或超时
  const deadline = Date.now() + timeoutSecs * 1000;
  let status = '';
  while (Date.now() < deadline) {
    const statusResp = await withRetry(
      () => axios.get(`${API_BASE}/actor-runs/${runId}?token=${token}`, { timeout: 30_000 }),
      '查询 run 状态',
      retries,
    );
    status = statusResp.data?.data?.status ?? '';
    if (['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
      break;
    }
    await sleep(pollIntervalMs);
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Apify run ${runId} 未成功（状态：${status || 'TIMEOUT'}）`);
  }

  // 3. 读取数据集
  const itemsResp = await withRetry(
    () =>
      axios.get(`${API_BASE}/actor-runs/${runId}/dataset/items?token=${token}`, {
        timeout: 60_000,
      }),
    '读取 dataset',
    retries,
  );
  const items: unknown[] = Array.isArray(itemsResp.data) ? itemsResp.data : [];
  console.log(`[apify] ${actorId} 返回 ${items.length} 条数据`);
  return items;
}
