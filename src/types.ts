export type Source = 'appstore' | 'googleplay' | 'producthunt' | 'reddit' | 'bluesky' | 'mastodon' | 'gdelt' | 'hackernews' | 'github' | 'huggingface' | 'stackoverflow' | 'arxiv' | 'rss';
export const DATA_SCHEMA_VERSION = 2;

export interface FeedMetrics {
  rawScore?: number;
  rawScoreLabel?: string;
  rating?: number;
  ratingCount?: number;
  comments?: number;
  installs?: number;
  votes?: number;
}

export interface FeedDetail {
  longDescription?: string;
  externalUrl?: string;
  screenshots?: string[];
  rating?: number;
  price?: string;
  developer?: string;
  comments?: number;
  stats?: Array<{ label: string; value: string }>;
}

export interface FetchRun {
  source: Source;
  categoryId: string;
  fetchedAt: string;
  status: 'success' | 'partial' | 'failed';
  count: number;
  durationMs?: number;
  error?: string;
}

export interface SourceHealth {
  source: Source;
  status: 'healthy' | 'stale' | 'degraded' | 'failed';
  currentCount: number;
  publishedCount: number;
  minCount: number;
  critical: boolean;
  consecutiveFailures: number;
  maxConsecutiveFailures: number;
  maxStaleDays?: number;
  fallbackUsed: boolean;
  staleFrom?: string;
  errors?: string[];
  categories?: CategoryHealth[];
}

export interface CategoryHealth {
  categoryId: string;
  status: 'healthy' | 'stale' | 'degraded' | 'failed';
  currentCount: number;
  publishedCount: number;
  minCount: number;
  fallbackUsed: boolean;
  staleFrom?: string;
  error?: string;
}

export interface FeedItem {
  /** 唯一标识 */
  id: string;
  /** 来源内稳定 ID，不包含类别和展示文案 */
  sourceItemId?: string;
  /** 标题 */
  title: string;
  /** 简短描述 */
  description?: string;
  /** 中文标题（翻译服务可用时生成） */
  titleZh?: string;
  /** 中文摘要（翻译服务可用时生成） */
  descriptionZh?: string;
  /** 原文链接 */
  url: string;
  /** 数据来源平台 */
  source: Source;
  /** 排名（若有） */
  rank?: number;
  /** 跨来源归一化热度（0–100） */
  heatScore?: number;
  /** 热度分数（下载量 / 评分人数 / 点赞数 / 评论数） */
  score?: number;
  /** 缩略图 URL */
  thumbnail?: string;
  /** 发布时间（ISO 字符串） */
  publishedAt?: string;
  /** 兴趣类别 label（旧数据兼容字段） */
  category?: string;
  /** 稳定类别 ID */
  categoryId?: string;
  /** 一个条目可以同时属于多个类别 */
  categoryIds?: string[];
  /** 语义聚类后的话题 ID */
  topicId?: string;
  /** 结构化指标 */
  metrics?: FeedMetrics;
  /** 详情文件相对路径 */
  detailRef?: string;
  /** 当前条目来自上一份有效快照 */
  stale?: boolean;
  /** 回退快照的采集时间 */
  staleFrom?: string;
  /** 详情抓取或缓存刷新时间，仅在采集管线内部使用 */
  detailFetchedAt?: string;
  /** 详情缓存对应的来源 URL，仅在采集管线内部使用 */
  detailSourceUrl?: string;
  /** 平台附加标签（如 App 分类、r/subreddit、Product Hunt topics） */
  tags?: string[];
  /** 评分（0–5，App Store / Google Play） */
  rating?: number;
  /** 价格（如 "Free" / "$0.99"） */
  price?: string;
  /** 开发者 / 发布者 / 作者 */
  developer?: string;
  /** 评论数 */
  comments?: number;
  /** 附加键值信息（版本、大小、下载量等） */
  stats?: Array<{ label: string; value: string }>;
  /** 完整描述 / 正文（详情页展示） */
  longDescription?: string;
  /** 外部目标链接（如 Reddit 帖子指向的原文），区别于讨论页链接 */
  externalUrl?: string;
  /** 截图 / 图集 URL（从来源网页抓取） */
  screenshots?: string[];
}

export interface FeedData {
  schemaVersion?: number;
  /** 采集时间（ISO 字符串），首次未采集时为 null */
  fetchedAt: string | null;
  /** 是否为内置示例数据 */
  isSample?: boolean;
  items: FeedItem[];
  runs?: FetchRun[];
  sourceHealth?: SourceHealth[];
  topics?: TopicCluster[];
  brief?: DailyBrief;
}

export interface TopicTrend {
  direction: 'up' | 'down' | 'new' | 'steady';
  delta: number;
  label: string;
}

export interface TopicCluster {
  id: string;
  title: string;
  titleZh?: string;
  summary: string;
  summaryZh?: string;
  whyHot: string;
  whyHotZh?: string;
  itemIds: string[];
  sources: Source[];
  categoryIds: string[];
  heatScore: number;
  publishedAt?: string;
  trend: TopicTrend;
}

