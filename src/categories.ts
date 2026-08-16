/**
 * 兴趣类别配置。
 * 每个类别集中定义四个数据源的采集参数，便于增删改。
 * 前端按 `label` 做分类筛选与展示。
 */

export interface StoreSpec {
  /** rankings：按榜单；search：按关键词 */
  mode: 'rankings' | 'search';
  /** App Store iTunes 分类 ID（rankings 模式） */
  genreId?: string;
  /** Google Play 分类（rankings 模式，如 TOOLS） */
  category?: string;
  /** 搜索关键词（search 模式） */
  searchTerms?: string[];
}

export interface CategoryDef {
  id: string;
  label: string;
  emoji: string;
  hex: string;
  appStore: StoreSpec;
  googlePlay: StoreSpec;
  /** Product Hunt topic slugs */
  productHuntTopics: string[];
  /** Reddit 子版块（不含 r/ 前缀） */
  redditSubreddits: string[];
}

export const CATEGORIES: CategoryDef[] = [
  {
    id: 'ai',
    label: 'AI',
    emoji: '🤖',
    hex: '#7c3aed',
    appStore: { mode: 'search', searchTerms: ['AI', 'AI assistant', 'ChatGPT'] },
    googlePlay: { mode: 'search', searchTerms: ['AI assistant', 'AI chatbot'] },
    productHuntTopics: ['artificial-intelligence'],
    redditSubreddits: ['artificial', 'MachineLearning', 'ChatGPT'],
  },
  {
    id: 'tools',
    label: '工具',
    emoji: '🧰',
    hex: '#0284c7',
    // App Store iTunes 分类 6002 = Utilities
    appStore: { mode: 'rankings', genreId: '6002' },
    googlePlay: { mode: 'rankings', category: 'TOOLS' },
    productHuntTopics: ['productivity'],
    redditSubreddits: ['software', 'productivity'],
  },
  {
    id: 'code',
    label: '代码',
    emoji: '💻',
    hex: '#059669',
    // App Store iTunes 分类 6026 = Developer Tools
    appStore: { mode: 'rankings', genreId: '6026' },
    googlePlay: { mode: 'search', searchTerms: ['code editor', 'programming'] },
    productHuntTopics: ['developer-tools'],
    redditSubreddits: ['programming', 'coding', 'webdev'],
  },
  {
    id: 'agent',
    label: 'Agent',
    emoji: '🧠',
    hex: '#f59e0b',
    appStore: { mode: 'search', searchTerms: ['AI agent', 'agent'] },
    googlePlay: { mode: 'search', searchTerms: ['AI agent'] },
    productHuntTopics: ['ai-agents'],
    redditSubreddits: ['AI_Agents', 'LLMDevs', 'LangChain'],
  },
];

export const CATEGORY_META: Record<string, { label: string; emoji: string; hex: string }> =
  Object.fromEntries(CATEGORIES.map((c) => [c.label, { label: c.label, emoji: c.emoji, hex: c.hex }]));

export const CATEGORY_META_BY_ID: Record<string, { id: string; label: string; emoji: string; hex: string }> =
  Object.fromEntries(CATEGORIES.map((c) => [c.id, { id: c.id, label: c.label, emoji: c.emoji, hex: c.hex }]));
