/**
 * User Agent 生成器
 * 基于真实浏览器版本数据动态生成标准的 User Agent 字符串
 *
 * 版本策略说明（AdsPower 方案）：
 * - 支持多个 Chromium 内核版本（120-144+）
 * - User-Agent 策略：保持主版本号与内核一致，只随机化次版本号（build.patch）
 * - 原因：避免版本伪装的复杂性，同时提供一定的指纹隔离
 * - 优势：不需要隐藏新版本 API，不会被检测到特性不匹配
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
 * Chrome 版本号生成规则
 * 根据主版本号返回对应的真实官方版本号
 */
function generateChromeVersion(major: number): { major: number; build: number; patch: number } {
  // 使用真实的 Chrome 官方发布版本号，而不是随机生成
  // 这样可以避免被 browserscan 检测到版本号不在官方列表中
  const officialVersions: Record<number, Array<{ build: number; patch: number }>> = {
    120: [
      { build: 6099, patch: 109 },
      { build: 6099, patch: 130 },
      { build: 6099, patch: 200 },
    ],
    121: [
      { build: 6167, patch: 85 },
      { build: 6167, patch: 139 },
      { build: 6167, patch: 184 },
    ],
    122: [
      { build: 6261, patch: 57 },
      { build: 6261, patch: 94 },
      { build: 6261, patch: 112 },
    ],
    123: [
      { build: 6312, patch: 58 },
      { build: 6312, patch: 105 },
      { build: 6312, patch: 122 },
    ],
    124: [
      { build: 6367, patch: 60 },
      { build: 6367, patch: 78 },
      { build: 6367, patch: 91 },
      { build: 6367, patch: 118 },
    ],
    125: [
      { build: 6422, patch: 60 },
      { build: 6422, patch: 76 },
      { build: 6422, patch: 112 },
    ],
    126: [
      { build: 6478, patch: 55 },
      { build: 6478, patch: 114 },
      { build: 6478, patch: 126 },
    ],
    127: [
      { build: 6533, patch: 57 },
      { build: 6533, patch: 88 },
      { build: 6533, patch: 99 },
    ],
    128: [
      { build: 6613, patch: 84 },
      { build: 6613, patch: 119 },
      { build: 6613, patch: 138 },
    ],
    129: [
      { build: 6668, patch: 58 },
      { build: 6668, patch: 89 },
      { build: 6668, patch: 100 },
    ],
    130: [
      { build: 6723, patch: 58 },
      { build: 6723, patch: 91 },
      { build: 6723, patch: 116 },
    ],
    131: [
      { build: 6778, patch: 69 },
      { build: 6778, patch: 108 },
      { build: 6778, patch: 139 },
    ],
    132: [
      { build: 6834, patch: 83 },
      { build: 6834, patch: 110 },
      { build: 6834, patch: 159 },
    ],
    133: [
      { build: 6890, patch: 56 },
      { build: 6890, patch: 68 },
      { build: 6890, patch: 99 },
    ],
    134: [
      { build: 6945, patch: 60 },
      { build: 6945, patch: 90 },
      { build: 6945, patch: 110 },
    ],
    135: [
      { build: 7000, patch: 58 },
      { build: 7000, patch: 88 },
      { build: 7000, patch: 107 },
    ],
    136: [
      { build: 7055, patch: 55 },
      { build: 7055, patch: 100 },
      { build: 7055, patch: 141 },
    ],
    137: [
      { build: 7110, patch: 54 },
      { build: 7110, patch: 89 },
      { build: 7110, patch: 113 },
    ],
    138: [
      { build: 7165, patch: 63 },
      { build: 7165, patch: 98 },
      { build: 7165, patch: 134 },
    ],
    139: [
      { build: 7220, patch: 56 },
      { build: 7220, patch: 93 },
      { build: 7220, patch: 127 },
    ],
    140: [
      { build: 7275, patch: 63 },
      { build: 7275, patch: 98 },
      { build: 7275, patch: 115 },
    ],
    141: [
      { build: 7330, patch: 58 },
      { build: 7330, patch: 91 },
      { build: 7330, patch: 116 },
    ],
    142: [
      { build: 7385, patch: 62 },
      { build: 7385, patch: 106 },
      { build: 7385, patch: 134 },
    ],
    143: [
      { build: 6351, patch: 62 },
      { build: 6351, patch: 93 },
      { build: 6351, patch: 112 },
    ],
    144: [
      { build: 6367, patch: 60 },
      { build: 6367, patch: 78 },
      { build: 6367, patch: 91 },
      { build: 6367, patch: 118 },
      { build: 6367, patch: 155 },
      { build: 6367, patch: 201 },
    ],
    145: [
      { build: 6422, patch: 56 },
      { build: 6422, patch: 92 },
      { build: 6422, patch: 133 },
    ],
  };

  const versions = officialVersions[major];
  if (versions && versions.length > 0) {
    // 随机选择一个官方版本
    const version = versions[Math.floor(Math.random() * versions.length)];
    return { major, build: version.build, patch: version.patch };
  }

  // 降级：如果没有找到对应的版本，使用默认值
  return { major, build: 6367, patch: 78 };
}

