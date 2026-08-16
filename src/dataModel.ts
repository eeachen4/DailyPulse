import { CATEGORIES } from './categories';
import {
  DATA_SCHEMA_VERSION,
  type FeedDetail,
  type FeedItem,
  type FeedMetrics,
  type Source,
} from './types';

const CATEGORY_LABEL_TO_ID = new Map(CATEGORIES.map((category) => [category.label, category.id]));

export interface DetailFile {
  schemaVersion: number;
  id: string;
  sourceItemId?: string;
  detail: FeedDetail;
}

export function categoryIdsFor(item: Pick<FeedItem, 'category' | 'categoryId' | 'categoryIds'>): string[] {
  const ids = item.categoryIds?.length
    ? item.categoryIds
    : item.categoryId
      ? [item.categoryId]
      : item.category
        ? [CATEGORY_LABEL_TO_ID.get(item.category) ?? item.category]
        : [];
  return [...new Set(ids.filter(Boolean).map((id) => CATEGORY_LABEL_TO_ID.get(id) ?? id))];
}

export function primaryCategoryId(item: Pick<FeedItem, 'category' | 'categoryId' | 'categoryIds'>): string {
  return categoryIdsFor(item)[0] ?? 'uncategorized';
}

export function sourceItemIdFor(
  item: Pick<FeedItem, 'id' | 'source' | 'sourceItemId' | 'category' | 'categoryId' | 'categoryIds'>,
): string {
  if (item.sourceItemId) return item.sourceItemId;
  const colonPrefix = item.source + ':';
  const hyphenPrefix = item.source + '-';
  let sourceItemId = item.id.startsWith(colonPrefix)
    ? item.id.slice(colonPrefix.length)
    : item.id.startsWith(hyphenPrefix)
      ? item.id.slice(hyphenPrefix.length)
      : item.id;

  // 旧版 Product Hunt 等数据把类别拼进了 ID（如 producthunt-工具-1208711）。
  // 迁移时去掉这个展示层前缀，让跨类别重复出现的同一条内容合并为一个实体。
  for (const categoryId of categoryIdsFor(item)) {
    const category = CATEGORIES.find((candidate) => candidate.id === categoryId);
    for (const prefix of [categoryId, category?.label].filter(Boolean) as string[]) {
      const categoryPrefix = prefix + '-';
      if (sourceItemId.startsWith(categoryPrefix)) {
        sourceItemId = sourceItemId.slice(categoryPrefix.length);
        break;
      }
    }
  }
  return sourceItemId;
}

export function canonicalId(source: Source, sourceItemId: string): string {
  return source + ':' + sourceItemId;
}

export function rawScoreFor(item: Pick<FeedItem, 'score' | 'metrics'>): number | undefined {
  const value = item.metrics?.rawScore ?? item.score;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function metricsFor(item: FeedItem): FeedMetrics | undefined {
  const metrics: FeedMetrics = {
    ...item.metrics,
    rawScore: rawScoreFor(item),
    rating: item.metrics?.rating ?? item.rating,
    comments: item.metrics?.comments ?? item.comments,
  };
  return Object.values(metrics).some((value) => value !== undefined) ? metrics : undefined;
}

export function detailSlug(id: string): string {
  // encodeURIComponent 可在浏览器和 Node 共用，并且对 Unicode/分隔符保持一一映射，避免文件名碰撞。
  return encodeURIComponent(id);
}

export function detailRefFor(id: string): string {
  return 'details/' + detailSlug(id) + '.json';
}

export function detailForItem(item: FeedItem): FeedDetail {
  return {
    longDescription: item.longDescription,
    externalUrl: item.externalUrl,
    screenshots: item.screenshots,
    rating: item.metrics?.rating ?? item.rating,
    price: item.price,
    developer: item.developer,
    comments: item.metrics?.comments ?? item.comments,
    stats: item.stats,
  };
}

export function hasDetail(detail: FeedDetail): boolean {
  return Object.values(detail).some((value) => value !== undefined);
}

export function canonicalizeItems(items: FeedItem[]): FeedItem[] {
  const merged = new Map<string, FeedItem>();
  for (const item of items) {
    const sourceItemId = sourceItemIdFor(item);
    const id = canonicalId(item.source, sourceItemId);
    const next: FeedItem = {
      ...item,
      id,
      sourceItemId,
      categoryId: primaryCategoryId(item),
      categoryIds: categoryIdsFor(item),
    };
    const existing = merged.get(id);
    if (!existing) {
      merged.set(id, next);
      continue;
    }
    merged.set(id, {
      ...existing,
      ...next,
      categoryIds: [...new Set([...(existing.categoryIds ?? []), ...(next.categoryIds ?? [])])],
      tags: [...new Set([...(existing.tags ?? []), ...(next.tags ?? [])])],
    });
  }
  return [...merged.values()];
}

export function withHeatScores(items: FeedItem[]): FeedItem[] {
  const groups = new Map<Source, FeedItem[]>();
  for (const item of items) {
    const group = groups.get(item.source) ?? [];
    group.push(item);
    groups.set(item.source, group);
  }

  const scores = new Map<string, number>();
  for (const group of groups.values()) {
    const ranked = group
      .filter((item) => rawScoreFor(item) !== undefined)
      .sort((a, b) => (rawScoreFor(b) ?? -Infinity) - (rawScoreFor(a) ?? -Infinity));
    let previous: number | undefined;
    let previousHeat = 100;
    ranked.forEach((item, index) => {
      const raw = rawScoreFor(item);
      if (raw === undefined) return;
      if (raw !== previous) {
        previousHeat = ranked.length <= 1 ? 100 : Number((100 * (1 - index / (ranked.length - 1))).toFixed(2));
        previous = raw;
      }
      scores.set(item.id, previousHeat);
    });
  }

  return items.map((item) => ({ ...item, heatScore: scores.get(item.id) }));
}

export function toSummary(item: FeedItem): FeedItem {
  const detail = detailForItem(item);
  const { longDescription, externalUrl, screenshots, rating, price, developer, comments, stats, score, ...summary } = item;
  const sourceItemId = sourceItemIdFor(item);
  const id = canonicalId(item.source, sourceItemId);
  return {
    ...summary,
    id,
    sourceItemId,
    categoryId: primaryCategoryId(item),
    categoryIds: categoryIdsFor(item),
    metrics: metricsFor(item),
    heatScore: item.heatScore,
    detailRef: hasDetail(detail) ? detailRefFor(id) : undefined,
  };
}

export function toDetailFile(item: FeedItem): DetailFile {
  const sourceItemId = sourceItemIdFor(item);
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    id: canonicalId(item.source, sourceItemId),
    sourceItemId,
    detail: detailForItem(item),
  };
}
