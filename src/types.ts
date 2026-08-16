export type Source = 'appstore' | 'googleplay' | 'producthunt' | 'reddit';

export interface FeedItem {
  /** 唯一标识 */
  id: string;
  /** 标题 */
  title: string;
  /** 简短描述 */
  description?: string;
  /** 原文链接 */
  url: string;
  /** 数据来源平台 */
  source: Source;
  /** 排名（若有） */
  rank?: number;
  /** 热度分数（下载量 / 评分人数 / 点赞数 / 评论数） */
  score?: number;
  /** 缩略图 URL */
  thumbnail?: string;
  /** 发布时间（ISO 字符串） */
  publishedAt?: string;
  /** 兴趣类别 label（如 "AI" / "工具" / "代码" / "Agent"），用于分类筛选 */
  category: string;
  /** 平台附加标签（如 App 分类、r/subreddit、Product Hunt topics） */
  tags?: string[];
}

export interface FeedData {
  /** 采集时间（ISO 字符串），首次未采集时为 null */
  fetchedAt: string | null;
  /** 是否为内置示例数据 */
  isSample?: boolean;
  items: FeedItem[];
}

export const SOURCES: Source[] = ['appstore', 'googleplay', 'producthunt', 'reddit'];

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
};

declare global {
  interface Window {
    /** 由 generateHtml 在构建后注入到 dist/index.html 的数据 */
    __DAILY_DATA__?: FeedData;
  }
}