export interface DailyBriefHighlight {
  topicId: string;
  title: string;
  titleZh?: string;
  whyHot: string;
  whyHotZh?: string;
  trend: TopicTrend;
}

export interface DailyBrief {
  generatedAt: string;
  headline: string;
  headlineZh: string;
  overview: string;
  overviewZh: string;
  highlights: DailyBriefHighlight[];
}

export const SOURCES: Source[] = ['appstore', 'googleplay', 'producthunt', 'reddit', 'bluesky', 'mastodon', 'gdelt', 'hackernews', 'github', 'huggingface', 'stackoverflow', 'arxiv', 'rss'];

export interface SourceMeta {
  label: string;
  /** 短名（如 AS / GP / PH / RD），用于缩略图占位 */
  short: string;
  scoreLabel: string;
  emoji: string;
  /** 品牌主色（十六进制），供独立静态页使用 */
  hex: string;
  /** Tailwind 徽章样式 */
  badgeClass: string;
  dotClass: string;
  textClass: string;
}

export const SOURCE_META: Record<Source, SourceMeta> = {
  appstore: {
    label: 'App Store',
    short: 'AS',
    scoreLabel: '评分人数',
    emoji: '🍎',
    hex: '#4f46e5',
    badgeClass: 'bg-indigo-100 text-indigo-700',
    dotClass: 'bg-indigo-500',
    textClass: 'text-indigo-600',
  },
  googleplay: {
    label: 'Google Play',
    short: 'GP',
    scoreLabel: '下载热度',
    emoji: '🤖',
    hex: '#059669',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-600',
  },
  producthunt: {
    label: 'Product Hunt',
    short: 'PH',
    scoreLabel: '点赞',
    emoji: '🐱',
    hex: '#ea580c',
    badgeClass: 'bg-orange-100 text-orange-700',
    dotClass: 'bg-orange-500',
    textClass: 'text-orange-600',
  },
  reddit: {
    label: 'Reddit',
    short: 'RD',
    scoreLabel: '点赞',
    emoji: '👽',
    hex: '#e11d48',
    badgeClass: 'bg-rose-100 text-rose-700',
    dotClass: 'bg-rose-500',
    textClass: 'text-rose-600',
  },
  bluesky: {
    label: 'Bluesky',
    short: 'BS',
    scoreLabel: '互动热度',
    emoji: '🦋',
    hex: '#0284c7',
    badgeClass: 'bg-sky-100 text-sky-700',
    dotClass: 'bg-sky-500',
    textClass: 'text-sky-600',
  },
  mastodon: {
    label: 'Mastodon',
    short: 'MD',
    scoreLabel: '互动热度',
    emoji: '🐘',
    hex: '#6364ff',
    badgeClass: 'bg-indigo-100 text-indigo-700',
    dotClass: 'bg-indigo-500',
    textClass: 'text-indigo-600',
  },
  gdelt: {
    label: 'GDELT',
    short: 'GD',
    scoreLabel: '媒体热度',
    emoji: '🌐',
    hex: '#0f766e',
    badgeClass: 'bg-teal-100 text-teal-700',
    dotClass: 'bg-teal-500',
    textClass: 'text-teal-600',
  },
  hackernews: {
    label: 'Hacker News',
    short: 'HN',
    scoreLabel: '积分 + 评论',
    emoji: '🟠',
    hex: '#f97316',
    badgeClass: 'bg-orange-100 text-orange-700',
    dotClass: 'bg-orange-500',
    textClass: 'text-orange-600',
  },
  github: {
    label: 'GitHub',
    short: 'GH',
    scoreLabel: 'Star + Fork',
    emoji: '◉',
    hex: '#24292f',
    badgeClass: 'bg-slate-200 text-slate-800',
    dotClass: 'bg-slate-700',
    textClass: 'text-slate-800',
  },
  huggingface: {
    label: 'Hugging Face',
    short: 'HF',
    scoreLabel: '下载 + 点赞',
    emoji: 'HF',
    hex: '#fbbf24',
    badgeClass: 'bg-amber-100 text-amber-800',
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-700',
  },
  stackoverflow: {
    label: 'Stack Overflow',
    short: 'SO',
    scoreLabel: '分数 + 回答',
    emoji: '▴',
    hex: '#f48024',
    badgeClass: 'bg-orange-100 text-orange-800',
    dotClass: 'bg-orange-500',
    textClass: 'text-orange-700',
  },
  arxiv: {
    label: 'arXiv',
    short: 'AX',
    scoreLabel: '论文新鲜度',
    emoji: '∑',
    hex: '#b31b1b',
    badgeClass: 'bg-red-100 text-red-800',
    dotClass: 'bg-red-700',
    textClass: 'text-red-700',
  },
  rss: {
    label: '官方 RSS',
    short: 'RSS',
    scoreLabel: '新鲜度',
    emoji: '◌',
    hex: '#0f766e',
    badgeClass: 'bg-teal-100 text-teal-800',
    dotClass: 'bg-teal-600',
    textClass: 'text-teal-700',
  },
};

declare global {
  interface Window {
    /** 兼容旧版内联快照；生产构建默认异步读取 feed.json。 */
    __DAILY_DATA__?: FeedData;
  }
}
