import { categoryIdsFor } from './dataModel';
import { SOURCE_META, type DailyBrief, type FeedData, type FeedItem, type Source, type TopicCluster, type TopicTrend } from './types';

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'agent', 'agents', 'against', 'also', 'among', 'another', 'app', 'artificial', 'assistant', 'because', 'been',
  'before', 'being', 'build', 'building', 'built', 'could', 'from', 'have', 'into', 'just', 'latest', 'more',
  'chat', 'chatbot', 'intelligence', 'model', 'most', 'new', 'news', 'open', 'opensourced', 'release', 'released', 'software', 'source', 'than', 'that', 'their',
  'there', 'these', 'they', 'this', 'today', 'tool', 'tools', 'using', 'what', 'when', 'where', 'which',
  'with', 'would', 'your', '一个', '一种', '这个', '最新', '发布', '开源', '工具', '如何', '为什么', '可以',
]);

function normalizedTitle(title: string): string {
  return title
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function stem(word: string): string {
  if (word.length <= 4 || /[^a-z]/.test(word)) return word;
  return word.replace(/(ing|ers|ies|ied|ed|es|s)$/i, '');
}

export function semanticTokens(item: Pick<FeedItem, 'title' | 'titleZh'> & Partial<Pick<FeedItem, 'description' | 'descriptionZh'>>): string[] {
  const text = normalizedTitle([item.title, item.titleZh].filter(Boolean).join(' '));
  const words = text
    .split(/\s+/)
    .map(stem)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
  const cjkChunks = text.match(/[\p{Script=Han}]{2,}/gu) ?? [];
  for (const chunk of cjkChunks) {
    if (chunk.length <= 6) words.push(chunk);
    for (let index = 0; index < chunk.length - 1; index += 1) words.push(chunk.slice(index, index + 2));
  }
  return [...new Set(words)].slice(0, 24);
}

function similarity(
  left: Set<string>,
  right: Set<string>,
  leftTitle: string,
  rightTitle: string,
  tokenWeights: Map<string, number>,
): number {
  const sharedTokens = [...left].filter((token) => right.has(token));
  const shared = sharedTokens.length;
  const weight = (tokens: Iterable<string>) => [...tokens].reduce((sum, token) => sum + (tokenWeights.get(token) ?? 1), 0);
  const weightedShared = weight(sharedTokens);
  const weightedOverlap = weightedShared / Math.max(1, Math.min(weight(left), weight(right)));
  const union = new Set([...left, ...right]);
  const weightedJaccard = weightedShared / Math.max(1, weight(union));
  const contained = leftTitle.length >= 16 && rightTitle.length >= 16
    && (leftTitle.includes(rightTitle) || rightTitle.includes(leftTitle));
  if (contained) return 1;
  if (shared < 2) return 0;
  return Math.max(weightedOverlap, weightedJaccard);
}

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function trendFor(current: number, previous?: number): TopicTrend {
  if (previous === undefined) return { direction: 'new', delta: 0, label: 'New today' };
  const delta = Number((current - previous).toFixed(1));
  if (Math.abs(delta) < 3) return { direction: 'steady', delta, label: 'Steady' };
  return {
    direction: delta > 0 ? 'up' : 'down',
    delta,
    label: `${delta > 0 ? '+' : ''}${delta.toFixed(0)} vs yesterday`,
  };
}

function chooseTitle(items: FeedItem[]): FeedItem {
  return [...items].sort((left, right) => {
    const sourceBonus = (item: FeedItem) => item.source === 'gdelt' || item.source === 'rss' ? 4 : 0;
    const titlePenalty = (item: FeedItem) => Math.max(0, item.title.length - 100) * 0.35;
    return (right.heatScore ?? 0) + sourceBonus(right) - titlePenalty(right)
      - ((left.heatScore ?? 0) + sourceBonus(left) - titlePenalty(left));
  })[0];
}

function cleanTopicTitle(value: string): string {
  const clean = value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:nbsp|amp|quot|#39);/gi, ' ')
    .replace(/[*_`#]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > 140 ? clean.slice(0, 137).trimEnd() + '…' : clean;
}

function topIdentityTokens(items: FeedItem[], tokensByItem: Map<string, string[]>): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const token of tokensByItem.get(item.id) ?? []) counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  const shared = [...counts.entries()].filter(([, count]) => count > 1);
  const ranked = (shared.length ? shared : [...counts.entries()])
    .sort((left, right) => right[1] - left[1] || right[0].localeCompare(left[0]));
  return ranked.slice(0, 5).map(([token]) => token);
}

function whyHot(items: FeedItem[], sources: Source[], heatScore: number): { en: string; zh: string } {
  const newest = items.reduce((latest, item) => Math.max(latest, new Date(item.publishedAt ?? 0).getTime()), 0);
  const recent = newest > Date.now() - 36 * 60 * 60 * 1_000;
  const freshnessEn = recent ? 'recent momentum' : 'sustained attention';
  const freshnessZh = recent ? '近期升温' : '持续受到关注';
  return {
    en: `${sources.length} source${sources.length === 1 ? '' : 's'} · ${items.length} signals · heat ${heatScore.toFixed(0)} · ${freshnessEn}`,
    zh: `${sources.length} 个来源 · ${items.length} 条信号 · 热度 ${heatScore.toFixed(0)} · ${freshnessZh}`,
  };
}

export interface IntelligenceResult {
  items: FeedItem[];
  topics: TopicCluster[];
  brief: DailyBrief;
}

export function buildIntelligence(items: FeedItem[], fetchedAt: string, previous?: FeedData): IntelligenceResult {
  const parents = items.map((_, index) => index);
  const find = (index: number): number => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  };
  const unite = (left: number, right: number): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };

  const tokenSets = items.map((item) => new Set(semanticTokens(item)));
  const normalizedTitles = items.map((item) => normalizedTitle(item.title));
  const documentFrequency = new Map<string, number>();
  for (const tokens of tokenSets) for (const token of tokens) documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
  const tokenWeights = new Map([...documentFrequency].map(([token, count]) => [
    token,
    Math.log((items.length + 1) / (count + 1)) + 1,
  ]));
  const inverted = new Map<string, number[]>();
  tokenSets.forEach((tokens, index) => {
    for (const token of tokens) {
      const bucket = inverted.get(token) ?? [];
      if (bucket.length < 80) bucket.push(index);
      inverted.set(token, bucket);
    }
  });

  const compared = new Set<string>();
  for (const bucket of inverted.values()) {
    for (let left = 0; left < bucket.length; left += 1) {
      for (let right = left + 1; right < bucket.length; right += 1) {
        const leftIndex = bucket[left];
        const rightIndex = bucket[right];
        if (items[leftIndex].source === items[rightIndex].source) continue;
        if (!categoryIdsFor(items[leftIndex]).some((categoryId) => categoryIdsFor(items[rightIndex]).includes(categoryId))) continue;
        const key = `${leftIndex}:${rightIndex}`;
        if (compared.has(key)) continue;
        compared.add(key);
        if (similarity(
          tokenSets[leftIndex],
          tokenSets[rightIndex],
          normalizedTitles[leftIndex],
          normalizedTitles[rightIndex],
          tokenWeights,
        ) >= 0.6) {
          unite(leftIndex, rightIndex);
        }
      }
    }
  }

  const groups = new Map<number, FeedItem[]>();
  items.forEach((item, index) => {
    const root = find(index);
    const group = groups.get(root) ?? [];
    group.push(item);
    groups.set(root, group);
  });

  const tokensByItem = new Map(items.map((item, index) => [item.id, [...tokenSets[index]]]));
  const previousById = new Map((previous?.topics ?? []).map((topic) => [topic.id, topic]));
  const topics = [...groups.values()].map((group): TopicCluster => {
    const representative = chooseTitle(group);
    const identity = topIdentityTokens(group, tokensByItem);
    const sources = [...new Set(group.map((item) => item.source))];
    const categoryIds = [...new Set(group.flatMap(categoryIdsFor))].sort();
    const signature = group.length === 1
      ? representative.id
      : `${identity.join('|')}::${categoryIds.join('|')}`;
    const id = `topic:${hash(signature)}`;
    const heatScore = Number((group.reduce((sum, item) => sum + (item.heatScore ?? 0), 0) / group.length).toFixed(1));
    const hot = whyHot(group, sources, heatScore);
    const previousTopic = previousById.get(id);
    return {
      id,
      title: cleanTopicTitle(representative.title),
      titleZh: representative.titleZh,
      summary: group.length > 1
        ? `${group.length} related signals connect ${sources.map((source) => SOURCE_META[source].label).join(', ')} around ${identity.slice(0, 3).join(', ')}.`
        : representative.description ?? representative.title,
      summaryZh: representative.descriptionZh,
      whyHot: hot.en,
      whyHotZh: hot.zh,
      itemIds: group.map((item) => item.id),
      sources,
      categoryIds,
      heatScore,
      publishedAt: group.map((item) => item.publishedAt).filter(Boolean).sort().at(-1),
      trend: trendFor(heatScore, previousTopic?.heatScore),
    };
  }).sort((left, right) => {
    const leftSignal = left.sources.length * 12 + left.itemIds.length * 3 + left.heatScore;
    const rightSignal = right.sources.length * 12 + right.itemIds.length * 3 + right.heatScore;
    return rightSignal - leftSignal;
  }).slice(0, 120);

  const topicIdByItem = new Map<string, string>();
  for (const topic of topics) for (const itemId of topic.itemIds) topicIdByItem.set(itemId, topic.id);
  const enrichedItems = items.map((item) => ({ ...item, topicId: topicIdByItem.get(item.id) }));
  const highlights = topics
    .filter((topic) => topic.sources.length > 1)
    .concat(topics.filter((topic) => topic.sources.length === 1))
    .filter((topic, index, list) => list.findIndex((entry) => entry.id === topic.id) === index)
    .slice(0, 3)
    .map((topic) => ({
      topicId: topic.id,
      title: topic.title,
      titleZh: topic.titleZh,
      whyHot: topic.whyHot,
      whyHotZh: topic.whyHotZh,
      trend: topic.trend,
    }));
  const names = highlights.map((item) => item.titleZh ?? item.title);
  const brief: DailyBrief = {
    generatedAt: fetchedAt,
    headline: highlights.length ? `Today's three signals: ${highlights.map((item) => item.title).join(' · ')}` : 'Today’s signal desk is quiet.',
    headlineZh: highlights.length ? `今日三件事：${names.join(' · ')}` : '今日暂未形成显著热点。',
    overview: highlights.length
      ? `${topics.filter((topic) => topic.sources.length > 1).length} cross-source topics emerged from ${items.length} signals.`
      : `No cross-source topic passed the clustering threshold among ${items.length} signals.`,
    overviewZh: highlights.length
      ? `从 ${items.length} 条信号中识别出 ${topics.filter((topic) => topic.sources.length > 1).length} 个跨来源话题。`
      : `${items.length} 条信号中暂未出现达到聚类门槛的跨来源话题。`,
    highlights,
  };

  return { items: enrichedItems, topics, brief };
}