/**
 * Edge 版本号生成规则
 * Edge 版本号与 Chrome 主版本号一致，但 build 号不同
 */
function generateEdgeVersion(chromeMajor: number): { major: number; build: number; patch: number } {
  // Edge build 号规律：约为 Chrome major * 21 + 2000
  const baseBuild = chromeMajor * 21 + 2000;
  const build = baseBuild + randomInt(0, 50);
  const patch = randomInt(40, 130);

  return { major: chromeMajor, build, patch };
}

/**
 * Opera 版本号生成规则
 * Opera 主版本号 = Chrome 主版本号 - 14（大致规律）
 */
function generateOperaVersion(chromeMajor: number): {
  major: number;
  chromeMajor: number;
  build: number;
  patch: number;
} {
  const operaMajor = chromeMajor - 14;
  const baseBuild = 5000 + (chromeMajor - 120) * 100;
  const build = baseBuild + randomInt(0, 100);
  const patch = randomInt(60, 90);

  return { major: operaMajor, chromeMajor, build, patch };
}

/**
 * Firefox 真实版本数据 (2024-2025)
 * 格式: major.minor
 */
const FIREFOX_VERSIONS = [
  { major: 115, minor: 0 }, // ESR
  { major: 122, minor: 0 },
  { major: 123, minor: 0 },
  { major: 124, minor: 0 },
  { major: 125, minor: 0 },
  { major: 126, minor: 0 },
  { major: 127, minor: 0 },
  { major: 128, minor: 0 }, // ESR
  { major: 129, minor: 0 },
  { major: 130, minor: 0 },
  { major: 131, minor: 0 },
  { major: 132, minor: 0 },
  { major: 133, minor: 0 },
];

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

// 删除旧的 EDGE_VERSIONS 和 OPERA_VERSIONS 常量，改用动态生成

// ==================== 操作系统配置 ====================

/** Windows 版本配置 */
interface WindowsConfig {
  platform: string;
  architecture: 'Win64; x64' | 'WOW64';
}

const WINDOWS_CONFIGS: WindowsConfig[] = [
  // Windows 10/11 (现代 Chrome 144 只使用 NT 10.0)
  // Windows 11 也报告为 NT 10.0
  { platform: 'Windows NT 10.0', architecture: 'Win64; x64' },
  { platform: 'Windows NT 10.0', architecture: 'Win64; x64' },
  { platform: 'Windows NT 10.0', architecture: 'Win64; x64' },
  { platform: 'Windows NT 10.0', architecture: 'Win64; x64' },
  { platform: 'Windows NT 10.0', architecture: 'Win64; x64' },
  { platform: 'Windows NT 10.0', architecture: 'Win64; x64' },
  { platform: 'Windows NT 10.0', architecture: 'Win64; x64' },
  { platform: 'Windows NT 10.0', architecture: 'Win64; x64' },
  { platform: 'Windows NT 10.0', architecture: 'Win64; x64' },
  { platform: 'Windows NT 10.0', architecture: 'Win64; x64' },
];

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

/** Linux 发行版配置 */
const LINUX_CONFIGS = [
  'X11; Linux x86_64',
  'X11; Linux i686',
  'X11; Ubuntu; Linux x86_64',
  'X11; Fedora; Linux x86_64',
  'X11; Debian; Linux x86_64',
  'X11; CentOS; Linux x86_64',
  'X11; Arch Linux; Linux x86_64',
];

// ==================== 操作系统字符串生成 ====================

