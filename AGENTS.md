# AGENTS.md

> 本文件为 AI 编码助手（Codex / Claude Code / Copilot 等）提供本仓库的工作指引。
> 面向使用者的文档见 `README.md`，剩余工作清单见 `TODO.md`。

## 项目概述

DailyPulse —— 每日 08:00（UTC+8）按类别自动聚合 **App Store / Google Play / Product Hunt / Reddit** 热门内容的「信息早餐」。

- **采集**：Node.js + TypeScript（`tsx` 运行）按「类别 × 源」采集 → 来源网页详情抓取 → 写入 `data/daily.json` → 生成/注入 `dist/index.html`。
- **Product Hunt**：优先官方 GraphQL API（`PRODUCT_HUNT_TOKEN`），无 token 回退 Apify。
- **前端**：React 18 + Vite 5 + TailwindCSS 3，hash 路由（列表 + 详情页），从 `window.__DAILY_DATA__` 读取数据。
- **调度**：GitHub Actions cron（UTC 0:00）采集并回写；`.github/workflows/deploy.yml` 自动部署 `dist/` 到 Pages。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run fetch` | 采集 → 详情抓取 → 生成静态页 |
| `npm run sample` | 生成 440 条示例数据（每类别 110） |
| `npm run build` | Vite 构建到 `dist/` |
| `npm run generate` | 将 `data/daily.json` 注入 `dist/index.html` |
| `npm run build:all` | 构建 + 注入（生产链路） |
| `npm run typecheck` | `tsc --noEmit` 类型检查 |
| `npm run preview` | 预览 `dist/` 构建产物 |

提交前至少应通过 `npm run typecheck`。

## 架构与数据流

```
src/index.ts（主入口）
  ├─ fetch/*.ts             各源 fetchXxx() -> FeedItem[]
  │   ├─ fetch/apify.ts        runApifyActor()：通用 Apify 启动/轮询/取数
  │   ├─ fetch/productHunt.ts  GraphQL API（优先）/ Apify 兜底
  │   └─ fetch/detailScraper.ts 来源网页详情抓取（og:meta + JSON-LD，cheerio）
  ├─ storage/saveData.ts       写 data/daily.json（含时间戳）
  ├─ storage/generateHtml.ts   注入或生成 dist/index.html
  └─ storage/generateSample.ts 生成示例数据（npm run sample）
src/web/*                    React 前端（hash 路由：列表 + 详情页）
```

关键约定：

- 共享类型在 `src/types.ts`（`FeedItem` / `FeedData` / `Source` / `SOURCE_META`）。
- 采集字段统一用 `src/fetch/utils.ts` 的防御性取值（`pickStr` / `pickNum` / `pickValue` / `toIso` / `toJoined` / `kv`），兼容不同 Actor 输出字段名差异。
- 每个数据源独立 `try-catch`，单个源失败不中断整体；顺序执行以规避 Apify 免费账号并发限制。
- 兴趣类别在 `src/categories.ts`（`CATEGORIES`）集中定义，各源按「类别 × 源」采集；`FeedItem.category` 存类别 label，`tags` 存平台附加标签。
- 详情页信息经 `detailScraper` 从来源网页补充（`longDescription` / `externalUrl` / `screenshots` / `rating` / `price` / `developer` / `comments` / `stats`）。

## 重要约束与易错点

1. **依赖锁定**：CI 使用 `npm ci`，改依赖后需同步提交 `package-lock.json`。
2. **`data/daily.json` 与 `dist/` 需提交**：不要加入 `.gitignore`（定时任务回写、Pages 托管依赖它们）。
3. **`generateHtml` 必须幂等**：注入前先移除旧的 `window.__DAILY_DATA__`（见 `INJECTED_SCRIPT_RE`），重复运行不累积。
4. **Vite `base: './'`**：保证 GitHub Pages 任意子路径可用，不要改成绝对路径。
5. **Apify Actor ID 用 `~` 分隔**（如 `haketa~app-store-scraper`），网页 URL 中才是 `/`。
6. **Reddit 可能 403**：云主机 / 数据中心 IP 常见，已做浏览器 UA + `www`/`old.reddit` 双主机回退。
7. **cron 使用 UTC**：`'0 0 * * *'` 即北京时间 8:00。
8. **Product Hunt 优先官方 API**：读 `PRODUCT_HUNT_TOKEN`（兼容 `PH_DEVELOPER_TOKEN`）；无 token 才回退 Apify，勿删除回退逻辑。
9. **详情抓取可关**：`SCRAPE_DETAILS=false` 跳过；抓取失败应保留原数据，勿让异常中断整体。

## 修改指南

- **新增数据源**：
  1. 在 `src/fetch/` 新建 `fetchXxx()`，返回 `FeedItem[]`；
  2. 在 `src/index.ts` 的 `tasks` 列表注册；
  3. 在 `src/types.ts` 的 `Source` / `SOURCES` / `SOURCE_META` 中补充元信息（label、short、颜色、scoreLabel）。
- **新增/调整类别**：编辑 `src/categories.ts` 的 `CATEGORIES`（每类含四源采集参数），前端类别筛选自动生效。
- **调整展示**：改 `src/web/`（`App.tsx` 与 `components/`，含 `DetailPage` / `ExpandableText` / `CategoryFilter` 等）。
- **更换 Actor**：改 `.env` 的 `APIFY_*_ACTOR_ID`，必要时在对应 `src/fetch/*.ts` 调整输入参数与字段映射候选键。
- **调整详情抓取**：改 `src/fetch/detailScraper.ts`（og:meta / JSON-LD 字段提取与合并逻辑）。
- **重新生成示例数据**：改 `src/storage/generateSample.ts` 后运行 `npm run sample`。

## 参考

- 使用与部署说明：`README.md`
- 剩余工作与已知问题：`TODO.md`
