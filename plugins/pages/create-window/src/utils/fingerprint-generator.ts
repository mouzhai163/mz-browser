/**
 * 指纹生成器
 * 动态生成真实的浏览器指纹设置
 */

import type { AdvancedFingerprintSettings, DeviceSettings, FingerprintMode, FontListConfig } from '../types';
import { CREEPJS_FONT_LIST } from './creepjs-font-list';

// ==================== 工具函数 ====================

/** 生成随机整数 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 从数组中随机选择一个元素 */
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 生成随机十六进制字符 */
function randomHex(length: number): string {
  const chars = '0123456789ABCDEF';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// ==================== WebGL 数据 ====================

/** WebGL 供应商列表 */
const WEBGL_VENDORS = [
  'Google Inc. (Intel)',
  'Google Inc. (NVIDIA)',
  'Google Inc. (AMD)',
  'Google Inc. (Apple)',
  'Intel Inc.',
  'NVIDIA Corporation',
  'ATI Technologies Inc.',
  'Apple Inc.',
];

/** WebGL 渲染器模板 */
interface WebGLRendererTemplate {
  vendor: string;
  renderers: string[];
}

const WEBGL_RENDERERS: WebGLRendererTemplate[] = [
  {
    vendor: 'Google Inc. (Intel)',
    renderers: [
      'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (Intel, Intel(R) Iris Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (Intel, Intel(R) HD Graphics 4000 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (Intel, Intel(R) HD Graphics 530 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (Intel, Intel(R) HD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (Intel(R) UHD Graphics 770 Direct3D11 vs_5_0 ps_5_0, D3D11-31.0.101.5592)',
    ],
  },
  {
    vendor: 'Google Inc. (NVIDIA)',
    renderers: [
      'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (NVIDIA GeForce GTX 1070 Direct3D11 vs_5_0 ps_5_0, D3D11-30.0.15.1277)',
    ],
  },
  {
    vendor: 'Google Inc. (AMD)',
    renderers: [
      'ANGLE (AMD, AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (AMD, AMD Radeon RX 5700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (AMD, AMD Radeon RX 7900 XTX Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (AMD Radeon RX 570 Series Direct3D11 vs_5_0 ps_5_0, D3D11-31.0.14057.5006)',
    ],
  },
  {
    vendor: 'Google Inc. (Apple)',
    renderers: [
      'ANGLE (Apple, Apple M1, OpenGL 4.1)',
      'ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)',
      'ANGLE (Apple, Apple M1 Max, OpenGL 4.1)',
      'ANGLE (Apple, Apple M2, OpenGL 4.1)',
      'ANGLE (Apple, Apple M2 Pro, OpenGL 4.1)',
      'ANGLE (Apple, Apple M3, OpenGL 4.1)',
      'ANGLE (Apple, Apple M3 Pro, OpenGL 4.1)',
    ],
  },
  {
    vendor: 'Intel Inc.',
    renderers: [
      'Intel Iris OpenGL Engine',
      'Intel Iris Pro OpenGL Engine',
      'Intel Iris Plus Graphics OpenGL Engine',
      'Intel HD Graphics 4000 OpenGL Engine',
      'Intel UHD Graphics 630 OpenGL Engine',
    ],
  },
  {
    vendor: 'NVIDIA Corporation',
    renderers: [
      'NVIDIA GeForce GTX 1080/PCIe/SSE2',
      'NVIDIA GeForce RTX 3060/PCIe/SSE2',
      'NVIDIA GeForce RTX 3070/PCIe/SSE2',
      'NVIDIA GeForce RTX 4070/PCIe/SSE2',
    ],
  },
  {
    vendor: 'ATI Technologies Inc.',
    renderers: [
      'AMD Radeon Pro 5500M OpenGL Engine',
      'AMD Radeon Pro 580 OpenGL Engine',
      'AMD Radeon RX 580 OpenGL Engine',
    ],
  },
  {
    vendor: 'Apple Inc.',
    renderers: ['Apple M1', 'Apple M1 Pro', 'Apple M2', 'Apple M3'],
  },
];

// ==================== 设备数据 ====================

/** 设备名称前缀 */
const DEVICE_NAME_PREFIXES = ['DESKTOP', 'LAPTOP', 'PC', 'WORKSTATION', 'WIN'];

/** 常见 CPU 核心数（与 UI 保持一致）*/
const HARDWARE_CONCURRENCY_OPTIONS = [2, 4, 8, 16];

/** 常见内存大小 (GB)（与 UI 保持一致）*/
const DEVICE_MEMORY_OPTIONS = [4, 8];

// ==================== 硬件配置组合 ====================

/**
 * 显示器配置。screen.width/height 是 CSS 像素（物理分辨率 ÷ 系统缩放），devicePixelRatio 就是缩放比例，
 * 所以 3840x2160 的 4K 显示器在 200% 缩放下报告 1920x1080 @ 2。只列真实存在的组合；
 * 像素比只用界面支持的 1 / 1.5 / 2。
 */
interface DisplayProfile {
  width: number;
  height: number;
  dpr: 1 | 1.5 | 2;
}

type HardwareTier = 'low' | 'mid' | 'high';

/** 各档位可用的显示器：低端配低分辨率，高端才会有 2K/4K 和高缩放 */
const TIER_DISPLAYS: Record<HardwareTier, DisplayProfile[]> = {
  low: [
    { width: 1366, height: 768, dpr: 1 },
    { width: 1600, height: 900, dpr: 1 },
    { width: 1920, height: 1080, dpr: 1 },
  ],
  mid: [
    { width: 1920, height: 1080, dpr: 1 },
    { width: 1920, height: 1200, dpr: 1 },
    { width: 2560, height: 1440, dpr: 1 },
  ],
  high: [
    { width: 1920, height: 1080, dpr: 1 },
    { width: 2560, height: 1440, dpr: 1 },
    { width: 3440, height: 1440, dpr: 1 },
    { width: 3840, height: 2160, dpr: 1 },
    { width: 2560, height: 1440, dpr: 1.5 }, // 4K 屏 150% 缩放
    { width: 1920, height: 1080, dpr: 2 }, // 4K 屏 200% 缩放
  ],
};

/**
 * 各档位的 CPU 逻辑核心数与内存（GB）。
 * navigator.deviceMemory 真实 Chrome 最大只报 8，所以内存最多填 8；
 * 核心数只用界面支持的 2 / 4 / 8 / 16。
 */
const TIER_CORES: Record<HardwareTier, number[]> = {
  low: [4, 8],
  mid: [8],
  high: [8, 16],
};
const TIER_MEMORY: Record<HardwareTier, number[]> = {
  low: [4, 8],
  mid: [8],
  high: [8],
};

/** 硬件配置模板：GPU 决定档位，档位决定核心数 / 内存 / 显示器 */
interface HardwareProfile {
  gpuVendor: string;
  gpuRenderer: string;
  tier: HardwareTier;
}

const HARDWARE_PROFILES: HardwareProfile[] = [
  // 低端：集成显卡
  { gpuVendor: 'Google Inc. (Intel)', gpuRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)', tier: 'low' },
  { gpuVendor: 'Google Inc. (Intel)', gpuRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)', tier: 'low' },
  { gpuVendor: 'Google Inc. (Intel)', gpuRenderer: 'ANGLE (Intel, Intel(R) HD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)', tier: 'low' },
  // 中端：新集成显卡 / 入门到中端独立显卡
  { gpuVendor: 'Google Inc. (Intel)', gpuRenderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)', tier: 'mid' },
  { gpuVendor: 'Google Inc. (AMD)', gpuRenderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)', tier: 'mid' },
  { gpuVendor: 'Google Inc. (AMD)', gpuRenderer: 'ANGLE (AMD, AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0, D3D11)', tier: 'mid' },
  { gpuVendor: 'Google Inc. (NVIDIA)', gpuRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)', tier: 'mid' },
  { gpuVendor: 'Google Inc. (NVIDIA)', gpuRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1070 Direct3D11 vs_5_0 ps_5_0, D3D11)', tier: 'mid' },
  { gpuVendor: 'Google Inc. (NVIDIA)', gpuRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)', tier: 'mid' },
  // 高端独立显卡
  { gpuVendor: 'Google Inc. (NVIDIA)', gpuRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)', tier: 'high' },
  { gpuVendor: 'Google Inc. (NVIDIA)', gpuRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)', tier: 'high' },
  { gpuVendor: 'Google Inc. (NVIDIA)', gpuRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)', tier: 'high' },
  { gpuVendor: 'Google Inc. (NVIDIA)', gpuRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)', tier: 'high' },
  { gpuVendor: 'Google Inc. (AMD)', gpuRenderer: 'ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0, D3D11)', tier: 'high' },
  { gpuVendor: 'Google Inc. (AMD)', gpuRenderer: 'ANGLE (AMD, AMD Radeon RX 7900 XTX Direct3D11 vs_5_0 ps_5_0, D3D11)', tier: 'high' },
];

/** 常见屏幕分辨率 */
const SCREEN_RESOLUTIONS = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1600, height: 900 },
  { width: 1680, height: 1050 },
  { width: 1920, height: 1080 },
  { width: 1920, height: 1200 },
  { width: 2560, height: 1440 },
  { width: 2560, height: 1600 },
  { width: 3440, height: 1440 },
  { width: 3840, height: 2160 },
];

