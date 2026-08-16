/**
 * 兴趣类别配置。
 * 每个类别集中定义各数据源的采集参数，便于增删改。
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
  /** Bluesky 搜索词 */
  blueskyQueries: string[];
  /** Mastodon hashtag（不含 # 前缀） */
  mastodonTags: string[];
  /** GDELT 新闻检索词 */
  gdeltQueries: string[];
  /** Hacker News 搜索词 */
  hackerNewsQueries: string[];
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
    blueskyQueries: ['AI', 'LLM', 'ChatGPT'],
    mastodonTags: ['artificialintelligence', 'machinelearning', 'chatgpt'],
    gdeltQueries: ['"artificial intelligence" OR ChatGPT OR LLM'],
    hackerNewsQueries: ['AI', 'LLM', 'ChatGPT'],
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
    blueskyQueries: ['productivity', 'opensource tool'],
    mastodonTags: ['productivity', 'opensource'],
    gdeltQueries: ['productivity software OR automation'],
    hackerNewsQueries: ['productivity', 'automation tool'],
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
    blueskyQueries: ['programming', 'developer tools', 'opensource'],
    mastodonTags: ['programming', 'webdev', 'opensource'],
    gdeltQueries: ['programming OR "developer tools" OR opensource'],
    hackerNewsQueries: ['programming', 'developer tools', 'open source'],
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
    blueskyQueries: ['AI agent', 'agentic', 'LangChain'],
    mastodonTags: ['aiagents', 'agenticai', 'langchain'],
    gdeltQueries: ['"AI agent" OR agentic OR LangChain'],
    hackerNewsQueries: ['AI agents', 'agentic', 'LangChain'],
  },
];

export const CATEGORY_META: Record<string, { label: string; emoji: string; hex: string }> =
  Object.fromEntries(CATEGORIES.map((c) => [c.label, { label: c.label, emoji: c.emoji, hex: c.hex }]));

export const CATEGORY_META_BY_ID: Record<string, { id: string; label: string; emoji: string; hex: string }> =
  Object.fromEntries(CATEGORIES.map((c) => [c.id, { id: c.id, label: c.label, emoji: c.emoji, hex: c.hex }]));
