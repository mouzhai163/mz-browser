/**
 * 指纹生成器
 * 动态生成真实的浏览器指纹设置
 */

import type { AdvancedFingerprintSettings, DeviceSettings, FingerprintMode, FontListConfig } from '../types';
import { pickDeviceSample, pickWindowsRelease, weightedChoice } from './device-samples';
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

// ==================== 设备数据 ====================

/** 设备名称前缀 */
const DEVICE_NAME_PREFIXES = ['DESKTOP', 'LAPTOP', 'PC', 'WORKSTATION', 'WIN'];

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

/** 生成随机 WebGL 配置（从设备样本库按权重抽一款显卡） */
export function generateWebGL(): { vendor: string; renderer: string } {
  const sample = pickDeviceSample(hostLogicalCores());
  return {
    vendor: sample.gpuVendor,
    renderer: sample.gpuRenderer,
  };
}

/** 一台整机的画像：显卡、核心数、内存、显示器、系统版本来自设备样本库里的同一条样本 */
export interface DeviceProfile {
  vendor: string;
  renderer: string;
  hardwareConcurrency: number;
  deviceMemory: number;
  resolution: { width: number; height: number };
  devicePixelRatio: number;
  /** Sec-CH-UA-Platform-Version，如 Windows 10 为 "10.0.0"，Windows 11 24H2 为 "19.0.0" */
  platformVersion: string;
}

/** 宿主机的逻辑核心数。声明的核心数不超过它，否则多线程跑分一测就露馅 */
function hostLogicalCores(): number {
  if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency > 0) {
    return navigator.hardwareConcurrency;
  }
  return 8;
}

/**
 * 从设备样本库按权重抽一台整机。显卡决定能配什么核心数、显示器（笔记本配笔记本屏），
 * 系统版本按 Windows 10 / 11 的大致占比抽。
 */
export function generateDeviceProfile(): DeviceProfile {
  const cap = hostLogicalCores();
  const sample = pickDeviceSample(cap);
  const coreChoices = sample.cores.filter((cores) => cores <= cap);
  const display = weightedChoice(sample.displays, (item) => item.weight);
  return {
    vendor: sample.gpuVendor,
    renderer: sample.gpuRenderer,
    hardwareConcurrency: randomChoice(coreChoices.length > 0 ? coreChoices : [Math.min(...sample.cores)]),
    deviceMemory: randomChoice(sample.memory),
    resolution: { width: display.width, height: display.height },
    devicePixelRatio: display.dpr,
    platformVersion: pickWindowsRelease().platformVersion,
  };
}

/** 生成随机指纹模式 */
function generateFingerprintMode(): FingerprintMode {
  return randomChoice<FingerprintMode>(['random', 'system']);
}

export function generateRandomMaxTouchPoints(): number {
  return 0;
}

/**
 * 生成随机指纹设置
 */
export function generateRandomFingerprintSettings(
  hardware: DeviceProfile = generateDeviceProfile(),
): AdvancedFingerprintSettings {
  return {
    resolution: hardware.resolution,
    colorDepth: 24,
    devicePixelRatio: hardware.devicePixelRatio,
    maxTouchPoints: generateRandomMaxTouchPoints(),
    fontFingerprint: generateFingerprintMode(),
    fontList: generateFontListConfig('random', 'Windows'),
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
  platformVersion: string;
} {
  // 两部分共用同一套设备画像，GPU / 核心数 / 内存 / 屏幕才会互相匹配
  const profile = generateDeviceProfile();
  return {
    fingerprintSettings: generateRandomFingerprintSettings(profile),
    deviceSettings: generateRandomDeviceSettings(profile),
    platformVersion: profile.platformVersion,
  };
}