/** 像素密度选项（与 UI 保持一致）*/
const DEVICE_PIXEL_RATIO_OPTIONS = [1, 1.5, 2];

/** 颜色深度选项 */
const COLOR_DEPTH_OPTIONS: (24 | 32)[] = [24, 32];


// ==================== 生成函数 ====================

/** 生成随机 MAC 地址 */
export function generateMacAddress(): string {
  const parts: string[] = [];
  for (let i = 0; i < 6; i++) {
    parts.push(randomHex(2));
  }
  return parts.join('-');
}

/** 生成随机设备名称 */
export function generateDeviceName(): string {
  const prefix = randomChoice(DEVICE_NAME_PREFIXES);
  const suffix = randomHex(8);
  return `${prefix}-${suffix}`;
}

/** 生成随机 WebGL 配置 */
export function generateWebGL(): { vendor: string; renderer: string } {
  // 从硬件配置模板中随机选择一个
  const profile = randomChoice(HARDWARE_PROFILES);
  return {
    vendor: profile.gpuVendor,
    renderer: profile.gpuRenderer,
  };
}

/** 一套自洽的设备画像：GPU、核心数、内存、屏幕分辨率和缩放比例互相匹配 */
export interface DeviceProfile {
  vendor: string;
  renderer: string;
  hardwareConcurrency: number;
  deviceMemory: number;
  resolution: { width: number; height: number };
  devicePixelRatio: number;
}

