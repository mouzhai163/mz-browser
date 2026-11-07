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
const DEVICE_MEMORY_OPTIONS = [4, 8, 16];

// ==================== 硬件配置组合 ====================

/** 硬件配置模板（确保 GPU、CPU、内存的合理组合） */
interface HardwareProfile {
  gpuVendor: string;
  gpuRenderer: string;
  cpuCores: number;
  memory: number;
  era: string; // 硬件年代
}

const HARDWARE_PROFILES: HardwareProfile[] = [
  // 入门级集成显卡配置（2020-2024）
  {
    gpuVendor: 'Google Inc. (Intel)',
    gpuRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    cpuCores: 4,
    memory: 8,
    era: 'modern-low',
  },
  {
    gpuVendor: 'Google Inc. (Intel)',
    gpuRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    cpuCores: 6,
    memory: 8,
    era: 'modern-low',
  },
  {
    gpuVendor: 'Google Inc. (Intel)',
    gpuRenderer: 'ANGLE (Intel, Intel(R) Iris Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
    cpuCores: 8,
    memory: 16,
    era: 'modern-mid',
  },
  {
    gpuVendor: 'Google Inc. (Intel)',
    gpuRenderer: 'ANGLE (Intel(R) UHD Graphics 770 Direct3D11 vs_5_0 ps_5_0, D3D11-31.0.101.5592)',
    cpuCores: 12,
    memory: 16,
    era: 'modern-mid',
  },

  // 中端独立显卡配置（2018-2022）
  {
    gpuVendor: 'Google Inc. (NVIDIA)',
    gpuRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)',
    cpuCores: 6,
    memory: 16,
    era: 'modern-mid',
  },
  {
    gpuVendor: 'Google Inc. (NVIDIA)',
    gpuRenderer: 'ANGLE (NVIDIA GeForce GTX 1070 Direct3D11 vs_5_0 ps_5_0, D3D11-30.0.15.1277)',
    cpuCores: 8,
    memory: 16,
    era: 'modern-mid',
  },
  {
    gpuVendor: 'Google Inc. (NVIDIA)',
    gpuRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    cpuCores: 8,
    memory: 16,
    era: 'modern-mid',
  },
  {
    gpuVendor: 'Google Inc. (AMD)',
    gpuRenderer: 'ANGLE (AMD, AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0, D3D11)',
    cpuCores: 6,
    memory: 8,
    era: 'modern-mid',
  },
  {
    gpuVendor: 'Google Inc. (AMD)',
    gpuRenderer: 'ANGLE (AMD Radeon RX 570 Series Direct3D11 vs_5_0 ps_5_0, D3D11-31.0.14057.5006)',
    cpuCores: 6,
    memory: 8,
    era: 'modern-mid',
  },

  // 高端独立显卡配置（2020-2024）
  {
    gpuVendor: 'Google Inc. (NVIDIA)',
    gpuRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    cpuCores: 8,
    memory: 16,
    era: 'modern-high',
  },
  {
    gpuVendor: 'Google Inc. (NVIDIA)',
    gpuRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    cpuCores: 12,
    memory: 16,
    era: 'modern-high',
  },
  {
    gpuVendor: 'Google Inc. (NVIDIA)',
    gpuRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    cpuCores: 16,
    memory: 32,
    era: 'modern-high',
  },
  {
    gpuVendor: 'Google Inc. (NVIDIA)',
    gpuRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    cpuCores: 12,
    memory: 16,
    era: 'modern-high',
  },
  {
    gpuVendor: 'Google Inc. (NVIDIA)',
    gpuRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    cpuCores: 16,
    memory: 32,
    era: 'modern-high',
  },
  {
    gpuVendor: 'Google Inc. (AMD)',
    gpuRenderer: 'ANGLE (AMD, AMD Radeon RX 5700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)',
    cpuCores: 8,
    memory: 16,
    era: 'modern-high',
  },
  {
    gpuVendor: 'Google Inc. (AMD)',
    gpuRenderer: 'ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0, D3D11)',
    cpuCores: 12,
    memory: 16,
    era: 'modern-high',
  },
  {
    gpuVendor: 'Google Inc. (AMD)',
    gpuRenderer: 'ANGLE (AMD, AMD Radeon RX 7900 XTX Direct3D11 vs_5_0 ps_5_0, D3D11)',
    cpuCores: 16,
    memory: 32,
    era: 'modern-high',
  },
  {
    gpuVendor: 'Google Inc. (AMD)',
    gpuRenderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
    cpuCores: 8,
    memory: 16,
    era: 'modern-mid',
  },
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

