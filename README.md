# DailyPulse ⚡ 每日全球热点「信息早餐」

> 名称寓意：**Daily**（每日）+ **Pulse**（脉搏）——每天早上，感受全球热点跳动的脉搏。

DailyPulse 是一个每日自动聚合全球热门内容的工具。每天早上 **08:00（UTC+8）**，它自动从 **App Store、Google Play、Product Hunt、Reddit、Bluesky、Mastodon、GDELT、Hacker News、GitHub、Hugging Face、Stack Overflow、arXiv、官方 RSS** 按兴趣类别抓取热门话题、新闻、产品、论文与开发者讨论，生成一个简洁的静态网页，让你一瞥即知全球正在发生什么。

![tech](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![tech](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)
![tech](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![tech](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![tech](https://img.shields.io/badge/TailwindCSS-3-38BDF8?logo=tailwindcss&logoColor=white)

---

## ✨ 功能特性

- 🗂️ **按类别采集**：内置 AI、工具、代码、Agent、模型研究、开源、基础设施七个兴趣类别，类别可在 `src/categories.ts` 增删改。
- 🌍 **多平台聚合**：十三个来源，每源独立 `try-catch` 容错，单个源失败不影响整体。
- 🪄 **Product Hunt 官方 API**：优先使用 Product Hunt GraphQL API（`PRODUCT_HUNT_TOKEN`），无 token 时回退 Apify。
- 🧾 **详情页**：点击条目进入详情页，展示完整描述、截图图集、评分 / 价格 / 评论 / 开发者等元信息，并支持「打开原链接」「访问原文」。
- 🔍 **详情抓取**：采集后自动逐个抓取来源网页（解析 `og:meta` 与 JSON-LD），补充完整描述、高清图、截图、评分等。
- 🔗 **相关推荐 + 展开收起**：详情页按类别推荐同主题条目；长正文支持展开 / 收起。
- 📦 **统一数据格式**：所有源归一化为 schema v2 `FeedItem`，用稳定的 `sourceItemId`、`categoryId` 和结构化 `metrics` 消除来源差异。
- 🔥 **可比热度**：各平台原始指标保留在 `metrics.rawScore`，同时按来源归一化为 0–100 的 `heatScore`，用于跨平台排序。
- 🖼️ **摘要 / 详情分离**：生产首页异步加载可缓存的 `feed.json`，完整描述、截图和附加信息写入 `data/details/`，点击详情时按 `detailRef` 懒加载。
- 🗓️ **历史快照**：每日摘要写入 `data/history/YYYY-MM-DD.json`，`data/history/index.json` 提供日期索引，前端支持往期切换。
- 🩺 **来源健康与保底**：按来源检查最低产量和连续失败次数；来源异常时复用上一份有效数据并标记为 `stale`，关键来源连续超限会阻止退化快照部署。
- ♻️ **增量详情缓存**：详情默认缓存 7 天，仅抓取新增或过期条目；重新抓取失败时继续使用旧详情，并自动清理保留期外的历史与无引用详情。
- 🧭 **跨来源话题**：用标题语义与类别边界聚合同一事件的产品、讨论、新闻和论文，并提供独立话题详情页。
- 🗞️ **每日编辑摘要**：自动生成「今日三件事」「为什么热」和相对昨日的趋势变化。
- 🌐 **双语内容**：支持自托管 LibreTranslate；未配置时每天用 MyMemory 免费匿名额度增量翻译少量标题，搜索同时覆盖中英文。
- ★ **个人信号桌**：收藏、已读、分享、类别开关、关注词、屏蔽词和来源权重均保存在浏览器本地。
- 📡 **开放订阅与指标**：构建时生成 `rss.xml`、`feed.json` 与数据质量 `metrics.json`。
- 🔍 **筛选与排序**：按类别、按平台筛选，按热度 / 排名 / 标题 / 时间排序。
- 🎨 **编辑风设计**：暖纸色底 + 近黑墨色 + 等宽数据字体 + 细线分隔（「Morning Pulse」）。
- ⏰ **定时自动化**：GitHub Actions 在北京时间 07:37 主触发、08:17 兜底；同一上海自然日已有新鲜快照时自动跳过。

## 🧱 技术栈

| 层 | 技术 |
| --- | --- |
| 运行环境 | Node.js 22 · TypeScript 7 |
| HTTP 请求 | axios |
| HTML 解析 | cheerio |
| 采集执行 | `tsx` 直接运行 TS |
| App Store | 官方 iTunes API（RSS + Search + Lookup） |
| Google Play | `google-play-scraper` |
| Product Hunt | 官方 GraphQL API（Apify 兜底） |
| Reddit | OAuth / 公共 JSON + Arctic Shift 近期公开归档降级 |
| Bluesky | 公共 / 认证 AppView 搜索 + 官方 Jetstream 实时流降级 |
| Mastodon | 可配置实例的公开 hashtag 时间线 |
| GDELT | DOC 2.0 API + 官方 15 分钟 GKG 文件降级 |
| Hacker News | Algolia 公共搜索 API |
| GitHub | REST Search API（仓库、Star、Fork、Issue） |
| Hugging Face | Hub Models API（模型、下载、点赞） |
| Stack Overflow | Stack Exchange API v2.3（问题、回答、标签） |
| arXiv | 官方分类 RSS / Atom API（论文、作者、分类） |
| 官方 RSS | 官方博客 RSS / Atom（产品与工程动态） |
| 前端框架 | React 18 + Vite 8 |
| 样式 | TailwindCSS 3 |
| 定时执行 | GitHub Actions（cron） |
| 部署 | GitHub Pages（静态托管） |

## 🗂️ 类别配置

默认内置七个兴趣类别，集中定义在 [`src/categories.ts`](./src/categories.ts)：

| 类别 | 重点关注 |
| --- | --- |
| AI | AI 产品、模型、LLM 与通用讨论 |
| 工具 | 效率、自动化与工作流 |
| 代码 | 编程语言、开发工具与工程实践 |
| Agent | Agent、MCP、工具调用与 Agent 框架 |
| 模型研究 | 论文、Benchmark、数据集与模型评测 |
| 开源 | GitHub 项目、自托管与开源生态 |
| 基础设施 | Kubernetes、Docker、数据库、云原生与可观测性 |

> 增删类别：编辑 `src/categories.ts` 的 `CATEGORIES`。`mode` 支持 `rankings`（榜单：App Store 填 `genreId`，Google Play 填 `category`）或 `search`（填 `searchTerms`）。

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
│   │   ├── bluesky.ts                   # Bluesky 公共搜索
│   │   ├── mastodon.ts                  # Mastodon hashtag 时间线
│   │   ├── gdelt.ts                     # GDELT 新闻搜索
│   │   ├── hackerNews.ts                # Hacker News 热门搜索
│   │   ├── github.ts                    # GitHub 仓库搜索
│   │   ├── huggingFace.ts               # Hugging Face 模型搜索
│   │   ├── stackOverflow.ts             # Stack Overflow 问题搜索
│   │   ├── arxiv.ts                     # arXiv 分类 RSS / API
│   │   ├── rss.ts                        # 官方 RSS / Atom
│   │   ├── detailScraper.ts            # 来源网页详情抓取（og:meta + JSON-LD）
│   │   └── utils.ts                    # 防御性字段归一化工具
│   ├── storage/
│   │   ├── saveData.ts                 # 写入摘要、详情和历史快照
│   │   ├── generateHtml.ts             # 生成 / 注入静态 HTML
│   │   ├── generateSample.ts           # 生成示例数据（npm run sample）
│   │   ├── migrateData.ts              # 旧数据迁移到 schema v2
│   │   └── validateData.ts             # 数据结构和详情引用校验
│   ├── dataModel.ts                    # ID、类别、指标、热度和详情模型
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
│   ├── daily.json                      # 当日摘要数据
│   ├── details/                        # 按 detailRef 拆分的详情文件
│   └── history/                        # 每日摘要快照和索引
├── dist/                               # 构建产物（轻量 index.html + feed/metrics/RSS）
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

编辑 `.env`。Bluesky / Mastodon / GDELT / Hacker News 无需 token；App Store / Google Play 无需 key；Product Hunt 和 Reddit 按需配置：

```
PRODUCT_HUNT_TOKEN=ph_token_xxxxxxxx   # Product Hunt 官方 API（推荐）
# APIFY_API_KEY=apify_api_xxx          # 可选，Product Hunt 兜底
```

### 4. 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器（读 `data/daily.json`） |
| `npm run fetch` | 采集 → 来源网页详情抓取 → 生成静态页 |
| `npm run sample` | 生成十三个来源的示例数据（按七个类别生成） |
| `npm run migrate:data` | 将旧版 `data/daily.json` 迁移为 schema v2，并拆分详情 |
| `npm run build` | 构建前端到 `dist/` |
| `npm run generate` | 生成 feed/metrics/RSS，并同步历史与详情 |
| `npm run build:all` | 构建 + 静态数据导出（生产链路） |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run validate:data` | 校验 schema、ID、类别、热度和详情文件引用 |
| `npm run validate:dist` | 校验轻量 HTML、独立 feed/metrics/RSS 与静态资源引用 |
| `npm run check:health` | 输出来源健康表并执行关键来源连续失败门禁 |
| `npm test` | 运行话题、偏好和健康保底自动化测试 |
| `npm run preview` | 本地预览 `dist/` 构建产物 |

> **提示**：绝大多数来源无需密钥；Product Hunt 优先使用官方 Token。Reddit / Bluesky 在 CI 出口受限时会自动降级到 Arctic Shift / Jetstream，配置官方凭据后可获得更完整的互动排序。

> **详情抓取**：采集完成后会自动并发抓取来源网页（解析 `og:meta` 与 JSON-LD），补充完整描述、高清图、截图、评分、价格、作者等。详情默认缓存 7 天；`SCRAPE_DETAILS=false` 关闭，`SCRAPE_DETAILS_CONCURRENCY` 调并发，`SCRAPE_DETAILS_CACHE_DAYS` 调 TTL；抓取失败自动使用缓存或原数据。

## 🔑 环境变量参考

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `PRODUCT_HUNT_TOKEN` | 推荐 | Product Hunt 官方 GraphQL API Token |
| `APIFY_API_KEY` | 可选 | 仅 Product Hunt 兜底（其余源无需） |
| `APIFY_PRODUCT_HUNT_ACTOR_ID` | 可选 | Product Hunt 兜底 Actor |
| `APP_STORE_MAX_ITEMS` | 可选 | 每类别 App Store 采集数（默认 30） |
| `GOOGLE_PLAY_MAX_ITEMS` | 可选 | 每类别 Google Play 采集数（默认 30） |
| `PRODUCT_HUNT_MAX_ITEMS` | 可选 | 每类别 Product Hunt 采集数（默认 20） |
| `REDDIT_LIMIT` | 可选 | 每类别 Reddit 采集数（默认 30） |
| `BLUESKY_LIMIT` | 可选 | 每类别 Bluesky 采集数（默认 25） |
| `BSKY_IDENTIFIER` | 可选 | Bluesky handle 或邮箱（搜索 403 时配置） |
| `BSKY_APP_PASSWORD` | 可选 | Bluesky App Password（不要使用主账号密码） |
| `MASTODON_LIMIT` | 可选 | 每类别 Mastodon 采集数（默认 25） |
| `GDELT_LIMIT` | 可选 | 每类别 GDELT 采集数（默认 25） |
| `GDELT_MIN_INTERVAL_MS` | 可选 | GDELT 请求最小间隔（默认 12000ms） |
| `GDELT_RETRIES` | 可选 | GDELT 429 / 5xx 重试次数（默认 2） |
| `HACKER_NEWS_LIMIT` | 可选 | 每类别 Hacker News 采集数（默认 25） |
| `GITHUB_API_TOKEN` | 可选 | GitHub API Token（提高公共 API 限额） |
| `GITHUB_LIMIT` | 可选 | 每类别 GitHub 采集数（默认 25） |
| `HUGGING_FACE_LIMIT` | 可选 | 每类别 Hugging Face 采集数（默认 25） |
| `STACKOVERFLOW_LIMIT` | 可选 | 每类别 Stack Overflow 采集数（默认 25） |
| `ARXIV_LIMIT` | 可选 | 每类别 arXiv 采集数（默认 25） |
| `RSS_LIMIT` | 可选 | 每类别官方 RSS 采集数（默认 25） |
| `MASTODON_INSTANCE` | 可选 | Mastodon 实例（默认 `mastodon.social`） |
| `APP_STORE_COUNTRY` | 可选 | App Store 地区（默认 `us`） |
| `GOOGLE_PLAY_COUNTRY` | 可选 | Google Play 地区（默认 `us`） |
| `REDDIT_CLIENT_ID` | 可选 | Reddit OAuth client_id（CI 抓 Reddit 推荐） |
| `REDDIT_CLIENT_SECRET` | 可选 | Reddit OAuth client_secret |
| `REDDIT_PROXY` | 可选 | Reddit 代理出口（备用） |
| `REDDIT_ARCHIVE_API_URL` | 可选 | Reddit 公开归档降级地址（默认 Arctic Shift） |
| `BLUESKY_JETSTREAM_URL` | 可选 | Bluesky Jetstream 降级实例 |
| `SCRAPE_DETAILS` | 可选 | 是否抓取来源网页详情（默认 `true`） |
| `SCRAPE_DETAILS_CONCURRENCY` | 可选 | 详情抓取并发数（默认 4） |
| `SCRAPE_DETAILS_CACHE_DAYS` | 可选 | 详情缓存有效期（默认 7 天） |
| `DATA_RETENTION_DAYS` | 可选 | 历史快照保留期（默认 30 天） |
| `SOURCE_HEALTH_MIN_<SOURCE>` | 可选 | 覆盖指定来源的最低采集条数，例如 `SOURCE_HEALTH_MIN_GITHUB` |
| `SOURCE_HEALTH_MAX_FAILURES_<SOURCE>` | 可选 | 覆盖指定来源允许的连续失败次数 |
| `SOURCE_HEALTH_MIN_CATEGORY_<SOURCE>` | 可选 | 覆盖指定来源每个类别的最低采集条数 |
| `SOURCE_HEALTH_MAX_STALE_DAYS` | 可选 | 历史保底最长可使用天数（默认按来源 3–7 天） |
| `TRANSLATION_API_URL` | 可选 | LibreTranslate 兼容服务地址；工作流未配置时默认 MyMemory |
| `TRANSLATION_API_KEY` | 可选 | 翻译实例需要认证时使用 |
| `TRANSLATION_MAX_ITEMS_PER_RUN` | 可选 | 单次最多新增翻译条数（默认 300） |
| `TRANSLATION_CONCURRENCY` | 可选 | 翻译请求并发数（默认 3） |
| `SITE_URL` | 可选 | RSS channel 对应的网站地址 |

### App Store / Google Play（无需 key）

- **App Store** 走苹果官方 iTunes API（榜单 RSS + Search + Lookup），免费、稳定、无需 key。
- **Google Play** 走社区标准库 `google-play-scraper`，无需 key。
- **Reddit** 优先 OAuth，其次公共 JSON；数据中心出口被拒时自动读取 Arctic Shift 最近 24 小时公开归档并按分数排序。
- **Bluesky** 走 `public.api.bsky.app` 公共 AppView API，无需 token。
  若公共搜索端点受限，优先配置 `BSKY_IDENTIFIER` + `BSKY_APP_PASSWORD` 使用免费 App Password 登录；未配置时自动降级到官方 Jetstream 近期关键词流。
- **Mastodon** 读取配置实例的公开 hashtag 时间线；实例可通过 `MASTODON_INSTANCE` 更换。
- **GDELT** 优先走 DOC 2.0 API；超时或无结果时熔断并读取官方 15 分钟 GKG 压缩文件，同轮只下载解析一次。
- **Hacker News** 走 Algolia 的公开搜索接口，按类别关键词检索最近 3 天的技术讨论。
- **GitHub** 走 REST Search API，按类别搜索最近更新的公共仓库；未认证额度较低，CI 建议配置 `GITHUB_API_TOKEN`。
- **Hugging Face** 走 Hub Models API，按下载量搜索模型，保留下载量、点赞、任务和许可证。
- **Stack Overflow** 走 Stack Exchange API v2.3，按标签逐组检索最近活跃的问题，避免多标签 AND 查询导致结果为空。
- **arXiv** 优先使用官方分类 RSS，API 作为非分类检索式的兜底；请求带间隔与退避，降低公共接口限流风险。
- **官方 RSS** 读取配置在 `src/categories.ts` 中的官方博客 Feed，仅保留最近 14 天内容。

### 获取 Product Hunt Token（推荐）

1. 打开 [Product Hunt API 应用管理](https://www.producthunt.com/v2/oauth/applications)。
2. 创建一个应用，复制其 **Developer Token**，填入 `PRODUCT_HUNT_TOKEN`。

### 获取 Apify API Key（可选，仅 Product Hunt 兜底）

1. 注册 [Apify](https://apify.com/)。
2. **Console → Settings → Integrations → Personal API tokens**。
3. 新建 Token，填入 `APIFY_API_KEY`（仅当未配置 `PRODUCT_HUNT_TOKEN` 时用于 Product Hunt 兜底，Actor 为 `glassventures~product-hunt-scraper`）。

### 获取 Product Hunt Token

1. 打开 [Product Hunt API 应用管理](https://www.producthunt.com/v2/oauth/applications)。
2. 创建一个应用，复制其 **Developer Token**。
3. 填入 `PRODUCT_HUNT_TOKEN`。配置后 Product Hunt 走官方 GraphQL API，数据更全（完整描述 / 官网 / 评分 / 话题标签等）。

## ⏰ GitHub Actions 定时任务

工作流文件：`.github/workflows/daily-fetch.yml`

- 触发：`23:37 UTC`（北京时间 07:37）主任务 + `00:17 UTC`（北京时间 08:17）兜底 + `workflow_dispatch` / `repository_dispatch`。兜底先检查上海自然日和 12 小时新鲜度，避免重复采集。
- 流程：Checkout → 装依赖 → 采集与类别级保底 → 增量详情/翻译 → 话题与摘要 → 构建 → 数据校验 → 来源健康检查 → 回写数据 → 健康门禁 → 失败告警。Pages 部署前会再次执行数据与健康门禁，避免后续普通 push 误部署退化快照。

### 翻译与告警

翻译优先使用 LibreTranslate 兼容的 `/translate` 接口。可自托管后把地址写入仓库 Variable `TRANSLATION_API_URL`，需要认证时再配置 `TRANSLATION_API_KEY` Secret。未配置时工作流默认使用 MyMemory 免费匿名接口，每天最多翻译 20 个标题；结果增量缓存在 `data/translations.json`。

每次验证都会把描述、图片、发布时间、中文标题和跨来源话题覆盖率写入 Actions Summary；生产构建同时发布 `metrics.json`，便于外部监控读取。

外部告警支持通用 `ALERT_WEBHOOK_URL`、飞书 `FEISHU_WEBHOOK_URL`，或 Telegram 的 `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`；均通过仓库 Secrets 配置。

### 配置 Secrets

仓库 **Settings → Secrets and variables → Actions → New repository secret**：

| Secret 名 | 是否必填 | 说明 |
| --- | --- | --- |
| `PRODUCT_HUNT_TOKEN` | 推荐 | Product Hunt 官方 API Token |
| `APIFY_API_KEY` | 可选 | 仅 Product Hunt 兜底 |
| `APIFY_PRODUCT_HUNT_ACTOR_ID` | 可选 | Product Hunt 兜底 Actor |
| `REDDIT_CLIENT_ID` | 推荐 | Reddit OAuth client_id |
| `REDDIT_CLIENT_SECRET` | 推荐 | Reddit OAuth client_secret |
| `REDDIT_PROXY` | 可选 | Reddit 代理出口（备用） |
| `BSKY_IDENTIFIER` | 可选 | Bluesky handle 或邮箱（搜索 403 时配置） |
| `BSKY_APP_PASSWORD` | 可选 | Bluesky App Password |

## 🕸️ Reddit 在 CI 中抓取（OAuth / 代理）

GitHub Actions 是数据中心 IP，访问 `reddit.com` 公共 JSON 会被 403。两种解法：

### 方式一（推荐）：官方 OAuth

1. 到 [Reddit Apps](https://www.reddit.com/prefs/apps) 创建一个 **installed app**（或 script）。
2. 拿到 `client_id` 与 `client_secret`，写入 Secrets：
   ```
   REDDIT_CLIENT_ID=xxx
   REDDIT_CLIENT_SECRET=xxx
   ```
3. 重新触发采集即可，Reddit 走 `oauth.reddit.com`，免代理、无需存储账号密码。

### 方式二：HTTP 代理

1. 准备一个「干净 IP」的 HTTP 代理（住宅代理服务，或自建 squid / tinyproxy）。
2. 写入 Secret：`REDDIT_PROXY=http://username:password@host:port`。
3. 重新触发采集，Reddit 请求走该代理。

> 两者都未配置时，本地（家庭 IP）直连通常可用；仅 CI 会 403。

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

采集结果使用 schema v2。`data/daily.json` 只保存列表摘要，详情文件位于 `data/details/`：

```typescript
interface FeedItem {
  id: string;                 // source:sourceItemId，全局稳定唯一标识
  sourceItemId?: string;     // 来源内稳定 ID
  title: string;              // 标题
  description?: string;       // 简短描述（列表用）
  url: string;                // 原文链接（讨论 / 产品页）
  externalUrl?: string;       // 外部目标链接（如 Reddit 原文、PH 官网）
  source: 'appstore' | 'googleplay' | 'producthunt' | 'reddit' | 'bluesky' | 'mastodon' | 'gdelt' | 'hackernews' | 'github' | 'huggingface' | 'stackoverflow' | 'arxiv' | 'rss';
  category?: string;          // 旧数据兼容字段
  categoryId?: string;        // 主类别 ID
  categoryIds?: string[];     // 所属类别 ID
  rank?: number;              // 排名
  heatScore?: number;         // 按来源归一化的 0–100 热度
  metrics?: {                 // 来源指标，保留原始量纲
    rawScore?: number;
    rawScoreLabel?: string;
    rating?: number;
    ratingCount?: number;
    comments?: number;
    installs?: number;
    votes?: number;
  };
  detailRef?: string;          // 详情文件相对路径
  thumbnail?: string;         // 缩略图 URL
  publishedAt?: string;       // 发布时间
  tags?: string[];            // 平台附加标签
}

interface DetailFile {
  schemaVersion: 2;
  id: string;
  detail: {
    longDescription?: string;
    externalUrl?: string;
    screenshots?: string[];
    rating?: number;
    price?: string;
    developer?: string;
    comments?: number;
    stats?: Array<{ label: string; value: string }>;
  };
}
```

## 🛠️ 常见问题

**Q：App Store / Google Play 没有数据？**
A：这两个源走官方 iTunes API / `google-play-scraper`，无需 key。若失败多为网络问题或接口变动，查看日志 `[source] ❌`。

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