/** 宿主机的逻辑核心数。声明的核心数不超过它，否则多线程跑分一测就露馅 */
function hostLogicalCores(): number {
  if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency > 0) {
    return navigator.hardwareConcurrency;
  }
  return 8;
}

/**
 * 生成一套自洽的设备画像。GPU 决定档位，档位再决定核心数、内存和显示器，
 * 避免出现"4 核 + 旗舰显卡"、"低端核显 + 4K"、"内存 16G"（Chrome 最大只报 8）这类矛盾组合。
 */
export function generateDeviceProfile(): DeviceProfile {
  const gpu = randomChoice(HARDWARE_PROFILES);
  const cap = hostLogicalCores();
  const coreChoices = TIER_CORES[gpu.tier].filter((cores) => cores <= cap);
  const display = randomChoice(TIER_DISPLAYS[gpu.tier]);
  return {
    vendor: gpu.gpuVendor,
    renderer: gpu.gpuRenderer,
    hardwareConcurrency: randomChoice(
      coreChoices.length > 0 ? coreChoices : [Math.min(...TIER_CORES[gpu.tier])],
    ),
    deviceMemory: randomChoice(TIER_MEMORY[gpu.tier]),
    resolution: { width: display.width, height: display.height },
    devicePixelRatio: display.dpr,
  };
}

/** 生成随机指纹模式 */
function generateFingerprintMode(): FingerprintMode {
  return randomChoice<FingerprintMode>(['random', 'system']);
}

/** 生成随机颜色深度 */
export function generateRandomColorDepth(): 24 | 32 {
  return randomChoice(COLOR_DEPTH_OPTIONS);
}

/** 生成随机像素比 */
export function generateRandomDevicePixelRatio(): number {
  return randomChoice(DEVICE_PIXEL_RATIO_OPTIONS);
}

