# DailyPulse — 剩余工作清单

> 本文件记录了项目尚未完成的收尾工作、已知问题与可选优化项，供后续逐步推进。
> 已实现并验证的部分见 `README.md`。

## 状态总览

- ✅ 已完成：项目骨架、四平台采集模块、存储与静态页生成、React 前端、GitHub Actions 定时任务、README、本地构建/类型检查验证。
- ⏳ 剩余工作：见下方清单。

---

## 一、必做（上线前）

- [ ] **配置 Apify API Key**
  - 本地：`cp .env.example .env`，填入 `APIFY_API_KEY=apify_api_...`。
  - 线上：仓库 **Settings → Secrets and variables → Actions** 添加 `APIFY_API_KEY`。
  - 未配置时 App Store / Google Play / Product Hunt 会被跳过（仅 Reddit 可用）。

- [ ] **初始化 git 仓库并推送到 GitHub**
  ```bash
  git init
  git add .
  git commit -m "feat: DailyPulse MVP"
  git branch -M main
  git remote add origin git@github.com:<用户名>/<仓库名>.git
  git push -u origin main
  ```
  - 注意：`data/daily.json` 与 `dist/` 需随代码一起提交（`.gitignore` 已放行），定时任务会回写它们。

- [ ] **添加 GitHub Secrets（可选覆盖项）**
  - `APIFY_APP_STORE_ACTOR_ID`、`APIFY_GOOGLE_PLAY_ACTOR_ID`、`APIFY_PRODUCT_HUNT_ACTOR_ID`
  - 不配置时自动回退到代码内置默认值。

- [x] **启用 GitHub Pages**
  - 已通过 `gh api .../pages -X POST -f build_type=workflow` 启用，由 `.github/workflows/deploy.yml` 自动部署 `dist/`。
  - 访问：`https://eeachen4.github.io/DailyPulse/`。

- [ ] **验证定时任务**
  - 到 **Actions** 页手动点 `Run workflow`（`workflow_dispatch`）触发一次，确认采集 → 构建 → 回写提交全链路正常。
  - 确认 cron 在 `UTC 0:00 = 北京时间 8:00` 生效。

---

## 二、已知问题与验证

- [ ] **Reddit 403（数据中心/云主机 IP）**
  - 现象：在云主机、GitHub Actions runner 等 IP 上，`www.reddit.com/r/all/top.json` 可能返回 403（Reddit 访问策略，非代码 bug）。
  - 已做：浏览器 UA + `www` / `old.reddit` 双主机回退（见 `src/fetch/reddit.ts`）。
  - 缓解建议（按需选择其一）：
    1. 本地家用网络手动跑 `npm run fetch`（通常可正常访问）；
    2. 在 GitHub Actions 里给 Reddit 加代理出口；
    3. 换用无需认证的第三方 Reddit JSON 镜像（需自行验证合规性与可用性）。

- [ ] **Apify 免费额度与并发限制**
  - 当前采集按**顺序**执行各源（`src/index.ts`），避免免费账号并发 run 受限。
  - 若频繁触发导致额度不足，日志会打印 `[source] ❌`，其余源不受影响。

- [ ] **cron 时区确认**
  - GitHub Actions 的 `schedule` 使用 **UTC**，`'0 0 * * *'` 即北京时间 8:00。
  - 首次使用可能延迟数分钟至数小时才触发，属 GitHub 正常行为。

---

## 三、可选优化

- [ ] **Product Hunt 官方 GraphQL API 兜底**
  - 现状：使用 Apify `glassventures~product-hunt-scraper`。
  - 备选：接入 `https://api.producthunt.com/v2/api/graphql`（需 Product Hunt Developer Token），在 Apify 失败时兜底。

- [ ] **gh-pages 分支部署**
  - 现状：已用 GitHub Actions（`deploy.yml`）把 `dist/` 部署为 Pages 产物。
  - 备选：改用 `peaceiris/actions-gh-pages` 把 `dist/` 推到独立 `gh-pages` 分支，主分支更干净。

- [ ] **每日数据历史归档**
  - 现状：`data/daily.json` 只保留当天数据（覆盖式写入）。
  - 备选：改为 `data/history/YYYY-MM-DD.json` 归档，页面可加「往期」切换。

- [ ] **采集失败告警**
  - 现状：失败仅打印日志。
  - 备选：接入飞书 / 邮件 / Telegram 通知，某源连续失败时提醒。

- [ ] **重试与退避**
  - 现状：Apify 轮询固定 10s 间隔、单次无重试。
  - 备选：对瞬时网络错误加指数退避重试（axios-retry 或手写）。

- [ ] **前端增强**
  - 深色模式、关键词搜索、分页/懒加载、卡片骨架屏、按平台 Tab 吸顶。

---

## 四、补充说明

- 当前 `data/daily.json` 为**内置示例数据**（`isSample: true`），首次成功采集后会被真实数据覆盖，页面上的「示例数据」角标自动消失。
- 所有采集源字段名均为**防御性映射**（`src/fetch/utils.ts`），若更换 Actor 后个别字段为空，按 Actor 实际输出补充候选键即可。