function getWindowsOSString(): string {
  const config = randomChoice(WINDOWS_CONFIGS);
  return `${config.platform}; ${config.architecture}`;
}

function getMacOSString(): string {
  const config = randomChoice(MACOS_CONFIGS);
  if (config.chip === 'Intel') {
    return `Macintosh; Intel Mac OS X ${config.version}`;
  }
  // Apple Silicon 使用不同的格式
  return `Macintosh; Intel Mac OS X ${config.version}`;
}

function getLinuxOSString(): string {
  return randomChoice(LINUX_CONFIGS);
}

function getOSString(system: string): string {
  switch (system) {
    case 'Windows':
      return getWindowsOSString();
    case 'macOS':
      return getMacOSString();
    case 'Linux':
      return getLinuxOSString();
    default:
      return getWindowsOSString();
  }
}

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

/**
 * 生成 Chrome User-Agent：版本号写成 `主版本.0.0.0`，完整版本只在 Client Hints 里出现。
 * @param system 操作系统
 * @param versionString 内核版本号（如 "159.0.8147.2"），只取主版本
 */
function generateChromeUA(system: string, versionString?: string): string {
  const parsed = versionString ? parseInt(versionString.split('.')[0], 10) : NaN;
  const major = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CHROME_MAJOR;
  const platform = CHROME_PLATFORM_TOKENS[system] ?? CHROME_PLATFORM_TOKENS.Windows;
  return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
}

/** 生成 Firefox User-Agent */
function generateFirefoxUA(system: string): string {
  const os = getOSString(system);
  const version = randomChoice(FIREFOX_VERSIONS);
  const versionStr = version.minor > 0 ? `${version.major}.${version.minor}` : `${version.major}.0`;
  return `Mozilla/5.0 (${os}; rv:${versionStr}) Gecko/20100101 Firefox/${versionStr}`;
}

/**
 * 生成 Edge User-Agent
 * @param system 操作系统
 * @param chromeVersionString 可选的 Chrome 完整版本号字符串
 */
function generateEdgeUA(system: string, chromeVersionString?: string): string {
  const os = getOSString(system);

  // 直接使用传入的完整 Chrome 版本号
  const chromeStr = chromeVersionString || '144.0.7559.118';

  // 从 Chrome 版本中提取主版本号用于生成 Edge 版本号
  const match = chromeStr.match(/^(\d+)\./);
  const chromeMajor = match ? parseInt(match[1], 10) : 144;

  const edgeVersion = generateEdgeVersion(chromeMajor);
  const edgeStr = `${edgeVersion.major}.0.${edgeVersion.build}.${edgeVersion.patch}`;

  return `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeStr} Safari/537.36 Edg/${edgeStr}`;
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

/**
 * 生成 Opera User-Agent
 * @param system 操作系统
 * @param chromeVersionString 可选的 Chrome 完整版本号字符串
 */
function generateOperaUA(system: string, chromeVersionString?: string): string {
  const os = getOSString(system);

  // 直接使用传入的完整 Chrome 版本号
  const chromeStr = chromeVersionString || '144.0.7559.118';

  // 从 Chrome 版本中提取主版本号用于生成 Opera 版本号
  const match = chromeStr.match(/^(\d+)\./);
  const chromeMajor = match ? parseInt(match[1], 10) : 144;

  const operaVersion = generateOperaVersion(chromeMajor);
  const operaStr = `${operaVersion.major}.0.${operaVersion.build}.${operaVersion.patch}`;

  return `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeStr} Safari/537.36 OPR/${operaStr}`;
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
  const os = getOSString(system);

  // 直接使用传入的完整 Chrome 版本号
  const chromeStr = chromeVersionString || '144.0.7559.118';

  // Vivaldi 版本范围 6.x - 7.x
  const vivaldiMajor = randomInt(6, 7);
  const vivaldiMinor = randomInt(0, 5);
  const vivaldiBuild = randomInt(3000, 3500);
  const vivaldiPatch = randomInt(0, 100);
  const vivaldiStr = `${vivaldiMajor}.${vivaldiMinor}.${vivaldiBuild}.${vivaldiPatch}`;

  // Vivaldi 也使用固定的 AppleWebKit/537.36 和 Safari/537.36
  return `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeStr} Safari/537.36 Vivaldi/${vivaldiStr}`;
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
      return generateFirefoxUA(system);
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
