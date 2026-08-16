# DailyPulse ⚡ 每日全球热点「信息早餐」

> 名称寓意：**Daily**（每日）+ **Pulse**（脉搏）——每天早上，感受全球热点跳动的脉搏。

DailyPulse 是一个每日自动聚合全球热门内容的 MVP 工具。每天早上 **08:00（UTC+8）**，它自动从 **App Store、Google Play、Product Hunt、Reddit** 抓取当日的热门话题与热门 App / 产品，生成一个简洁美观的静态网页，让你一瞥即知全球正在发生什么。

![tech](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)
![tech](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![tech](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![tech](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![tech](https://img.shields.io/badge/TailwindCSS-3-38BDF8?logo=tailwindcss&logoColor=white)

---

## ✨ 功能特性

- 🗂️ **按类别采集**：内置 AI、工具、代码、Agent 四个兴趣类别，每个类别在四个平台按对应榜单 / 主题 / 子版块采集，类别可在 `src/categories.ts` 中增删改。
- 🌍 **多平台聚合**：App Store、Google Play、Product Hunt、Reddit 四源，每源独立 `try-catch` 容错，单个源失败不影响整体。
- 📦 **统一数据格式**：所有源归一化为统一的 `FeedItem`，含类别、标题、链接、排名、热度、缩略图、发布时间、标签。
- 🖼️ **静态页面生成**：采集完成后写入 `data/daily.json`，并将数据注入 `dist/index.html` 的 `window.__DAILY_DATA__`，前端无需二次请求。
- 🔍 **筛选与排序**：按类别、按平台筛选，按热度 / 排名 / 标题 / 时间排序。
- 📱 **响应式设计**：适配桌面与移动端，简洁现代、以深蓝/白为主色调。
- ⏰ **定时自动化**：GitHub Actions cron 每天 UTC 0:00（北京时间 8:00）自动执行并回写仓库。

## 🧱 技术栈

| 层 | 技术 |
| --- | --- |
| 运行环境 | Node.js 20+ · TypeScript |
| HTTP 请求 | axios |
| 采集执行 | `tsx` 直接运行 TS |
| 前端框架 | React 18 + Vite 5 |
| 样式 | TailwindCSS 3 |
| 定时执行 | GitHub Actions（cron） |
| 部署 | GitHub Pages（静态托管） |

## 🗂️ 类别配置

默认内置四个兴趣类别，集中定义在 [`src/categories.ts`](./src/categories.ts)：

| 类别 | App Store | Google Play | Product Hunt topic | Reddit 子版块 |
| --- | --- | --- | --- | --- |
| AI | 搜索 "AI assistant" | 搜索 "AI assistant" | `artificial-intelligence` | `artificial` / `MachineLearning` / `ChatGPT` |
| 工具 | 榜单 `UTILITIES` | 榜单 `TOOLS` | `productivity` | `software` / `productivity` |
| 代码 | 搜索 "code editor" | 搜索 "code editor" | `developer-tools` | `programming` / `coding` / `webdev` |
| Agent | 搜索 "AI agent" | 搜索 "AI agent" | `ai-agents` | `AI_Agents` / `LLMDevs` / `LangChain` |

> 增删类别：编辑 `src/categories.ts` 的 `CATEGORIES` 数组。App Store / Google Play 的 `mode` 支持 `rankings`（榜单，需 `collection` + `category`）或 `search`（关键词，需 `searchTerms`）。

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
│   │   ├── productHunt.ts              # Product Hunt 采集
│   │   ├── reddit.ts                   # Reddit 采集
│   │   └── utils.ts                    # 防御性字段归一化工具
│   ├── storage/
│   │   ├── saveData.ts                 # 写入 data/daily.json
│   │   └── generateHtml.ts             # 生成 / 注入静态 HTML
│   ├── web/                            # React 前端
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.css
│   │   ├── format.ts
│   │   └── components/
│   │       ├── FeedCard.tsx            # 单条卡片
│   │       ├── FeedList.tsx            # 列表容器
│   │       ├── SourceFilter.tsx        # 平台筛选
│   │       └── CategoryFilter.tsx      # 类别筛选
│   ├── categories.ts                   # 兴趣类别配置
│   ├── types.ts                        # 共享类型 + 平台元信息
│   └── index.ts                        # 主入口（采集 + 生成）
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

编辑 `.env`，填入你的 Apify API Token（**必填**，Reddit 源不需要）：

```
APIFY_API_KEY=apify_api_xxxxxxxxxxxxxxxx
```

> 各数据源对应的 Actor ID 已内置默认值，一般情况下无需修改。

### 4. 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器（读 `data/daily.json`） |
| `npm run fetch` | 手动执行采集，写入 `data/daily.json` 并生成静态页 |
| `npm run build` | 构建前端到 `dist/` |
| `npm run generate` | 将 `data/daily.json` 注入 `dist/index.html` |
| `npm run build:all` | 构建 + 注入数据（生产链路） |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run preview` | 本地预览 `dist/` 构建产物 |

> **提示**：未配置 `APIFY_API_KEY` 时，`npm run fetch` 仍会抓取 Reddit 数据（无需认证），App Store / Google Play / Product Hunt 会被跳过并在日志中提示。

> **详情抓取**：采集完成后会自动逐个抓取来源网页（解析 `og:meta` 与 JSON-LD），提取完整描述、高清图、截图、评分、价格、作者等写入 `data/daily.json`，供详情页展示。可用 `SCRAPE_DETAILS=false` 关闭，`SCRAPE_DETAILS_CONCURRENCY` 调整并发；个别源（如 Product Hunt）有反爬会返回 403，抓取失败时自动保留原有数据。

## 🔑 获取 Apify API Key

1. 注册 [Apify](https://apify.com/) 账号。
2. 进入 **Console → Settings → Integrations → Personal API tokens**。
3. 新建一个 Token，复制后填入 `.env` 的 `APIFY_API_KEY`（或 GitHub Secrets）。

本仓库使用的默认 Actor（均已验证公开可用）：

| 平台 | Actor | 默认输入 |
| --- | --- | --- |
| App Store | `haketa~app-store-scraper` | `{ mode: "rankings", collection: "TOP_FREE_IOS", country: "us" }` |
| Google Play | `haketa~google-play-scraper` | `{ mode: "rankings", collection: "TOP_FREE", category: "APPLICATION", country: "us" }` |
| Product Hunt | `glassventures~product-hunt-scraper` | `{ startUrls: ["https://www.producthunt.com/"] }` |

如需更换 Actor，在 `.env` / Secrets 中覆盖 `APIFY_*_ACTOR_ID` 即可（输入字段也可在对应 `src/fetch/*.ts` 中按需调整）。

## ⏰ GitHub Actions 定时任务

工作流文件：`.github/workflows/daily-fetch.yml`

- 触发条件：`schedule: cron '0 0 * * *'`（**UTC 0:00 = 北京时间 8:00**），同时支持 `workflow_dispatch` 手动触发。
- 流程：Checkout → 装依赖 → `npm run fetch` → `npm run build:all` → 提交并推送 `data/daily.json` 与 `dist/`。

### 配置 Secrets

在仓库 **Settings → Secrets and variables → Actions → New repository secret** 添加：

| Secret 名 | 是否必填 | 说明 |
| --- | --- | --- |
| `APIFY_API_KEY` | ✅ 必填 | Apify API Token |
| `APIFY_APP_STORE_ACTOR_ID` | 可选 | 覆盖默认 App Store Actor |
| `APIFY_GOOGLE_PLAY_ACTOR_ID` | 可选 | 覆盖默认 Google Play Actor |
| `APIFY_PRODUCT_HUNT_ACTOR_ID` | 可选 | 覆盖默认 Product Hunt Actor |

> 未配置可选 Secret 时，代码会自动回退到内置默认值。

## 🌐 部署到 GitHub Pages

本项目通过 **GitHub Actions** 自动部署到 GitHub Pages（`build_type = workflow`），由工作流 `.github/workflows/deploy.yml` 把 `dist/` 上传为 Pages 产物并部署。

触发时机：

- 推送到 `main` 分支；
- 「DailyPulse Daily Fetch」采集工作流完成后自动重新部署；
- 手动触发（`workflow_dispatch`）。

**首次启用（只需一次）**，在仓库根目录执行：

```bash
gh api repos/<owner>/<repo>/pages -X POST -f build_type=workflow
```

或进入 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。

部署完成后即可通过 `https://<你的用户名>.github.io/<仓库名>/` 访问。

> 因为 `vite.config.ts` 中设置了 `base: './'`，资源使用相对路径，因此部署在任意子路径都能正常加载。

## 📄 数据格式

采集结果统一为 `FeedItem`，写入 `data/daily.json`：

```typescript
interface FeedItem {
  id: string;                 // 唯一标识
  title: string;              // 标题
  description?: string;       // 简短描述
  url: string;                // 原文链接
  source: 'appstore' | 'googleplay' | 'producthunt' | 'reddit';
  category: string;           // 兴趣类别（AI / 工具 / 代码 / Agent）
  rank?: number;              // 排名（若有）
  score?: number;             // 热度分数（下载量 / 评分人数 / 点赞数）
  thumbnail?: string;         // 缩略图 URL
  publishedAt?: string;       // 发布时间
  tags?: string[];            // 平台附加标签（App 分类 / r/subreddit / PH topics）
  rating?: number;            // 评分（0–5）
  price?: string;             // 价格
  developer?: string;         // 开发者 / 作者
  comments?: number;          // 评论数
  stats?: Array<{ label: string; value: string }>;  // 附加信息（版本、大小等）
}
```

## 🛠️ 常见问题

**Q：为什么 App Store / Google Play / Product Hunt 没有数据？**
A：检查 `APIFY_API_KEY` 是否配置正确、Apify 账号是否有可用额度；查看运行日志中对应 `[source] ❌` 的错误信息。Reddit 不受影响。

**Q：`npm run fetch` 只抓到 Reddit？**
A：说明未配置 `APIFY_API_KEY`，属预期行为，日志中会有明确提示。

**Q：页面打开是空的？**
A：若 `data/daily.json` 无数据且未构建，页面会显示「还没有采集数据」的空状态。请先运行 `npm run fetch`（或等待定时任务）。

## 📌 剩余工作与已知问题

- 尚未完成的收尾工作、已知问题（如 Reddit 对云主机 IP 的 403）与可选优化，见 [`TODO.md`](./TODO.md)。
- 面向 AI 编码助手的项目说明见 [`AGENTS.md`](./AGENTS.md)。

## 📝 License

MIT
