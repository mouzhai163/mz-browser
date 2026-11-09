/**
 * 设备样本库
 *
 * 一条样本 = 一台整机：显卡、CPU 逻辑核心数、内存、显示器、系统版本互相匹配，带权重。
 * 随机创建环境时按权重抽样，不再把显卡、核心数、分辨率各自随机拼起来。
 *
 * 数据来源：
 * - 显卡串和占比来自 Web3DSurvey 的真实上报（见 gpu-renderers.ts，含 PCI 设备号，已和 pci-ids 数据库核对过）。
 * - 核心数、内存、显示器按"笔记本/台式机 × 档位"推断，不是采样数据；Windows 10/11 比例也是估计值。
 * - 要加入真机采样：在真机 Chrome 里运行 scripts/collect-device-sample.js。
 */

import { GPU_RENDERERS, type GpuRenderer } from './gpu-renderers';

export interface DisplaySample {
  /** CSS 像素宽高（物理分辨率 ÷ 系统缩放） */
  width: number;
  height: number;
  /** 系统缩放比例，即 devicePixelRatio */
  dpr: number;
  /** 相对权重 */
  weight: number;
}

export interface DeviceSample {
  id: string;
  /** 抽样权重 */
  weight: number;
  gpuVendor: string;
  gpuRenderer: string;
  /** navigator.hardwareConcurrency 候选（整机的逻辑核心数） */
  cores: number[];
  /** navigator.deviceMemory 候选；Chrome 最大只报 8 */
  memory: number[];
  displays: DisplaySample[];
  /** 笔记本只会配笔记本屏，台式机才有大尺寸外接显示器 */
  formFactor: 'laptop' | 'desktop';
}

/** Windows 版本分布：platformVersion 是 Sec-CH-UA-Platform-Version 的值 */
export interface WindowsRelease {
  label: string;
  platformVersion: string;
  weight: number;
}

export const WINDOWS_RELEASES: WindowsRelease[] = [
  { label: 'Windows 10', platformVersion: '10.0.0', weight: 30 },
  { label: 'Windows 11 21H2', platformVersion: '13.0.0', weight: 4 },
  { label: 'Windows 11 22H2/23H2', platformVersion: '15.0.0', weight: 26 },
  { label: 'Windows 11 24H2', platformVersion: '19.0.0', weight: 40 },
];

/** 台式机显示器：24/27 寸 1080p 最多，其次 2K，少量 4K */
const DESKTOP_DISPLAYS: DisplaySample[] = [
  { width: 1920, height: 1080, dpr: 1, weight: 64 },
  { width: 2560, height: 1440, dpr: 1, weight: 24 },
  { width: 1920, height: 1080, dpr: 2, weight: 6 }, // 4K 屏 200% 缩放
  { width: 2560, height: 1440, dpr: 1.5, weight: 3 }, // 4K 屏 150% 缩放
  { width: 3440, height: 1440, dpr: 1, weight: 3 },
];

/** 高端台式机多 2K/4K、带鱼屏 */
const DESKTOP_HIGH_DISPLAYS: DisplaySample[] = [
  { width: 1920, height: 1080, dpr: 1, weight: 26 },
  { width: 2560, height: 1440, dpr: 1, weight: 40 },
  { width: 1920, height: 1080, dpr: 2, weight: 12 },
  { width: 2560, height: 1440, dpr: 1.5, weight: 8 },
  { width: 3440, height: 1440, dpr: 1, weight: 8 },
  { width: 3840, height: 2160, dpr: 1, weight: 6 },
];

/** 笔记本屏：1080p 配 125%/100% 缩放最常见，旧款是 1366x768 */
const LAPTOP_DISPLAYS: DisplaySample[] = [
  { width: 1536, height: 864, dpr: 1.25, weight: 38 }, // 1080p 屏 125%
  { width: 1920, height: 1080, dpr: 1, weight: 30 }, // 15.6 寸 1080p 100%
  { width: 1366, height: 768, dpr: 1, weight: 14 },
  { width: 1280, height: 720, dpr: 1.5, weight: 8 }, // 1080p 屏 150%
  { width: 1707, height: 1067, dpr: 1.5, weight: 6 }, // 2560x1600 屏 150%
  { width: 1536, height: 960, dpr: 1.25, weight: 4 }, // 1920x1200 屏 125%
];

/** 表单里可以手动选择的逻辑核心数 */
export const HARDWARE_CONCURRENCY_CHOICES = [2, 4, 6, 8, 12, 16, 20, 24];

/** 各档位 × 机型可选的逻辑核心数 */
const CORES: Record<GpuRenderer['tier'], Record<GpuRenderer['formFactor'], number[]>> = {
  low: { laptop: [4, 8], desktop: [4, 6, 8] },
  mid: { laptop: [8, 12, 16], desktop: [6, 8, 12, 16] },
  high: { laptop: [16, 20], desktop: [12, 16, 20, 24] },
};

function toSample(gpu: GpuRenderer, index: number): DeviceSample {
  const desktopDisplays =
    gpu.tier === 'high'
      ? DESKTOP_HIGH_DISPLAYS
      : gpu.tier === 'low'
        ? DESKTOP_DISPLAYS.filter((d) => d.width < 3000 && d.dpr <= 1.5)
        : DESKTOP_DISPLAYS;
  return {
    id: `gpu-${index}`,
    weight: gpu.weight,
    gpuVendor: gpu.vendor,
    gpuRenderer: gpu.renderer,
    cores: CORES[gpu.tier][gpu.formFactor],
    // 低端机常见 4GB；Chrome 的 deviceMemory 最多报 8
    memory: gpu.tier === 'low' ? [4, 8] : [8],
    displays: gpu.formFactor === 'laptop' ? LAPTOP_DISPLAYS : desktopDisplays,
    formFactor: gpu.formFactor,
  };
}

export const DEVICE_SAMPLES: DeviceSample[] = GPU_RENDERERS.map(toSample);

// ==================== 抽样 ====================

export function weightedChoice<T>(items: T[], weightOf: (item: T) => number): T {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= weightOf(item);
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

export function pickWindowsRelease(): WindowsRelease {
  return weightedChoice(WINDOWS_RELEASES, (release) => release.weight);
}

/** 按权重抽一台整机；宿主机核心数不够的样本不抽（声明的核心数超过真实核心数，多线程跑分一测就露馅） */
export function pickDeviceSample(hostCores: number): DeviceSample {
  const feasible = DEVICE_SAMPLES.filter((sample) => Math.min(...sample.cores) <= hostCores);
  const pool = feasible.length > 0 ? feasible : DEVICE_SAMPLES;
  return weightedChoice(pool, (sample) => sample.weight);
}
