# AGENTS.md

> 本文件为 AI 编码助手（Codex / Claude Code / Copilot 等）提供本仓库的工作指引。
> 面向使用者的文档见 `README.md`，剩余工作清单见 `TODO.md`。

## 项目概述

DailyPulse —— 每日 08:00（UTC+8）按类别自动聚合 **App Store / Google Play / Product Hunt / Reddit / Bluesky / Mastodon / GDELT / Hacker News / GitHub / Hugging Face / Stack Overflow / arXiv / RSS** 热门内容的「信息早餐」。

- **采集**：Node.js + TypeScript（`tsx` 运行）按「类别 × 源」采集 → 来源网页详情抓取 → 写入 `data/daily.json` → 生成/注入 `dist/index.html`。
- **Product Hunt**：优先官方 GraphQL API（`PRODUCT_HUNT_TOKEN`），无 token 回退 Apify。
- **前端**：React 18 + Vite 5 + TailwindCSS 3，hash 路由（列表 + 详情页），从 `window.__DAILY_DATA__` 读取数据。
- **调度**：GitHub Actions cron（UTC 0:00）采集并回写；`.github/workflows/deploy.yml` 自动部署 `dist/` 到 Pages。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run fetch` | 采集 → 详情抓取 → 生成静态页 |
| `npm run sample` | 生成十三来源示例数据（每类别约 290 条） |
| `npm run build` | Vite 构建到 `dist/` |
| `npm run generate` | 将 `data/daily.json` 注入 `dist/index.html` |
| `npm run build:all` | 构建 + 注入（生产链路） |
| `npm run typecheck` | `tsc --noEmit` 类型检查 |
| `npm run check:health` | 输出来源健康报告并执行连续失败门禁 |
| `npm test` | 运行核心数据与偏好逻辑测试 |
| `npm run preview` | 预览 `dist/` 构建产物 |

提交前至少应通过 `npm run typecheck`。

## 架构与数据流

```
src/index.ts（主入口）
  ├─ fetch/*.ts             各源 fetchXxx() -> FeedItem[]
  │   ├─ fetch/appStore.ts     官方 iTunes API（RSS + Search + Lookup，无需 key）
  │   ├─ fetch/googlePlay.ts   google-play-scraper（无需 key）
  │   ├─ fetch/productHunt.ts  GraphQL API（优先）/ Apify 兜底
  │   ├─ fetch/apify.ts        runApifyActor()：仅 Product Hunt 兜底使用
  │   ├─ fetch/bluesky.ts      Bluesky 公共搜索 / App Password 认证
  │   ├─ fetch/mastodon.ts     Mastodon hashtag 时间线
  │   ├─ fetch/gdelt.ts        GDELT DOC 2.0 新闻搜索
  │   ├─ fetch/hackerNews.ts   Hacker News Algolia 搜索
  │   ├─ fetch/github.ts        GitHub REST 仓库搜索
  │   ├─ fetch/huggingFace.ts   Hugging Face 模型搜索
  │   ├─ fetch/stackOverflow.ts Stack Exchange 问题搜索
  │   ├─ fetch/arxiv.ts         arXiv 分类 RSS / API
  │   ├─ fetch/rss.ts           官方 RSS / Atom
  │   └─ fetch/detailScraper.ts 来源网页详情抓取（og:meta + JSON-LD，cheerio）
  ├─ storage/saveData.ts       写 data/daily.json（含时间戳）
  ├─ storage/checkHealth.ts    输出来源健康表并执行关键来源门禁
  ├─ storage/generateHtml.ts   注入或生成 dist/index.html
  └─ storage/generateSample.ts 生成示例数据（npm run sample）
src/sourceHealth.ts           来源最低产量、连续失败与历史保底策略
src/intelligence.ts          跨来源话题聚类、趋势与每日编辑摘要
src/translation.ts           LibreTranslate 兼容翻译与增量缓存
src/web/*                    React 前端（hash 路由：列表 + 详情页）
```

关键约定：

- 共享类型在 `src/types.ts`（`FeedItem` / `FeedData` / `Source` / `SOURCE_META`）。
- 采集字段统一用 `src/fetch/utils.ts` 的防御性取值（`pickStr` / `pickNum` / `pickValue` / `toIso` / `toJoined` / `kv`），兼容不同 Actor 输出字段名差异。
- 每个数据源独立 `try-catch`，单个源失败不中断整体；顺序执行以降低对目标站点的压力。
- 来源健康策略集中在 `src/sourceHealth.ts`；按「来源 × 类别」保留本次成功条目并补齐失败类别，超过陈旧上限不再保底，关键来源连续超限由 `npm run check:health` 阻止部署。
- `src/intelligence.ts` 只用确定性规则生成话题与摘要，话题 ID 必须稳定且不可跨类别误聚类。
- 中文翻译为可选增强：未配置 `TRANSLATION_API_URL` 时必须无损跳过，不能阻断采集。
- 兴趣类别在 `src/categories.ts`（`CATEGORIES`）集中定义，各源按「类别 × 源」采集；`FeedItem.category` 存类别 label，`tags` 存平台附加标签。
- 详情页信息经 `detailScraper` 从来源网页补充（`longDescription` / `externalUrl` / `screenshots` / `rating` / `price` / `developer` / `comments` / `stats`）。

## 重要约束与易错点

1. **依赖锁定**：CI 使用 `npm ci`，改依赖后需同步提交 `package-lock.json`。
2. **`data/daily.json` 与 `dist/` 需提交**：不要加入 `.gitignore`（定时任务回写、Pages 托管依赖它们）。
3. **`generateHtml` 必须幂等**：注入前先移除旧的 `window.__DAILY_DATA__`（见 `INJECTED_SCRIPT_RE`），重复运行不累积。
4. **Vite `base: './'`**：保证 GitHub Pages 任意子路径可用，不要改成绝对路径。
5. **App Store / Google Play 无需 key**：分别走官方 iTunes API 与 `google-play-scraper`；Apify 仅用于 Product Hunt 兜底，其 Actor ID 用 `~` 分隔（如 `glassventures~product-hunt-scraper`）。
6. **Reddit 可能 403**：CI 优先用 OAuth（`REDDIT_CLIENT_ID/SECRET`，见 `src/fetch/reddit.ts`），或 `REDDIT_PROXY` 代理兜底；本地直连通常可用。
7. **cron 使用 UTC**：`'0 0 * * *'` 即北京时间 8:00。
8. **Product Hunt 优先官方 API**：读 `PRODUCT_HUNT_TOKEN`（兼容 `PH_DEVELOPER_TOKEN`）；无 token 才回退 Apify，勿删除回退逻辑。
9. **详情抓取可关且有缓存**：`SCRAPE_DETAILS=false` 跳过；默认缓存 7 天，抓取失败应保留缓存或原数据，勿让异常中断整体。
10. **数据清理必须基于引用**：历史默认保留 30 天；详情文件只有在不被最新数据和任何保留快照引用时才能删除。

## 修改指南

- **新增数据源**：
  1. 在 `src/fetch/` 新建 `fetchXxx()`，返回 `FeedItem[]`；
  2. 在 `src/index.ts` 的 `tasks` 列表注册；
  3. 在 `src/types.ts` 的 `Source` / `SOURCES` / `SOURCE_META` 中补充元信息（label、short、颜色、scoreLabel）。
- **新增/调整类别**：编辑 `src/categories.ts` 的 `CATEGORIES`（每类含各源采集参数），前端类别筛选自动生效。
- **调整展示**：改 `src/web/`（`App.tsx` 与 `components/`，含 `DetailPage` / `ExpandableText` / `CategoryFilter` 等）。
- **更换数据来源**：App Store 改 `src/categories.ts` 的 `genreId`/`searchTerms`；Google Play 改 `category`/`searchTerms`；Product Hunt 兜底改 `.env` 的 `APIFY_PRODUCT_HUNT_ACTOR_ID`。
- **调整详情抓取**：改 `src/fetch/detailScraper.ts`（og:meta / JSON-LD 字段提取与合并逻辑）。
- **重新生成示例数据**：改 `src/storage/generateSample.ts` 后运行 `npm run sample`。

## 参考

- 使用与部署说明：`README.md`
- 剩余工作与已知问题：`TODO.md`
