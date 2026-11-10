import type { BrowserAdapter } from './browser-adapter';
import { BidiBrowserAdapter } from './bidi-browser-adapter';
import { CdpBrowserAdapter } from './cdp-browser-adapter';

/**
 * 按环境给出的调试地址选适配器：Firefox 环境是共用 BiDi 会话的地址（路径 /session），
 * Chromium 环境是 CDP 地址（/devtools/browser/...）。
 */
export function createBrowserAdapter(browserWsUrl: string): BrowserAdapter {
  let path = '';
  try {
    path = new URL(browserWsUrl).pathname;
  } catch {
    // 地址无效时交给 CDP 适配器连接，由它报错
  }
  return path === '/session' ? new BidiBrowserAdapter() : new CdpBrowserAdapter();
}
