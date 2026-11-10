/**
 * User Agent 生成器
 * 基于真实浏览器版本数据动态生成标准的 User Agent 字符串
 *
 * 版本策略：Chromium 系的 UA 主版本号与内核一致，其余三段固定为 0（UA 精简策略），
 * 完整版本只出现在 Client Hints 里。启动时后端还会按实际内核再校正一次。
 */

// ==================== 工具函数 ====================

/** 生成随机整数 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 从数组中随机选择一个元素 */
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ==================== 版本号生成规则 ====================

/**
 * Safari 真实版本数据 (2023-2025)
 * 格式: major.minor.patch
 */
const SAFARI_VERSIONS = [
  { major: 16, minor: 4, patch: 1, webkit: '605.1.15' },
  { major: 16, minor: 5, patch: 2, webkit: '605.1.15' },
  { major: 16, minor: 6, patch: 0, webkit: '605.1.15' },
  { major: 17, minor: 0, patch: 0, webkit: '605.1.15' },
  { major: 17, minor: 1, patch: 0, webkit: '605.1.15' },
  { major: 17, minor: 2, patch: 0, webkit: '605.1.15' },
  { major: 17, minor: 3, patch: 0, webkit: '605.1.15' },
  { major: 17, minor: 4, patch: 0, webkit: '605.1.15' },
  { major: 17, minor: 5, patch: 0, webkit: '605.1.15' },
  { major: 18, minor: 0, patch: 0, webkit: '605.1.15' },
  { major: 18, minor: 1, patch: 0, webkit: '605.1.15' },
];

// ==================== 操作系统配置 ====================

/** macOS 版本配置 (10.15 - 14.x) */
interface MacOSConfig {
  version: string;
  chip?: 'Intel' | 'M1' | 'M2' | 'M3';
}

const MACOS_CONFIGS: MacOSConfig[] = [
  // Catalina (10.15)
  { version: '10_15_7', chip: 'Intel' },
  // Big Sur (11.x)
  { version: '11_7_10', chip: 'Intel' },
  { version: '11_7_10', chip: 'M1' },
  // Monterey (12.x)
  { version: '12_7_4', chip: 'Intel' },
  { version: '12_7_4', chip: 'M1' },
  // Ventura (13.x)
  { version: '13_6_4', chip: 'Intel' },
  { version: '13_6_4', chip: 'M1' },
  { version: '13_6_4', chip: 'M2' },
  // Sonoma (14.x)
  { version: '14_4_1', chip: 'Intel' },
  { version: '14_4_1', chip: 'M1' },
  { version: '14_4_1', chip: 'M2' },
  { version: '14_4_1', chip: 'M3' },
  { version: '14_5', chip: 'M2' },
  { version: '14_5', chip: 'M3' },
  // Sequoia (15.x)
  { version: '15_0', chip: 'M2' },
  { version: '15_0', chip: 'M3' },
  { version: '15_1', chip: 'M3' },
];

// ==================== User Agent 生成函数 ====================

/** 没有选中内核时的兜底主版本号；真正启动时会按实际内核再校正一次 */
const DEFAULT_CHROME_MAJOR = 156;

/**
 * Chrome 现在发出的 UA 系统部分只有三种固定写法（UA 精简策略）：
 * Windows 恒为 NT 10.0（Windows 11 也是），macOS 恒为 10_15_7，Linux 恒为 x86_64。
 * 带具体系统版本或发行版名称的写法在真实 Chrome 里不存在。
 */
const CHROME_PLATFORM_TOKENS: Record<string, string> = {
  Windows: 'Windows NT 10.0; Win64; x64',
  macOS: 'Macintosh; Intel Mac OS X 10_15_7',
  Linux: 'X11; Linux x86_64',
};

