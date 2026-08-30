# DailyPulse — 剩余工作清单

> 本文件记录尚未完成的收尾工作、已知问题与可选优化项。
> 已实现并验证的部分见 `README.md`。

## 状态总览

已完成：十三平台采集框架、七个兴趣类别、详情抓取、schema v2、跨来源 heatScore、摘要 / 详情拆分、历史快照、来源健康保底、话题聚类、每日摘要、双语搜索、个人偏好、RSS/JSON/metrics 导出、PR CI、覆盖与数据质量门禁、外部告警、滚动窗口调度、新鲜度门控、GDELT GKG 降级、首屏数据拆包，以及 Node 22 / TypeScript 7 / Vite 8 工程升级。

---

## 一、上线前待办

- [x] **配置 Product Hunt Token（Secret，推荐）**
  - 本地：`cp .env.example .env`，填入 `PRODUCT_HUNT_TOKEN`（你的 zsh 已有）。
  - 线上：仓库已配置 `PRODUCT_HUNT_TOKEN`。
  - 未配置时 Product Hunt 回退 Apify（需 `APIFY_API_KEY`）。
  - App Store / Google Play / Bluesky / Mastodon / GDELT / Hacker News / Hugging Face / Stack Overflow / arXiv / RSS 无需必填 key；Reddit 推荐配置 OAuth，GitHub 推荐配置 Token。

- [x] **运行线上采集并验证 13/13**
  - 2026-08-29 手动运行 Daily Fetch 已通过：1,430 条数据、13/13 来源覆盖；Reddit / Bluesky / GDELT 分别通过 Arctic Shift / Jetstream / GKG 官方存储降级取得本轮数据。
  - 可选配置 Reddit OAuth 与 Bluesky App Password，以恢复官方接口和更完整的互动排序。

- [ ] **完成 HTTPS 强制跳转**
  - 页面已有 HTTP → HTTPS 客户端兜底，HTTPS 本身可访问。
  - GitHub Pages 暂无源站证书，Cloudflare API Token 又限制当前出口 IP；需在 Cloudflare 启用 **Always Use HTTPS**，或临时关闭代理让 GitHub 完成证书签发后再开启 `https_enforced`。

- [x] **确认访问量统计归属**
  - 已在 Cloudflare 创建 `dailypulse.kitdesk.site` Web Analytics 站点，并将页面 Beacon Token 替换为该站点专属 Token；部署后开始积累 PV/访问量。

---

## 二、已知问题

- [x] **Reddit 403（数据中心 / 云主机 IP）**
  - 现象：GitHub Actions runner 上 `reddit.com` 公共 JSON 会 403。
  - 已做：官方 OAuth + `REDDIT_PROXY` + `www`/`old.reddit` 双主机；均失败时自动读取 Arctic Shift 最近 24 小时公开归档。

- [ ] **Apify 免费额度（仅 Product Hunt 兜底）**
  - 配置 `PRODUCT_HUNT_TOKEN` 后不再依赖 Apify；仅未配 token 时 PH 走 Apify 兜底。

- [x] **cron 时区与触发延迟**
  - 2026-08-30 观察到 GitHub 单次 cron 延迟到北京时间 09:36；已改为 07:37–09:17 离峰滚动窗口，并按上海自然日与快照年龄确保每天只采集一次。

- [x] **详情抓取耗时**
  - 已加入详情 TTL 缓存、过期缓存失败保底和无引用详情清理；可用 `SCRAPE_DETAILS_CACHE_DAYS`、`SCRAPE_DETAILS_CONCURRENCY` 调整。

---

## 三、可选优化

- [x] **每日数据历史归档**：`data/history/YYYY-MM-DD.json` 保存摘要快照，`index.json` 提供日期索引，前端支持「往期」切换。
- [x] **采集健康门禁**：来源低于最低产量时回退上一份有效数据；关键来源连续超限时 Actions 失败并阻止退化快照部署。
- [x] **外部失败告警**：支持通用 Webhook、飞书与 Telegram；配置相应 Secrets 后启用。
- [x] **重试与退避**：Apify 轮询已加入有限次数重试；详情抓取失败保留原始数据。
- [x] **列表分页 / 懒加载**：列表默认分批展示并支持「加载更多」。
- [x] **前端增强**：关键词搜索、深色模式、详情页上一项/下一项已完成。
- [x] **话题与每日摘要**：跨来源语义聚类、话题详情、今日三件事、为什么热和昨日趋势。
- [x] **个人化与开放订阅**：收藏、已读、分享、类别/关键词/来源权重、RSS 和 JSON 导出。
- [x] **首屏与质量指标**：生产 HTML 不再内联 1MB+ JSON；异步读取 `feed.json`，并输出 `metrics.json` 与 Actions 数据质量报告。
- [ ] **gh-pages 分支部署**：改用 `peaceiris/actions-gh-pages` 推独立 `gh-pages` 分支，主分支更干净。

---

## 补充说明

- `npm run sample` 会生成 schema v2 示例摘要和详情文件；首次真实采集后 `data/daily.json` 自动覆盖，页面「示例数据」角标消失。
- 采集字段均为**防御性映射**（`src/fetch/utils.ts`）；更换 Actor 后若个别字段为空，按实际输出补充候选键即可。
- 详情页信息由 `src/fetch/detailScraper.ts` 从来源网页抓取补充，个别站点（如 Product Hunt 网页）有反爬会 403，此时保留 Apify/API 原有数据。
