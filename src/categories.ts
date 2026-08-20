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
  /** GitHub 仓库搜索词 */
  githubQueries: string[];
  /** Hugging Face 模型搜索词 */
  huggingFaceQueries: string[];
  /** Stack Exchange 标签 */
  stackExchangeTags: string[];
  /** arXiv 检索式 */
  arxivQueries: string[];
  /** 官方博客 RSS / Atom 地址 */
  rssFeeds: string[];
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
    githubQueries: ['artificial intelligence', 'large language model', 'llm'],
    huggingFaceQueries: ['text generation', 'large language model', 'chatbot'],
    stackExchangeTags: ['machine-learning', 'deep-learning', 'large-language-model'],
    arxivQueries: ['cat:cs.AI', 'cat:cs.LG', 'cat:cs.CL'],
    rssFeeds: ['https://openai.com/news/rss.xml', 'https://www.anthropic.com/news/rss.xml', 'https://blog.google/technology/ai/rss/'],
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
    githubQueries: ['productivity', 'automation', 'workflow'],
    huggingFaceQueries: ['productivity', 'document question answering'],
    stackExchangeTags: ['productivity', 'automation', 'software-recommendations'],
    arxivQueries: ['cat:cs.HC', 'cat:cs.SE'],
    rssFeeds: ['https://github.blog/changelog/feed/', 'https://zapier.com/blog/feed/'],
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
    githubQueries: ['developer tools', 'programming language', 'cli'],
    huggingFaceQueries: ['code generation', 'text-to-code', 'code completion'],
    stackExchangeTags: ['javascript', 'typescript', 'python', 'rust'],
    arxivQueries: ['cat:cs.PL', 'cat:cs.SE'],
    rssFeeds: ['https://github.blog/changelog/feed/', 'https://stackoverflow.blog/feed/'],
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
    githubQueries: ['AI agent', 'agentic', 'MCP'],
    huggingFaceQueries: ['agent', 'tool use', 'text generation'],
    stackExchangeTags: ['llm', 'openai-api', 'langchain', 'autogpt'],
    arxivQueries: ['cat:cs.AI'],
    rssFeeds: ['https://github.blog/changelog/feed/', 'https://huggingface.co/blog/feed.xml'],
  },
  {
    id: 'research',
    label: '模型研究',
    emoji: '🔬',
    hex: '#8b5cf6',
    appStore: { mode: 'search', searchTerms: ['machine learning', 'AI research', 'scientific'] },
    googlePlay: { mode: 'search', searchTerms: ['machine learning', 'AI research'] },
    productHuntTopics: ['artificial-intelligence', 'developer-tools'],
    redditSubreddits: ['MachineLearning', 'LocalLLaMA', 'LanguageTechnology'],
    blueskyQueries: ['AI research', 'machine learning paper', 'benchmark'],
    mastodonTags: ['machinelearning', 'airesearch', 'research'],
    gdeltQueries: ['"AI research" OR "machine learning paper" OR benchmark'],
    hackerNewsQueries: ['machine learning paper', 'AI research', 'benchmark'],
    githubQueries: ['machine learning', 'benchmark', 'research paper'],
    huggingFaceQueries: ['machine learning', 'benchmark', 'dataset'],
    stackExchangeTags: ['machine-learning', 'deep-learning', 'nlp'],
    arxivQueries: ['cat:cs.AI', 'cat:cs.LG', 'cat:cs.CL'],
    rssFeeds: ['https://huggingface.co/blog/feed.xml', 'https://blog.arxiv.org/feed/'],
  },
  {
    id: 'opensource',
    label: '开源',
    emoji: '🌱',
    hex: '#10b981',
    appStore: { mode: 'search', searchTerms: ['open source', 'GitHub'] },
    googlePlay: { mode: 'search', searchTerms: ['open source', 'GitHub'] },
    productHuntTopics: ['open-source', 'developer-tools'],
    redditSubreddits: ['opensource', 'selfhosted', 'github'],
    blueskyQueries: ['open source', 'GitHub project', 'self hosted'],
    mastodonTags: ['opensource', 'selfhosted', 'github'],
    gdeltQueries: ['opensource OR "open source" OR self-hosted'],
    hackerNewsQueries: ['open source', 'self hosted', 'GitHub'],
    githubQueries: ['topic:open-source', 'self-hosted', 'open source'],
    huggingFaceQueries: ['open source model', 'open source dataset'],
    stackExchangeTags: ['open-source', 'git', 'github'],
    arxivQueries: ['cat:cs.SE'],
    rssFeeds: ['https://github.blog/changelog/feed/', 'https://opensource.googleblog.com/feeds/posts/default'],
  },
  {
    id: 'infrastructure',
    label: '基础设施',
    emoji: '🏗️',
    hex: '#f97316',
    appStore: { mode: 'search', searchTerms: ['server monitoring', 'cloud infrastructure', 'DevOps'] },
    googlePlay: { mode: 'search', searchTerms: ['server monitoring', 'DevOps'] },
    productHuntTopics: ['devops', 'developer-tools'],
    redditSubreddits: ['devops', 'kubernetes', 'docker'],
    blueskyQueries: ['Kubernetes', 'Docker', 'observability'],
    mastodonTags: ['kubernetes', 'docker', 'devops'],
    gdeltQueries: ['Kubernetes OR Docker OR observability OR DevOps'],
    hackerNewsQueries: ['Kubernetes', 'Docker', 'observability'],
    githubQueries: ['Kubernetes', 'Docker', 'observability', 'database'],
    huggingFaceQueries: ['infrastructure', 'observability'],
    stackExchangeTags: ['docker', 'kubernetes', 'devops', 'amazon-web-services'],
    arxivQueries: ['cat:cs.DC', 'cat:cs.NI'],
    rssFeeds: ['https://blog.cloudflare.com/rss/', 'https://kubernetes.io/feed.xml'],
  },
];

export const CATEGORY_META: Record<string, { label: string; emoji: string; hex: string }> =
  Object.fromEntries(CATEGORIES.map((c) => [c.label, { label: c.label, emoji: c.emoji, hex: c.hex }]));

export const CATEGORY_META_BY_ID: Record<string, { id: string; label: string; emoji: string; hex: string }> =
  Object.fromEntries(CATEGORIES.map((c) => [c.id, { id: c.id, label: c.label, emoji: c.emoji, hex: c.hex }]));