/** 从内核版本号（如 "159.0.8147.2"）取主版本，取不到时用兜底值 */
function chromeMajorOf(versionString?: string): number {
  const parsed = versionString ? parseInt(versionString.split('.')[0], 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CHROME_MAJOR;
}

/**
 * 生成 Chrome User-Agent：版本号写成 `主版本.0.0.0`，完整版本只在 Client Hints 里出现。
 * @param system 操作系统
 * @param versionString 内核版本号，只取主版本
 */
function generateChromeUA(system: string, versionString?: string): string {
  const platform = CHROME_PLATFORM_TOKENS[system] ?? CHROME_PLATFORM_TOKENS.Windows;
  const major = chromeMajorOf(versionString);
  return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
}

/** 没有选中 Firefox 内核时的兜底主版本号；真正启动时会按实际内核再校正一次 */
const DEFAULT_FIREFOX_MAJOR = 158;

/** 真实 Firefox 的 UA 系统部分同样是固定写法（macOS 恒为 10.15） */
const FIREFOX_PLATFORM_TOKENS: Record<string, string> = {
  Windows: 'Windows NT 10.0; Win64; x64',
  macOS: 'Macintosh; Intel Mac OS X 10.15',
  Linux: 'X11; Linux x86_64',
};

/**
 * 生成 Firefox User-Agent：rv 和 Firefox 版本都写成 `主版本.0`，主版本取内核版本。
 * @param versionString Firefox 内核版本号（如 "158.0.1"）；不传时用兜底值
 */
function generateFirefoxUA(system: string, versionString?: string): string {
  const platform = FIREFOX_PLATFORM_TOKENS[system] ?? FIREFOX_PLATFORM_TOKENS.Windows;
  const parsed = versionString ? parseInt(versionString.split('.')[0], 10) : NaN;
  const major = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FIREFOX_MAJOR;
  return `Mozilla/5.0 (${platform}; rv:${major}.0) Gecko/20100101 Firefox/${major}.0`;
}

/** 生成 Edge User-Agent：Edge 和 Chrome 主版本相同，同样做了 UA 精简 */
function generateEdgeUA(system: string, chromeVersionString?: string): string {
  const major = chromeMajorOf(chromeVersionString);
  return `${generateChromeUA(system, chromeVersionString)} Edg/${major}.0.0.0`;
}

/** 生成 Safari User-Agent (仅 macOS) */
function generateSafariUA(): string {
  const config = randomChoice(MACOS_CONFIGS);
  const version = randomChoice(SAFARI_VERSIONS);
  const osStr = `Macintosh; Intel Mac OS X ${config.version}`;
  const versionStr =
    version.patch > 0
      ? `${version.major}.${version.minor}.${version.patch}`
      : `${version.major}.${version.minor}`;
  return `Mozilla/5.0 (${osStr}) AppleWebKit/${version.webkit} (KHTML, like Gecko) Version/${versionStr} Safari/${version.webkit}`;
}

/** 生成 Opera User-Agent：Opera 主版本 = Chrome 主版本 - 14（大致规律） */
function generateOperaUA(system: string, chromeVersionString?: string): string {
  const major = chromeMajorOf(chromeVersionString) - 14;
  return `${generateChromeUA(system, chromeVersionString)} OPR/${major}.0.0.0`;
}

/**
 * 生成 Brave User-Agent (基于 Chromium，与 Chrome 基本相同)
 * @param system 操作系统
 * @param versionString 可选的完整版本号字符串
 */
function generateBraveUA(system: string, versionString?: string): string {
  // Brave 的 UA 与 Chrome 完全相同，无法通过 UA 区分
  // 使用固定的 AppleWebKit/537.36 和 Safari/537.36
  return generateChromeUA(system, versionString);
}

/**
 * 生成 Vivaldi User-Agent
 * @param system 操作系统
 * @param chromeVersionString 可选的 Chrome 完整版本号字符串
 */
function generateVivaldiUA(system: string, chromeVersionString?: string): string {
  // Vivaldi 版本范围 6.x - 7.x
  const vivaldiStr = [randomInt(6, 7), randomInt(0, 5), randomInt(3000, 3500), randomInt(0, 100)].join('.');
  return `${generateChromeUA(system, chromeVersionString)} Vivaldi/${vivaldiStr}`;
}

// ==================== 导出 API ====================

/** 浏览器类型 */
export type BrowserType =
  | 'Chrome'
  | 'Firefox'
  | 'Edge'
  | 'Safari'
  | 'Opera'
  | 'Brave'
  | 'Vivaldi'
  | 'random';

/** 浏览器权重配置（用于随机选择，基于市场份额） */
const BROWSER_WEIGHTS: { browser: Exclude<BrowserType, 'random'>; weight: number }[] = [
  { browser: 'Chrome', weight: 65 },
  { browser: 'Edge', weight: 12 },
  { browser: 'Safari', weight: 8 },
  { browser: 'Firefox', weight: 6 },
  { browser: 'Opera', weight: 4 },
  { browser: 'Brave', weight: 3 },
  { browser: 'Vivaldi', weight: 2 },
];

/** 按权重随机选择浏览器 */
function selectBrowserByWeight(system: string): Exclude<BrowserType, 'random'> {
  // Safari 仅在 macOS 上可用
  const availableBrowsers =
    system === 'macOS' ? BROWSER_WEIGHTS : BROWSER_WEIGHTS.filter((b) => b.browser !== 'Safari');

  const totalWeight = availableBrowsers.reduce((sum, b) => sum + b.weight, 0);
  let random = Math.random() * totalWeight;

  for (const { browser, weight } of availableBrowsers) {
    random -= weight;
    if (random <= 0) {
      return browser;
    }
  }

  return 'Chrome';
}

/**
 * 生成 User Agent
 * @param system 操作系统：'Windows' | 'macOS' | 'Linux'
 * @param browser 浏览器类型：'Chrome' | 'Firefox' | 'Edge' | 'Safari' | 'Opera' | 'Brave' | 'Vivaldi' | 'random'
 * @param chromeVersionString 可选的 Chrome 完整版本号字符串（用于 Chromium 系浏览器），如 "144.0.7559.118"
 * @returns User Agent 字符串
 */
export function generateUserAgent(
  system: string,
  browser: BrowserType = 'random',
  chromeVersionString?: string
): string {
  const selectedBrowser = browser === 'random' ? selectBrowserByWeight(system) : browser;

  // Safari 仅支持 macOS
  if (selectedBrowser === 'Safari' && system !== 'macOS') {
    return generateChromeUA(system, chromeVersionString);
  }

  switch (selectedBrowser) {
    case 'Chrome':
      return generateChromeUA(system, chromeVersionString);
    case 'Firefox':
      // 随机挑中 Firefox 时传进来的是 Chrome 内核版本，不能拿来当 Firefox 版本
      return generateFirefoxUA(system, browser === 'Firefox' ? chromeVersionString : undefined);
    case 'Edge':
      return generateEdgeUA(system, chromeVersionString);
    case 'Safari':
      return generateSafariUA();
    case 'Opera':
      return generateOperaUA(system, chromeVersionString);
    case 'Brave':
      return generateBraveUA(system, chromeVersionString);
    case 'Vivaldi':
      return generateVivaldiUA(system, chromeVersionString);
    default:
      return generateChromeUA(system, chromeVersionString);
  }
}

/**
 * 根据内核类型生成 User Agent
 * @param system 操作系统
 * @param kernel 内核/浏览器类型
 * @param chromeVersionString 可选的 Chrome 完整版本号字符串，如 "144.0.7559.118"
 * @returns User Agent 字符串
 */
export function generateUserAgentByKernel(
  system: string,
  kernel: string,
  chromeVersionString?: string
): string {
  const browserMap: Record<string, BrowserType> = {
    Chrome: 'Chrome',
    Firefox: 'Firefox',
    Edge: 'Edge',
    Safari: 'Safari',
    Opera: 'Opera',
    Brave: 'Brave',
    Vivaldi: 'Vivaldi',
  };

  const browser = browserMap[kernel] || 'Chrome';
  return generateUserAgent(system, browser, chromeVersionString);
}

/**
 * 获取所有支持的浏览器类型
 * @param system 操作系统
 * @returns 支持的浏览器类型数组
 */
export function getSupportedBrowsers(system: string): Exclude<BrowserType, 'random'>[] {
  const browsers: Exclude<BrowserType, 'random'>[] = [
    'Chrome',
    'Firefox',
    'Edge',
    'Opera',
    'Brave',
    'Vivaldi',
  ];
  if (system === 'macOS') {
    browsers.push('Safari');
  }
  return browsers;
}

/**
 * 解析 User Agent 获取信息
 * @param userAgent User Agent 字符串
 * @returns 解析结果
 */
export function parseUserAgent(userAgent: string): {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
} {
  let browser = 'Unknown';
  let browserVersion = '';
  let os = 'Unknown';
  let osVersion = '';

  // 解析浏览器
  if (userAgent.includes('Edg/')) {
    browser = 'Edge';
    const match = userAgent.match(/Edg\/([\d.]+)/);
    browserVersion = match ? match[1] : '';
  } else if (userAgent.includes('OPR/')) {
    browser = 'Opera';
    const match = userAgent.match(/OPR\/([\d.]+)/);
    browserVersion = match ? match[1] : '';
  } else if (userAgent.includes('Vivaldi/')) {
    browser = 'Vivaldi';
    const match = userAgent.match(/Vivaldi\/([\d.]+)/);
    browserVersion = match ? match[1] : '';
  } else if (userAgent.includes('Firefox/')) {
    browser = 'Firefox';
    const match = userAgent.match(/Firefox\/([\d.]+)/);
    browserVersion = match ? match[1] : '';
  } else if (userAgent.includes('Version/') && userAgent.includes('Safari/')) {
    browser = 'Safari';
    const match = userAgent.match(/Version\/([\d.]+)/);
    browserVersion = match ? match[1] : '';
  } else if (userAgent.includes('Chrome/')) {
    browser = 'Chrome';
    const match = userAgent.match(/Chrome\/([\d.]+)/);
    browserVersion = match ? match[1] : '';
  }

  // 解析操作系统
  if (userAgent.includes('Windows NT')) {
    os = 'Windows';
    if (userAgent.includes('Windows NT 10.0')) {
      osVersion = '10/11';
    } else if (userAgent.includes('Windows NT 6.3')) {
      osVersion = '8.1';
    } else if (userAgent.includes('Windows NT 6.2')) {
      osVersion = '8';
    } else if (userAgent.includes('Windows NT 6.1')) {
      osVersion = '7';
    }
  } else if (userAgent.includes('Mac OS X')) {
    os = 'macOS';
    const match = userAgent.match(/Mac OS X ([\d_]+)/);
    if (match) {
      osVersion = match[1].replace(/_/g, '.');
    }
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
    if (userAgent.includes('Ubuntu')) {
      osVersion = 'Ubuntu';
    } else if (userAgent.includes('Fedora')) {
      osVersion = 'Fedora';
    } else if (userAgent.includes('Debian')) {
      osVersion = 'Debian';
    }
  }

  return { browser, browserVersion, os, osVersion };
}