/**
 * 最大触摸点。
 * 桌面 Windows 环境固定为 0：UA/UA-CH 声明为桌面、媒体查询是 pointer: fine，
 * 随机出 5/10 会得到"带触摸屏的桌面"这种少见组合，反而更容易被识别。
 */
export function generateRandomMaxTouchPoints(): number {
  return 0;
}

/** 生成随机硬件并发数 */
export function generateRandomHardwareConcurrency(): number {
  return randomChoice(HARDWARE_CONCURRENCY_OPTIONS);
}

/** 生成随机设备内存 */
export function generateRandomDeviceMemory(): number {
  return randomChoice(DEVICE_MEMORY_OPTIONS);
}

/**
 * 生成随机指纹设置
 */
export function generateRandomFingerprintSettings(
  hardware: DeviceProfile = generateDeviceProfile(),
): AdvancedFingerprintSettings {
  return {
    resolution: hardware.resolution,
    colorDepth: generateRandomColorDepth(),
    devicePixelRatio: hardware.devicePixelRatio,
    maxTouchPoints: generateRandomMaxTouchPoints(),
    fontFingerprint: generateFingerprintMode(),
    fontList: generateFontListConfig('random', 'Windows'),
    // 内核尚未实现 'replace'（选了等于没有防护），所以只生成 'disable'
    webrtc: 'disable',
    webglImage: generateFingerprintMode(),
    webglInfo: generateFingerprintMode(),
    webglVendor: hardware.vendor,
    webglRenderer: hardware.renderer,
    webgpu: randomChoice<'webgl-match' | 'real' | 'disable'>(['webgl-match', 'disable']),
    canvas: generateFingerprintMode(),
    audioContext: generateFingerprintMode(),
    speechVoices: generateFingerprintMode(),
    doNotTrack: randomChoice([true, false]),
    clientRects: generateFingerprintMode(),
    mediaDevices: generateFingerprintMode(),
  };
}

/**
 * 生成随机设备设置
 */
export function generateRandomDeviceSettings(
  hardware: DeviceProfile = generateDeviceProfile(),
): Partial<DeviceSettings> {
  return {
    deviceName: generateDeviceName(),
    deviceNameRandom: true,
    macAddress: generateMacAddress(),
    macAddressMode: 'custom',
    hardwareConcurrency: hardware.hardwareConcurrency,
    deviceMemory: hardware.deviceMemory,
  };
}

/**
 * 获取随机屏幕分辨率
 */
export function generateScreenResolution(): { width: number; height: number } {
  return randomChoice(SCREEN_RESOLUTIONS);
}

// ==================== 字体列表数据 ====================

/**
 * 使用 CreepJS 的字体检测列表
 * 这样我们可以精确控制 CreepJS 检测到的字体
 */

/** 打乱数组 */
function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 每台标准 Windows 10/11 都自带的字体（微软官方"Windows 10 字体列表"）。
 * 内核只会把列表内的系统字体暴露给网页，所以必须是完整的默认集：缺了 Arial，
 * 常见的 font-family 回退链会全部落空；缺了 Candara、Corbel、Nirmala UI 等每台 Win10 都有的字体，
 * "只能检测到一半系统字体"本身就是特征。宿主机没有的字体仍然不会出现，列表只负责"允许暴露"。
 *
 * 不包含中文字体（微软雅黑、宋体、黑体、楷体、仿宋、微软正黑体、新细明体等）：按要求不向网页暴露。
 * 中文文字不会因此变成方块：网页在中文字体被拒绝后，会按字符回退到系统里能显示该字符的字体。
 */
