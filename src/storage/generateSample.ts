import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { FeedData, FeedItem, Source } from '../types';
import { CATEGORIES } from '../categories';

// 每个类别下各源生成的示例条数（合计 110 / 类别）
const COUNTS: Record<Source, number> = { appstore: 30, googleplay: 30, producthunt: 20, reddit: 30 };

interface Pool {
  names: string[];
  developers: string[];
  subreddits: string[];
  posts: string[];
  topics: string[];
  genres: string[];
}

const POOLS: Record<string, Pool> = {
  ai: {
    names: ['ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'Copilot', 'Midjourney', 'Runway', 'ElevenLabs', 'Hugging Face', 'Leonardo AI', 'Poe', 'Character.AI', 'Pi', 'Whisper', 'DALL-E', 'Suno', 'Stable Diffusion', 'Jasper', 'Copy.ai', 'Synthesia', 'HeyGen', 'Descript', 'Otter.ai', 'Notion AI', 'Grammarly', 'Fireflies', 'Murf', 'Replicate', 'Bardeen', 'Playground'],
    developers: ['OpenAI', 'Anthropic', 'Google', 'Stability AI', 'Runway', 'ElevenLabs', 'Hugging Face', 'Leonardo', 'Quora', 'Character.AI', 'Inflection AI', 'Suno', 'Midjourney', 'Jasper', 'Copy.ai', 'Synthesia', 'HeyGen', 'Descript', 'Otter.ai', 'Notion', 'Grammarly', 'Fireflies', 'Murf', 'Replicate', 'Bardeen', 'Playground', 'Meta', 'Mistral', 'Cohere', 'Together AI'],
    subreddits: ['artificial', 'MachineLearning', 'ChatGPT', 'LocalLLaMA', 'StableDiffusion'],
    posts: ['开源模型在代码基准上逼近 GPT-4，仅用十分之一的参数量', '我搭建了一个完全离线的本地 AI 助手，无需注册', '对比 6 款主流大模型的长文本能力，结果出乎意料', 'Stable Diffusion 新模型出图质量显著提升，附提示词模板', '为什么说 RAG 仍是企业落地大模型最靠谱的路径', '一个把论文转成可交互讲解的小工具，开源了', '实测：用本地模型做会议纪要，延迟与准确率如何取舍', '多模态模型在医疗影像上的最新进展综述', '我用 500 行代码复现了一个能自我反思的 Agent', '量化后的 7B 模型能在手机上跑到 30 token/s 吗'],
    topics: ['artificial-intelligence'],
    genres: ['效率', '工具', '教育'],
  },
  tools: {
    names: ['1Password', 'LastPass', 'Dropbox', 'Google Drive', 'Evernote', 'Notion', 'Slack', 'Zoom', 'Todoist', 'Trello', 'Figma', 'Canva', 'Calendly', 'Zapier', 'Loom', 'CleanMyMac', 'Alfred', 'Raycast', 'Things', 'Fantastical', 'Pocket', 'Instapaper', 'Readwise', 'Bear', 'Craft', 'Day One', 'Scanner Pro', 'Spark', 'TextExpander', 'Keyboard Maestro'],
    developers: ['AgileBits', 'Dropbox', 'Google', 'Evernote', 'Notion Labs', 'Slack', 'Zoom', 'Doist', 'Atlassian', 'Figma', 'Canva', 'Calendly', 'Zapier', 'Loom', 'MacPaw', 'Raycast', 'Cultured Code', 'Flexibits', 'Read It Later', 'Readwise', 'Shiny Frog', 'Luki Labs', 'Readdle', 'TextExpander', 'Stairways Software', 'GoodNotes', 'MindNode', 'Fantastical', 'Hazel', 'Alfred'],
    subreddits: ['software', 'productivity', 'selfhosted', 'InternetIsBeautiful'],
    posts: ['我开发了一个免费的批量重命名工具，支持正则与预览', '这套 Obsidian 工作流让我的周报时间减半', '自托管一个家庭云盘，数据完全归自己所有', '分享 12 个真正提升效率的浏览器快捷键', '我把常用命令行操作做成了一个菜单栏小工具', '一个自动整理下载文件夹的开源脚本，star 破万', '比番茄钟更有效的深度工作计时法实测', 'Mac 上最被低估的效率 App 盘点'],
    topics: ['productivity'],
    genres: ['工具', '效率'],
  },
  code: {
    names: ['VS Code', 'GitHub', 'GitLab', 'Docker', 'Postman', 'Termius', 'Working Copy', 'Swift Playgrounds', 'Termux', 'Acode', 'Replit', 'Glitch', 'CodeSandbox', 'Cursor', 'Warp', 'JetBrains Toolbox', 'Sublime Text', 'SourceTree', 'HTTPie', 'Insomnia', 'GitKraken', 'Tower', 'Dash', 'CodeRunner', 'Kodex', 'Neovim', 'Alacritty', 'Tmux', 'Lazygit', 'Delta'],
    developers: ['Microsoft', 'GitHub', 'GitLab', 'Docker', 'Postman', 'Replit', 'CodeSandbox', 'Anysphere', 'Warp', 'JetBrains', 'Sublime HQ', 'Atlassian', 'HTTPie', 'Kong', 'Axosoft', 'Git Tower', 'Kapeli', 'Nikolai Krill', 'Bram Moolenaar', 'Alacritty', 'tmux', 'Jesse Duffield', 'dandavison'],
    subreddits: ['programming', 'coding', 'webdev', 'opensource', 'github'],
    posts: ['一个开发者开源了把任意网站变成干净 API 的工具', '我用 Rust 重写了我的 CLI，启动时间快了 40 倍', '为什么单体架构在小团队里依然是最佳选择', 'SQL 并不难：用一张图讲清 JOIN 的所有类型', '我维护的开源库终于发布了 2.0，来聊聊架构取舍', 'Vim 与 VS Code 之争，三年后的我如何选择', '手写一个最小 HTTP 服务器，只需 200 行代码', 'Git 提交信息的 7 条规范，让历史记录可读', '如何给开源项目贡献第一个 PR 的完整指南'],
    topics: ['developer-tools'],
    genres: ['开发工具', '效率'],
  },
  agent: {
    names: ['AutoGPT', 'AgentGPT', 'CrewAI', 'LangChain', 'LlamaIndex', 'Lindy', 'Devin', 'OpenHands', 'BabyAGI', 'MetaGPT', 'SuperAGI', 'Flowise', 'Dify', 'Relevance AI', 'MultiOn', 'Artisan', 'Mindy', 'Fixie', 'Cognition', 'Cognosys', 'Adept', 'Imbue', 'Manus', 'Operator', 'Computer Use', 'AutoGen', 'Crew Studio', 'AgentOps', 'Letta', 'Smolagents'],
    developers: ['Significant Gravitas', 'AgentGPT', 'CrewAI', 'LangChain', 'LlamaIndex', 'Lindy', 'Cognition', 'All Hands AI', 'Yohei Nakajima', 'MetaGPT', 'SuperAGI', 'Flowise', 'Dify', 'Relevance AI', 'MultiOn', 'Artisan', 'Mindy', 'Fixie', 'Cognosys', 'Adept', 'Imbue', 'Manus', 'OpenAI', 'Anthropic', 'Microsoft', 'Berkeley', 'Letta', 'AgentOps', 'Hugging Face', 'Crew Studio'],
    subreddits: ['AI_Agents', 'LLMDevs', 'LangChain', 'AutoGPT'],
    posts: ['多智能体框架突破 1 万 star：它到底做对了什么', '我让三个 Agent 协作完成了一次完整的竞品调研', '确定性编排 vs 自主决策：Agent 架构该如何选', '一个自带记忆与工具调用的 Agent 框架开源了', '用 Agent 自动生成周报并同步到飞书，省下 2 小时', '为什么大多数「自主 Agent」其实并不自主', 'Agent 的上下文窗口管理：我踩过的 5 个坑', '从零写一个能调用浏览器完成任务的小 Agent'],
    topics: ['ai-agents'],
    genres: ['效率', '开发者工具'],
  },
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function pseudo(seed: number, salt: number): number {
  const x = Math.sin(seed * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function rnd(seed: number, salt: number, min: number, max: number): number {
  return Math.floor(min + pseudo(seed, salt) * (max - min + 1));
}

function isoDate(base: number, i: number): string {
  return new Date(base - i * 3_600_000).toISOString();
}

function buildItems(): FeedItem[] {
  const items: FeedItem[] = [];
  const base = Date.now() - 24 * 3600 * 1000;
  let seq = 0;

  for (const cat of CATEGORIES) {
    const pool = POOLS[cat.id];
    if (!pool) continue;

    (['appstore', 'googleplay', 'producthunt', 'reddit'] as Source[]).forEach((source) => {
      const count = COUNTS[source];
      for (let i = 0; i < count; i++) {
        seq++;
        const name = pool.names[i % pool.names.length];
        const title = i < pool.names.length ? name : `${name} ${Math.floor(i / pool.names.length) + 1}`;
        const dev = pool.developers[i % pool.developers.length];
        const sub = pool.subreddits[i % pool.subreddits.length];
        const genre = pool.genres[i % pool.genres.length];
        const publishedAt = isoDate(base, i);

        if (source === 'appstore') {
          items.push({
            id: `appstore-${cat.id}-${i}`,
            title,
            description: `${genre} · 热门推荐`,
            url: `https://apps.apple.com/us/app/${slugify(title)}/id${1_000_000_000 + i}`,
            source,
            category: cat.label,
            rank: i + 1,
            score: rnd(seq, 1, 40_000, 3_000_000),
            rating: Number((4 + (i % 10) / 10).toFixed(1)),
            price: i % 7 === 0 ? '$4.99' : 'Free',
            developer: dev,
            publishedAt,
            tags: [genre],
            stats: [
              { label: '版本', value: `1.${i % 9}.${i % 10}` },
              { label: '大小', value: `${rnd(seq, 2, 18, 320)} MB` },
            ],
          });
        } else if (source === 'googleplay') {
          const installs = ['10万+', '50万+', '100万+', '500万+', '1000万+', '1亿+'][i % 6];
          items.push({
            id: `googleplay-${cat.id}-${i}`,
            title,
            description: `${genre} · 热门推荐`,
            url: `https://play.google.com/store/apps/details?id=com.${slugify(dev)}.${slugify(title)}`,
            source,
            category: cat.label,
            rank: i + 1,
            score: rnd(seq, 4, 1_000_000, 500_000_000),
            rating: Number((3.7 + (i % 12) / 10).toFixed(1)),
            price: 'Free',
            developer: dev,
            comments: rnd(seq, 5, 500, 2_000_000),
            publishedAt,
            tags: [genre],
            stats: [
              { label: '版本', value: `2.${i % 9}.${i % 10}` },
              { label: '大小', value: `${rnd(seq, 6, 8, 220)} MB` },
              { label: '安装量', value: installs },
            ],
          });
        } else if (source === 'producthunt') {
          items.push({
            id: `producthunt-${cat.id}-${i}`,
            title,
            description: `${title} 的标语：让${cat.label}相关的工作更简单、更快。`,
            url: `https://www.producthunt.com/posts/${slugify(title)}`,
            source,
            category: cat.label,
            rank: i + 1,
            score: rnd(seq, 7, 80, 3_000),
            developer: dev,
            comments: rnd(seq, 8, 4, 420),
            publishedAt,
            tags: pool.topics,
          });
        } else {
          items.push({
            id: `reddit-${cat.id}-${i}`,
            title: pool.posts[i % pool.posts.length],
            description: '点击查看完整讨论与网友观点。',
            url: `https://www.reddit.com/r/${sub}/comments/${slugify(pool.posts[i % pool.posts.length])}/`,
            source,
            category: cat.label,
            rank: i + 1,
            score: rnd(seq, 9, 300, 90_000),
            comments: rnd(seq, 10, 15, 6_000),
            developer: `u/${slugify(dev)}`,
            publishedAt,
            tags: [`r/${sub}`],
          });
        }
      }
    });
  }

  return items;
}

async function main(): Promise<void> {
  const items = buildItems();
  const data: FeedData = { fetchedAt: new Date().toISOString(), isSample: true, items };
  const dir = path.resolve(process.cwd(), 'data');
  await mkdir(dir, { recursive: true });
  const p = path.join(dir, 'daily.json');
  await writeFile(p, JSON.stringify(data, null, 2), 'utf-8');

  const perCat: Record<string, number> = {};
  for (const it of items) perCat[it.category] = (perCat[it.category] ?? 0) + 1;
  console.log(`[sample] 生成 ${items.length} 条示例数据 -> ${p}`);
  console.log('[sample] 各类别数量：', perCat);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
