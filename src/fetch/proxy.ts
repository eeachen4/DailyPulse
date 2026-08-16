import type { AxiosProxyConfig } from 'axios';

/**
 * 从 REDDIT_PROXY 环境变量解析 HTTP 代理配置。
 * 仅 Reddit 请求使用（数据中心 IP 访问 reddit.com 会被 403）。
 * 格式：http://username:password@host:port
 */
export function redditProxy(): AxiosProxyConfig | undefined {
  const url = process.env.REDDIT_PROXY;
  if (!url) return undefined;
  try {
    const u = new URL(url);
    const cfg: AxiosProxyConfig = {
      protocol: u.protocol.replace(':', ''),
      host: u.hostname,
      port: u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80,
    };
    if (u.username) {
      cfg.auth = { username: decodeURIComponent(u.username), password: decodeURIComponent(u.password) };
    }
    return cfg;
  } catch {
    console.warn(`[proxy] REDDIT_PROXY 解析失败，将直连：${url}`);
    return undefined;
  }
}
