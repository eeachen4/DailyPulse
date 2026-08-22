import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FeedData } from '../types';
import { DATA_SCHEMA_VERSION, SOURCES } from '../types';
import { categoryIdsFor } from '../dataModel';
import { CATEGORIES } from '../categories';

async function main(): Promise<void> {
  const filePath = path.resolve(process.cwd(), 'data/daily.json');
  const data = JSON.parse(await readFile(filePath, 'utf-8')) as FeedData;
  if (data.schemaVersion !== DATA_SCHEMA_VERSION) {
    throw new Error(`schemaVersion 必须为 ${DATA_SCHEMA_VERSION}，当前为 ${data.schemaVersion ?? '(missing)'}`);
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('daily.json 没有任何条目');
  }

  const ids = new Set<string>();
  for (const item of data.items) {
    if (!item.id || ids.has(item.id)) throw new Error(`ID 缺失或重复：${item.id || '(empty)'}`);
    if (!item.title || categoryIdsFor(item).length === 0) throw new Error(`条目字段缺失：${item.id}`);
    if (!SOURCES.includes(item.source)) throw new Error(`未知来源 ${item.source}：${item.id}`);
    if (!/^https?:\/\//.test(item.url)) throw new Error(`非法 URL：${item.id}`);
    if (item.heatScore !== undefined && (item.heatScore < 0 || item.heatScore > 100)) {
      throw new Error(`heatScore 超出范围：${item.id}`);
    }
    if (item.detailRef) {
      try {
        await access(path.resolve(process.cwd(), 'data', item.detailRef));
      } catch {
        throw new Error(`详情文件不存在：${item.id} -> ${item.detailRef}`);
      }
    }
    ids.add(item.id);
  }

  for (const run of data.runs ?? []) {
    if (!SOURCES.includes(run.source) || !run.categoryId || !run.status) {
      throw new Error(`采集批次记录不完整：${JSON.stringify(run)}`);
    }
  }

  if (process.env.REQUIRE_ENRICHED_DATA === 'true' && !data.sourceHealth?.length) {
    throw new Error('生产数据缺少 sourceHealth');
  }
  if (process.env.REQUIRE_ENRICHED_DATA === 'true' && (!data.topics?.length || !data.brief?.highlights.length)) {
    throw new Error('生产数据缺少 topics 或 brief');
  }

  const healthSources = new Set<string>();
  for (const health of data.sourceHealth ?? []) {
    if (!SOURCES.includes(health.source) || health.minCount < 0 || health.currentCount < 0 || health.publishedCount < 0) {
      throw new Error(`来源健康记录不完整：${JSON.stringify(health)}`);
    }
    if (healthSources.has(health.source)) throw new Error(`来源健康记录重复：${health.source}`);
    healthSources.add(health.source);
    if (health.fallbackUsed && health.status !== 'stale') {
      throw new Error(`来源保底状态不一致：${health.source}`);
    }
    if (health.categories?.length && health.categories.length !== CATEGORIES.length) {
      throw new Error(`来源类别健康记录数量不正确：${health.source}`);
    }
  }
  if (data.sourceHealth?.length && healthSources.size !== SOURCES.length) {
    throw new Error(`来源健康记录应覆盖 ${SOURCES.length} 个来源，实际 ${healthSources.size}`);
  }

  const topicIds = new Set<string>();
  for (const topic of data.topics ?? []) {
    if (!topic.id || topicIds.has(topic.id) || !topic.itemIds.length) throw new Error(`话题记录无效：${topic.id}`);
    if (topic.itemIds.some((id) => !ids.has(id))) throw new Error(`话题引用不存在的条目：${topic.id}`);
    topicIds.add(topic.id);
  }
  for (const highlight of data.brief?.highlights ?? []) {
    if (!topicIds.has(highlight.topicId)) throw new Error(`每日摘要引用不存在的话题：${highlight.topicId}`);
  }

  console.log(`[validate:data] 通过：${data.items.length} 条，${ids.size} 个唯一 ID`);
}

main().catch((error) => {
  console.error(`[validate:data] 失败：${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
