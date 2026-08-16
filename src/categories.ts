/**
 * 兴趣类别配置。
 * 每个类别集中定义四个数据源的采集参数，便于增删改。
 * 前端按 `label` 做分类筛选与展示。
 */

export interface StoreSpec {
  /** rankings：按榜单类别（需要 collection + category）；search：按关键词 */
  mode: 'rankings' | 'search';
  collection?: string;
  category?: string;
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
    appStore: { mode: 'search', searchTerms: ['AI', 'AI assistant', 'ChatGPT', 'AI chatbot'] },
    googlePlay: { mode: 'search', searchTerms: ['AI assistant', 'AI chatbot', 'AI'] },
    productHuntTopics: ['artificial-intelligence'],
    redditSubreddits: ['artificial', 'MachineLearning', 'ChatGPT'],
  },
  {
    id: 'tools',
    label: '工具',
    emoji: '🧰',
    hex: '#0284c7',
    appStore: { mode: 'rankings', collection: 'TOP_FREE_IOS', category: 'UTILITIES' },
    googlePlay: { mode: 'rankings', collection: 'TOP_FREE', category: 'TOOLS' },
    productHuntTopics: ['productivity'],
    redditSubreddits: ['software', 'productivity'],
  },
  {
    id: 'code',
    label: '代码',
    emoji: '💻',
    hex: '#059669',
    appStore: { mode: 'search', searchTerms: ['code editor', 'developer', 'programming', 'IDE'] },
    googlePlay: { mode: 'search', searchTerms: ['code editor', 'programming', 'developer'] },
    productHuntTopics: ['developer-tools'],
    redditSubreddits: ['programming', 'coding', 'webdev'],
  },
  {
    id: 'agent',
    label: 'Agent',
    emoji: '🧠',
    hex: '#f59e0b',
    appStore: { mode: 'search', searchTerms: ['AI agent', 'autonomous agent', 'agent'] },
    googlePlay: { mode: 'search', searchTerms: ['AI agent', 'agent'] },
    productHuntTopics: ['ai-agents'],
    redditSubreddits: ['AI_Agents', 'LLMDevs', 'LangChain'],
  },
];

export const CATEGORY_META: Record<string, { label: string; emoji: string; hex: string }> =
  Object.fromEntries(CATEGORIES.map((c) => [c.label, { label: c.label, emoji: c.emoji, hex: c.hex }]));
