import axios from 'axios';

const API_BASE = 'https://api.apify.com/v2';

export interface ApifyRunOptions {
  actorId: string;
  input: Record<string, unknown>;
  apiKey: string;
  timeoutSecs?: number;
  pollIntervalMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const token = encodeURIComponent(apiKey);

  // 1. 启动 run
  const startResp = await axios.post(`${API_BASE}/acts/${actorId}/runs?token=${token}`, input, {
    timeout: 30_000,
  });
  const runId: string | undefined = startResp.data?.data?.id;
  if (!runId) {
    throw new Error(`Apify 启动失败（${actorId}）：${JSON.stringify(startResp.data)}`);
  }
  console.log(`[apify] ${actorId} run 已启动：${runId}`);

  // 2. 轮询直到结束或超时
  const deadline = Date.now() + timeoutSecs * 1000;
  let status = '';
  while (Date.now() < deadline) {
    const statusResp = await axios.get(`${API_BASE}/actor-runs/${runId}?token=${token}`, {
      timeout: 30_000,
    });
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
  const itemsResp = await axios.get(
    `${API_BASE}/actor-runs/${runId}/dataset/items?token=${token}`,
    { timeout: 60_000 },
  );
  const items: unknown[] = Array.isArray(itemsResp.data) ? itemsResp.data : [];
  console.log(`[apify] ${actorId} 返回 ${items.length} 条数据`);
  return items;
}