const DEFAULT_WINDOWS_FONTS = [
  'Arial',
  'Arial Black',
  'Bahnschrift',
  'Calibri',
  'Cambria',
  'Cambria Math',
  'Candara',
  'Comic Sans MS',
  'Consolas',
  'Constantia',
  'Corbel',
  'Courier New',
  'Ebrima',
  'Franklin Gothic Medium',
  'Gabriola',
  'Gadugi',
  'Georgia',
  'HoloLens MDL2 Assets',
  'Impact',
  'Ink Free',
  'Javanese Text',
  'Leelawadee UI',
  'Lucida Console',
  'Lucida Sans Unicode',
  'Malgun Gothic',
  'Marlett',
  'Microsoft Himalaya',
  'Microsoft New Tai Lue',
  'Microsoft PhagsPa',
  'Microsoft Sans Serif',
  'Microsoft Tai Le',
  'Microsoft Yi Baiti',
  'Mongolian Baiti',
  'MS Gothic',
  'MV Boli',
  'Myanmar Text',
  'Nirmala UI',
  'Palatino Linotype',
  'Segoe MDL2 Assets',
  'Segoe Print',
  'Segoe Script',
  'Segoe UI',
  'Segoe UI Emoji',
  'Segoe UI Historic',
  'Segoe UI Symbol',
  'Sitka Text',
  'Sylfaen',
  'Symbol',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
  'Webdings',
  'Wingdings',
  'Yu Gothic',
];

/** 装了 Office 之后常见的额外字体：随机带上其中几个，让不同环境的字体集合略有差异 */
const OFFICE_EXTRA_FONTS = [
  'Century Gothic',
  'Rockwell',
  'Gill Sans MT',
  'Bookman Old Style',
  'Garamond',
  'Tw Cen MT',
  'Book Antiqua',
  'Franklin Gothic Book',
  'Lucida Bright',
  'Perpetua',
];

/**
 * 简体中文版 Windows 10/11 自带的中文字体（固定整组，不随机：缺一半本身就是特征）。
 * 同时放英文名和中文名，因为网页探测时两种写法都常见。
 */
export const CHINESE_WINDOWS_FONTS = [
  'Microsoft YaHei',
  'Microsoft YaHei UI',
  '微软雅黑',
  'SimSun',
  '宋体',
  'NSimSun',
  '新宋体',
  'SimHei',
  '黑体',
  'KaiTi',
  '楷体',
  'FangSong',
  '仿宋',
  'DengXian',
  '等线',
  'Microsoft JhengHei',
  'Microsoft JhengHei UI',
  '微软正黑体',
  'MingLiU',
  'PMingLiU',
  'DFKai-SB',
];

/**
 * 生成随机字体列表：完整的 Windows 默认字体 + 随机几个 Office 常见字体；
 * includeChinese 为真时再整组加入中文 Windows 字体，其余部分的生成规则不变。
 */
export function generateRandomFontList(includeChinese = false): string[] {
  const extras = shuffleArray(OFFICE_EXTRA_FONTS).slice(0, randomInt(0, 5));
  const base = [...DEFAULT_WINDOWS_FONTS, ...(includeChinese ? CHINESE_WINDOWS_FONTS : []), ...extras];
  return base;
}

/**
 * 生成字体列表配置
 * @param mode - 字体列表模式
 * @param system - 系统类型（保留参数以兼容现有代码，但不再使用）
 */
export function generateFontListConfig(
  mode: 'system' | 'random' | 'ua-match',
  system: string = 'Windows',
  includeChinese = false,
): FontListConfig {
  if (mode === 'system') {
    return { mode: 'system', fonts: [] };
  }

  if (mode === 'random') {
    return { mode: 'random', fonts: generateRandomFontList(includeChinese), includeChinese };
  }

  // ua-match 模式：返回完整的 CreepJS 检测列表
  // 这样可以让所有 CreepJS 检测的字体都"存在"
  if (mode === 'ua-match') {
    return { mode: 'ua-match', fonts: [...CREEPJS_FONT_LIST] };
  }

  return { mode: 'system', fonts: [] };
}

/**
 * 获取系统屏幕分辨率
 */
export function getSystemScreenResolution(): { width: number; height: number } {
  return {
    width: window.screen.width,
    height: window.screen.height,
  };
}

/**
 * 一键随机所有指纹相关设置
 * @returns 包含指纹设置和设备设置的对象
 */
export function generateAllFingerprintSettings(): {
  fingerprintSettings: AdvancedFingerprintSettings;
  deviceSettings: Partial<DeviceSettings>;
} {
  // 两部分共用同一套设备画像，GPU / 核心数 / 内存 / 屏幕才会互相匹配
  const profile = generateDeviceProfile();
  return {
    fingerprintSettings: generateRandomFingerprintSettings(profile),
    deviceSettings: generateRandomDeviceSettings(profile),
  };
}
