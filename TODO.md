# DailyPulse — 剩余工作清单

> 本文件记录尚未完成的收尾工作、已知问题与可选优化项。
> 已实现并验证的部分见 `README.md`。

## 状态总览

已完成：项目骨架、十三平台按类别采集、七个兴趣类别、来源网页详情抓取、schema v2 数据模型、跨来源 heatScore、摘要 / 详情拆分、历史快照、来源健康门禁与旧数据保底、详情增量缓存与保留期清理、详情页、静态页生成、React 前端、GitHub Actions 定时任务与 Pages 自动部署。

---

## 一、上线前待办

- [ ] **配置 Product Hunt Token（Secret，推荐）**
  - 本地：`cp .env.example .env`，填入 `PRODUCT_HUNT_TOKEN`（你的 zsh 已有）。
  - 线上：仓库 **Settings → Secrets and variables → Actions** 添加 `PRODUCT_HUNT_TOKEN`。
  - 未配置时 Product Hunt 回退 Apify（需 `APIFY_API_KEY`）。
  - App Store / Google Play / Bluesky / Mastodon / GDELT / Hacker News / Hugging Face / Stack Overflow / arXiv / RSS 无需必填 key；Reddit 推荐配置 OAuth，GitHub 推荐配置 Token。

- [ ] **验证定时任务**
  - 到 **Actions** 页手动 `Run workflow` 一次，确认「采集 → 详情抓取 → 构建 → 回写 → 部署」全链路正常。
  - 确认 cron 在 `UTC 0:00 = 北京时间 8:00` 生效。

---

## 二、已知问题

- [x] **Reddit 403（数据中心 / 云主机 IP）**
  - 现象：GitHub Actions runner 上 `reddit.com` 公共 JSON 会 403。
  - 已做：官方 OAuth（`REDDIT_CLIENT_ID/SECRET`，推荐，免代理）+ `REDDIT_PROXY` 代理兜底 + `www`/`old.reddit` 双主机回退（`src/fetch/reddit.ts`）。
  - 使用：Secrets 添加 `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET`（创建 Reddit installed app），或 `REDDIT_PROXY`。

- [ ] **Apify 免费额度（仅 Product Hunt 兜底）**
  - 配置 `PRODUCT_HUNT_TOKEN` 后不再依赖 Apify；仅未配 token 时 PH 走 Apify 兜底。

- [ ] **cron 时区与首次触发延迟**
  - GitHub Actions `schedule` 用 UTC，`'0 0 * * *'` 即北京时间 8:00；首次触发可能延迟，属正常行为。

- [x] **详情抓取耗时**
  - 已加入详情 TTL 缓存、过期缓存失败保底和无引用详情清理；可用 `SCRAPE_DETAILS_CACHE_DAYS`、`SCRAPE_DETAILS_CONCURRENCY` 调整。

---

## 三、可选优化

- [x] **每日数据历史归档**：`data/history/YYYY-MM-DD.json` 保存摘要快照，`index.json` 提供日期索引，前端支持「往期」切换。
- [x] **采集健康门禁**：来源低于最低产量时回退上一份有效数据；关键来源连续超限时 Actions 失败并阻止退化快照部署。
- [ ] **外部失败告警**：在 GitHub Actions 失败通知之外，可继续接入飞书 / 邮件 / Telegram。
- [x] **重试与退避**：Apify 轮询已加入有限次数重试；详情抓取失败保留原始数据。
- [x] **列表分页 / 懒加载**：列表默认分批展示并支持「加载更多」。
- [x] **前端增强**：关键词搜索、深色模式、详情页上一项/下一项已完成。
- [ ] **gh-pages 分支部署**：改用 `peaceiris/actions-gh-pages` 推独立 `gh-pages` 分支，主分支更干净。

---

## 补充说明

- `npm run sample` 会生成 schema v2 示例摘要和详情文件；首次真实采集后 `data/daily.json` 自动覆盖，页面「示例数据」角标消失。
- 采集字段均为**防御性映射**（`src/fetch/utils.ts`）；更换 Actor 后若个别字段为空，按实际输出补充候选键即可。
- 详情页信息由 `src/fetch/detailScraper.ts` 从来源网页抓取补充，个别站点（如 Product Hunt 网页）有反爬会 403，此时保留 Apify/API 原有数据。
