/**
 * 指纹相关工具函数
 */

export type OSType = 'Windows' | 'macOS' | 'Linux' | 'Unknown';
export type BrowserType = 'Chrome' | 'Firefox' | 'Safari' | 'Edge' | 'Unknown';

export interface ParsedFingerprint {
  os: OSType;
  browser: BrowserType;
}

/**
 * 从指纹字符串解析操作系统和浏览器信息
 * @param fingerprint 指纹字符串（可能为 undefined 或空字符串）
 * @returns 解析后的操作系统和浏览器信息
 */
export function parseFingerprint(fingerprint?: string | null): ParsedFingerprint {
  // 处理 undefined 或空字符串
  if (!fingerprint || typeof fingerprint !== 'string') {
    return { os: 'Unknown', browser: 'Unknown' };
  }

  const fingerprintLower = fingerprint.toLowerCase();

  const os: OSType =
    fingerprintLower.includes('win') || fingerprintLower.includes('windows')
      ? 'Windows'
      : fingerprintLower.includes('macos') || fingerprintLower.includes('mac')
        ? 'macOS'
        : fingerprintLower.includes('linux')
          ? 'Linux'
          : 'Unknown';

  const browser: BrowserType = fingerprintLower.includes('chrome')
    ? 'Chrome'
    : fingerprintLower.includes('firefox')
      ? 'Firefox'
      : fingerprintLower.includes('safari')
        ? 'Safari'
        : fingerprintLower.includes('edge')
          ? 'Edge'
          : 'Unknown';

  return { os, browser };
}

/**
 * 获取操作系统对应的颜色类名
 */
export function getOSColorClass(os: OSType): string {
  switch (os) {
    case 'Windows':
      return 'text-blue-500';
    case 'macOS':
      return 'text-foreground';
    case 'Linux':
      return 'text-orange-500';
    default:
      return 'text-muted-foreground';
  }
}

/**
 * 获取浏览器对应的颜色类名
 */
export function getBrowserColorClass(browser: BrowserType): string {
  switch (browser) {
    case 'Chrome':
      return 'text-blue-500';
    case 'Firefox':
      return 'text-orange-500';
    case 'Safari':
      return 'text-blue-400';
    case 'Edge':
      return 'text-blue-600';
    default:
      return 'text-muted-foreground';
  }
}
