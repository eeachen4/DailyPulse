# DailyPulse — 剩余工作清单

> 本文件记录尚未完成的收尾工作、已知问题与可选优化项。
> 已实现并验证的部分见 `README.md`。

## 状态总览

已完成：项目骨架、四平台按类别采集（Product Hunt 走官方 GraphQL API）、来源网页详情抓取、详情页（完整描述 / 截图 / 相关推荐 / 展开收起）、静态页生成、React 前端、GitHub Actions 定时任务与 Pages 自动部署、本地构建与类型检查验证。

---

## 一、上线前待办

- [ ] **配置 Apify API Key（Secret）**
  - 本地：`cp .env.example .env`，填入 `APIFY_API_KEY`。
  - 线上：仓库 **Settings → Secrets and variables → Actions** 添加 `APIFY_API_KEY`。
  - 未配置时 App Store / Google Play 会被跳过（仅 Reddit 可用）。

- [ ] **配置 Product Hunt Token（Secret，可选）**
  - 本地 zsh 已有 `PRODUCT_HUNT_TOKEN`；线上在 Secrets 添加同名变量。
  - 未配置时 Product Hunt 回退 Apify。

- [ ] **验证定时任务**
  - 到 **Actions** 页手动 `Run workflow` 一次，确认「采集 → 详情抓取 → 构建 → 回写 → 部署」全链路正常。
  - 确认 cron 在 `UTC 0:00 = 北京时间 8:00` 生效。

---

## 二、已知问题

- [ ] **Reddit 403（数据中心 / 云主机 IP）**
  - 现象：云主机、GitHub Actions runner 上 `reddit.com/.../top.json` 可能 403（Reddit 策略，非代码 bug）。
  - 已做：浏览器 UA + `www`/`old.reddit` 双主机回退（`src/fetch/reddit.ts`）。
  - 缓解：本地家用网络跑 `npm run fetch`；或在 Actions 给 Reddit 加代理出口。

- [ ] **Apify 免费额度与并发限制**
  - 采集按顺序执行各源；额度不足时日志打印 `[source] ❌`，其余源不受影响。

- [ ] **cron 时区与首次触发延迟**
  - GitHub Actions `schedule` 用 UTC，`'0 0 * * *'` 即北京时间 8:00；首次触发可能延迟，属正常行为。

- [ ] **详情抓取耗时**
  - 440 条逐个抓取来源页约需数分钟；可用 `SCRAPE_DETAILS=false` 关闭、`SCRAPE_DETAILS_CONCURRENCY` 调并发、或后续加缓存。

---

## 三、可选优化

- [ ] **每日数据历史归档**：`data/daily.json` 仅保留当天，可改为 `data/history/YYYY-MM-DD.json` + 前端「往期」切换。
- [ ] **采集失败告警**：接入飞书 / 邮件 / Telegram，连续失败时提醒。
- [ ] **重试与退避**：Apify 轮询与 HTTP 请求加指数退避重试。
- [ ] **列表分页 / 懒加载**：440 条一次性渲染较长，可加分页或「加载更多」。
- [ ] **前端增强**：关键词搜索、深色模式、卡片骨架屏、详情页上一项/下一项。
- [ ] **gh-pages 分支部署**：改用 `peaceiris/actions-gh-pages` 推独立 `gh-pages` 分支，主分支更干净。

---

## 补充说明

- 当前 `data/daily.json` 为**内置示例数据**（`isSample: true`），首次真实采集后自动覆盖，页面「示例数据」角标消失。
- 采集字段均为**防御性映射**（`src/fetch/utils.ts`）；更换 Actor 后若个别字段为空，按实际输出补充候选键即可。
- 详情页信息由 `src/fetch/detailScraper.ts` 从来源网页抓取补充，个别站点（如 Product Hunt 网页）有反爬会 403，此时保留 Apify/API 原有数据。