/** 生成与 GPU 匹配的 CPU 和内存配置 */
export function generateHardwareConfig(): {
  vendor: string;
  renderer: string;
  cpuCores: number;
  memory: number;
} {
  const profile = randomChoice(HARDWARE_PROFILES);
  return {
    vendor: profile.gpuVendor,
    renderer: profile.gpuRenderer,
    cpuCores: profile.cpuCores,
    memory: profile.memory,
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
export function generateRandomFingerprintSettings(): AdvancedFingerprintSettings {
  const hardware = generateHardwareConfig();

  return {
    resolution: generateScreenResolution(),
    colorDepth: generateRandomColorDepth(),
    devicePixelRatio: generateRandomDevicePixelRatio(),
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
export function generateRandomDeviceSettings(): Partial<DeviceSettings> {
  const hardware = generateHardwareConfig();

  return {
    deviceName: generateDeviceName(),
    deviceNameRandom: true,
    macAddress: generateMacAddress(),
    macAddressMode: 'custom',
    hardwareConcurrency: generateRandomHardwareConcurrency(),
    deviceMemory: generateRandomDeviceMemory(),
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
 * 每台标准 Windows 10/11 都自带的字体。
 * 随机字体列表必须始终包含它们：内核只会把列表内的系统字体暴露给网页，
 * 缺了 Arial、Microsoft YaHei 等，常见的 font-family 回退链会全部落空，页面排版和中文显示都会异常。
 */
const CORE_WINDOWS_FONTS = [
  'Arial',
  'Arial Black',
  'Calibri',
  'Cambria',
  'Cambria Math',
  'Comic Sans MS',
  'Consolas',
  'Courier New',
  'Georgia',
  'Impact',
  'Lucida Console',
  'Lucida Sans Unicode',
  'Malgun Gothic',
  'Microsoft JhengHei',
  'Microsoft Sans Serif',
  'Microsoft YaHei',
  'MS Gothic',
  'Palatino Linotype',
  'Segoe UI',
  'Segoe UI Emoji',
  'Segoe UI Symbol',
  'SimSun',
  'Symbol',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
  'Webdings',
  'Wingdings',
  'Yu Gothic',
];

/**
 * 生成随机字体列表：核心字体 + 从 CreepJS 检测列表中随机挑选的若干额外字体
 */
export function generateRandomFontList(): string[] {
  const core = new Set(CORE_WINDOWS_FONTS.map((font) => font.toLowerCase()));
  const extras = shuffleArray(
    CREEPJS_FONT_LIST.filter((font) => !core.has(font.toLowerCase())),
  ).slice(0, randomInt(5, 15));
  return [...CORE_WINDOWS_FONTS, ...extras];
}

/**
 * 生成字体列表配置
 * @param mode - 字体列表模式
 * @param system - 系统类型（保留参数以兼容现有代码，但不再使用）
 */
export function generateFontListConfig(mode: 'system' | 'random' | 'ua-match', system: string = 'Windows'): FontListConfig {
  if (mode === 'system') {
    return { mode: 'system', fonts: [] };
  }

  if (mode === 'random') {
    return { mode: 'random', fonts: generateRandomFontList() };
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
  return {
    fingerprintSettings: generateRandomFingerprintSettings(),
    deviceSettings: generateRandomDeviceSettings(),
  };
}
