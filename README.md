# DailyPulse ⚡ 每日全球热点「信息早餐」

> 名称寓意：**Daily**（每日）+ **Pulse**（脉搏）——每天早上，感受全球热点跳动的脉搏。

DailyPulse 是一个每日自动聚合全球热门内容的工具。每天早上 **08:00（UTC+8）**，它自动从 **App Store、Google Play、Product Hunt、Reddit** 按兴趣类别抓取热门话题与热门 App / 产品，生成一个简洁的静态网页，让你一瞥即知全球正在发生什么。

![tech](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)
![tech](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![tech](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![tech](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![tech](https://img.shields.io/badge/TailwindCSS-3-38BDF8?logo=tailwindcss&logoColor=white)

---

## ✨ 功能特性

- 🗂️ **按类别采集**：内置 AI、工具、代码、Agent 四个兴趣类别，每类约 **110 条**（App Store 30 + Google Play 30 + Product Hunt 20 + Reddit 30），类别可在 `src/categories.ts` 增删改。
- 🌍 **多平台聚合**：App Store、Google Play、Product Hunt、Reddit 四源，每源独立 `try-catch` 容错，单个源失败不影响整体。
- 🪄 **Product Hunt 官方 API**：优先使用 Product Hunt GraphQL API（`PRODUCT_HUNT_TOKEN`），无 token 时回退 Apify。
- 🧾 **详情页**：点击条目进入详情页，展示完整描述、截图图集、评分 / 价格 / 评论 / 开发者等元信息，并支持「打开原链接」「访问原文」。
- 🔍 **详情抓取**：采集后自动逐个抓取来源网页（解析 `og:meta` 与 JSON-LD），补充完整描述、高清图、截图、评分等。
- 🔗 **相关推荐 + 展开收起**：详情页按类别推荐同主题条目；长正文支持展开 / 收起。
- 📦 **统一数据格式**：所有源归一化为 `FeedItem`。
- 🖼️ **静态页面生成**：数据写入 `data/daily.json`，并注入 `dist/index.html` 的 `window.__DAILY_DATA__`，前端无需二次请求。
- 🔍 **筛选与排序**：按类别、按平台筛选，按热度 / 排名 / 标题 / 时间排序。
- 🎨 **编辑风设计**：暖纸色底 + 近黑墨色 + 等宽数据字体 + 细线分隔（「Morning Pulse」）。
- ⏰ **定时自动化**：GitHub Actions cron 每天 UTC 0:00（北京时间 8:00）自动采集、回写并部署。

## 🧱 技术栈

| 层 | 技术 |
| --- | --- |
| 运行环境 | Node.js 20+ · TypeScript |
| HTTP 请求 | axios |
| HTML 解析 | cheerio |
| 采集执行 | `tsx` 直接运行 TS |
| Product Hunt | 官方 GraphQL API（Apify 兜底） |
| 前端框架 | React 18 + Vite 5 |
| 样式 | TailwindCSS 3 |
| 定时执行 | GitHub Actions（cron） |
| 部署 | GitHub Pages（静态托管） |

## 🗂️ 类别配置

默认内置四个兴趣类别，集中定义在 [`src/categories.ts`](./src/categories.ts)：

| 类别 | App Store | Google Play | Product Hunt topic | Reddit 子版块 |
| --- | --- | --- | --- | --- |
| AI | 搜索 AI / assistant / ChatGPT | 搜索 AI assistant / chatbot | `artificial-intelligence` | artificial / MachineLearning / ChatGPT |
| 工具 | 榜单 `UTILITIES` | 榜单 `TOOLS` | `productivity` | software / productivity |
| 代码 | 搜索 code editor / developer / IDE | 搜索 code editor / programming | `developer-tools` | programming / coding / webdev |
| Agent | 搜索 AI agent / autonomous agent | 搜索 AI agent | `ai-agents` | AI_Agents / LLMDevs / LangChain |

> 增删类别：编辑 `src/categories.ts` 的 `CATEGORIES`。App Store / Google Play 的 `mode` 支持 `rankings`（榜单，需 `collection` + `category`）或 `search`（关键词，需 `searchTerms`）。

## 📁 项目结构

```
daily-pulse/
├── .github/workflows/
│   ├── daily-fetch.yml                 # 定时采集工作流
│   └── deploy.yml                      # 部署到 GitHub Pages
├── src/
│   ├── fetch/                          # 采集模块
│   │   ├── apify.ts                    # 通用 Apify Actor 调用封装
│   │   ├── appStore.ts                 # App Store 采集
│   │   ├── googlePlay.ts               # Google Play 采集
│   │   ├── productHunt.ts              # Product Hunt 采集（GraphQL + Apify 兜底）
│   │   ├── reddit.ts                   # Reddit 采集
│   │   ├── detailScraper.ts            # 来源网页详情抓取（og:meta + JSON-LD）
│   │   └── utils.ts                    # 防御性字段归一化工具
│   ├── storage/
│   │   ├── saveData.ts                 # 写入 data/daily.json
│   │   ├── generateHtml.ts             # 生成 / 注入静态 HTML
│   │   └── generateSample.ts           # 生成示例数据（npm run sample）
│   ├── web/                            # React 前端
│   │   ├── App.tsx                     # 入口 + 路由 + 列表页
│   │   ├── main.tsx
│   │   ├── index.css                   # 设计系统（Morning Pulse）
│   │   ├── format.ts
│   │   └── components/
│   │       ├── FeedCard.tsx            # 列表条目
│   │       ├── FeedList.tsx            # 列表容器
│   │       ├── SourceFilter.tsx        # 平台筛选
│   │       ├── CategoryFilter.tsx      # 类别筛选
│   │       ├── DetailPage.tsx          # 详情页
│   │       └── ExpandableText.tsx      # 长文展开 / 收起
│   ├── categories.ts                   # 兴趣类别配置
│   ├── types.ts                        # 共享类型 + 平台元信息
│   └── index.ts                        # 主入口（采集 + 详情抓取 + 生成）
├── data/
│   └── daily.json                      # 采集结果（含内置示例数据）
├── dist/                               # 构建产物（含注入数据的 index.html）
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── index.html                          # Vite 入口模板
├── .env.example
├── README.md                           # 使用说明
├── AGENTS.md                           # 面向 AI 编码助手的项目说明
└── TODO.md                             # 剩余工作清单
```

## 🚀 快速开始（本地）

### 1. 环境要求

- Node.js **20+**（推荐 22）
- npm 9+

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，至少配置 `APIFY_API_KEY`（Product Hunt 走官方 API 时可不配 Apify PH Actor）：

```
APIFY_API_KEY=apify_api_xxxxxxxxxxxxxxxx
PRODUCT_HUNT_TOKEN=ph_token_xxxxxxxx   # Product Hunt 官方 API，可选
```

### 4. 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器（读 `data/daily.json`） |
| `npm run fetch` | 采集 → 来源网页详情抓取 → 生成静态页 |
| `npm run sample` | 生成 440 条示例数据（每类别 110） |
| `npm run build` | 构建前端到 `dist/` |
| `npm run generate` | 将 `data/daily.json` 注入 `dist/index.html` |
| `npm run build:all` | 构建 + 注入数据（生产链路） |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run preview` | 本地预览 `dist/` 构建产物 |

> **提示**：未配置 `APIFY_API_KEY` 时，`npm run fetch` 仍会抓取 Reddit（无需认证），其余源跳过并在日志中提示。

> **详情抓取**：采集完成后会自动并发抓取来源网页（解析 `og:meta` 与 JSON-LD），补充完整描述、高清图、截图、评分、价格、作者等，供详情页展示。`SCRAPE_DETAILS=false` 关闭，`SCRAPE_DETAILS_CONCURRENCY` 调并发；抓取失败自动保留原数据。

## 🔑 环境变量参考

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `APIFY_API_KEY` | ✅ | Apify Token（App Store / Google Play 及 PH 兜底） |
| `PRODUCT_HUNT_TOKEN` | 可选 | Product Hunt 官方 GraphQL API Token |
| `APIFY_APP_STORE_ACTOR_ID` | 可选 | 覆盖默认 App Store Actor |
| `APIFY_GOOGLE_PLAY_ACTOR_ID` | 可选 | 覆盖默认 Google Play Actor |
| `APIFY_PRODUCT_HUNT_ACTOR_ID` | 可选 | 覆盖默认 Product Hunt Actor |
| `APIFY_APP_STORE_MAX_ITEMS` | 可选 | 每类别 App Store 采集数（默认 30） |
| `APIFY_GOOGLE_PLAY_MAX_ITEMS` | 可选 | 每类别 Google Play 采集数（默认 30） |
| `APIFY_PRODUCT_HUNT_MAX_ITEMS` | 可选 | 每类别 Product Hunt 采集数（默认 20） |
| `REDDIT_LIMIT` | 可选 | 每类别 Reddit 采集数（默认 30） |
| `SCRAPE_DETAILS` | 可选 | 是否抓取来源网页详情（默认 `true`） |
| `SCRAPE_DETAILS_CONCURRENCY` | 可选 | 详情抓取并发数（默认 4） |
| `APIFY_RUN_TIMEOUT_SECS` | 可选 | 单次 Apify run 最长等待（默认 300） |

### 获取 Apify API Key

1. 注册 [Apify](https://apify.com/)。
2. **Console → Settings → Integrations → Personal API tokens**。
3. 新建 Token，填入 `APIFY_API_KEY`。

本仓库默认 Actor（已验证公开可用）：

| 平台 | Actor |
| --- | --- |
| App Store | `haketa~app-store-scraper` |
| Google Play | `haketa~google-play-scraper` |
| Product Hunt（兜底） | `glassventures~product-hunt-scraper` |

### 获取 Product Hunt Token

1. 打开 [Product Hunt API 应用管理](https://www.producthunt.com/v2/oauth/applications)。
2. 创建一个应用，复制其 **Developer Token**。
3. 填入 `PRODUCT_HUNT_TOKEN`。配置后 Product Hunt 走官方 GraphQL API，数据更全（完整描述 / 官网 / 评分 / 话题标签等）。

## ⏰ GitHub Actions 定时任务

工作流文件：`.github/workflows/daily-fetch.yml`

- 触发：`schedule: cron '0 0 * * *'`（**UTC 0:00 = 北京时间 8:00**）+ `workflow_dispatch` 手动触发。
- 流程：Checkout → 装依赖 → `npm run fetch`（采集 + 详情抓取）→ `npm run build:all` → 提交并推送 `data/daily.json` 与 `dist/`。

### 配置 Secrets

仓库 **Settings → Secrets and variables → Actions → New repository secret**：

| Secret 名 | 是否必填 | 说明 |
| --- | --- | --- |
| `APIFY_API_KEY` | ✅ | Apify API Token |
| `PRODUCT_HUNT_TOKEN` | 可选 | Product Hunt 官方 API Token |
| `APIFY_APP_STORE_ACTOR_ID` | 可选 | 覆盖默认 App Store Actor |
| `APIFY_GOOGLE_PLAY_ACTOR_ID` | 可选 | 覆盖默认 Google Play Actor |
| `APIFY_PRODUCT_HUNT_ACTOR_ID` | 可选 | 覆盖默认 Product Hunt Actor |

## 🌐 部署到 GitHub Pages

由工作流 `.github/workflows/deploy.yml` 自动把 `dist/` 部署为 Pages 产物。

触发时机：推送 `main`、采集工作流完成后自动重新部署、手动 `workflow_dispatch`。

**首次启用（只需一次）**：

```bash
gh api repos/<owner>/<repo>/pages -X POST -f build_type=workflow
```

或 **Settings → Pages → Source → GitHub Actions**。完成后访问 `https://<用户名>.github.io/<仓库名>/`。

> `vite.config.ts` 设置 `base: './'`，资源用相对路径，任意子路径部署均可正常加载。

## 📄 数据格式

采集结果统一为 `FeedItem`，写入 `data/daily.json`：

```typescript
interface FeedItem {
  id: string;                 // 唯一标识
  title: string;              // 标题
  description?: string;       // 简短描述（列表用）
  longDescription?: string;   // 完整描述 / 正文（详情页用）
  url: string;                // 原文链接（讨论 / 产品页）
  externalUrl?: string;       // 外部目标链接（如 Reddit 原文、PH 官网）
  source: 'appstore' | 'googleplay' | 'producthunt' | 'reddit';
  category: string;           // 兴趣类别（AI / 工具 / 代码 / Agent）
  rank?: number;              // 排名
  score?: number;             // 热度分数（下载量 / 点赞数等）
  rating?: number;            // 评分（0–5）
  price?: string;             // 价格
  developer?: string;         // 开发者 / 作者
  comments?: number;          // 评论数
  thumbnail?: string;         // 缩略图 URL
  screenshots?: string[];     // 截图 / 图集
  publishedAt?: string;       // 发布时间
  tags?: string[];            // 平台附加标签
  stats?: Array<{ label: string; value: string }>;  // 附加信息（版本、大小等）
}
```

## 🛠️ 常见问题

**Q：App Store / Google Play 没有数据？**
A：检查 `APIFY_API_KEY` 是否正确、Apify 是否有可用额度；查看日志 `[source] ❌`。Reddit 不受影响。

**Q：Product Hunt 没有数据？**
A：优先用 `PRODUCT_HUNT_TOKEN`（官方 API）；未配置时回退 Apify（需 `APIFY_API_KEY`）。

**Q：`npm run fetch` 只抓到 Reddit？**
A：未配置 `APIFY_API_KEY`，属预期行为，日志有提示。

**Q：页面打开是空的？**
A：`data/daily.json` 无数据且未构建时会显示空状态。运行 `npm run fetch` 或等待定时任务。

**Q：详情抓取某些链接 403？**
A：个别站点（如 Product Hunt 网页）有反爬；抓取失败自动保留原有数据，不影响整体。

## 📌 剩余工作与已知问题

见 [`TODO.md`](./TODO.md)；面向 AI 编码助手的说明见 [`AGENTS.md`](./AGENTS.md)。

## 📝 License

MIT
