import type { RpaSpeed } from '../types';

/**
 * 拟人输入：鼠标轨迹、点击落点、打字节奏、滚轮分段。全是纯函数（随机数由参数传入），方便测试。
 */

export type Random = () => number;

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpeedProfile {
  /** 鼠标每像素耗时（毫秒） */
  msPerPixel: number;
  minMoveMs: number;
  maxMoveMs: number;
  /** 两次按键之间的平均间隔 */
  keyDelayMs: number;
  /** 动作前后的停顿 */
  pauseMs: [number, number];
}

const PROFILES: Record<RpaSpeed, SpeedProfile> = {
  fast: { msPerPixel: 0.35, minMoveMs: 60, maxMoveMs: 280, keyDelayMs: 28, pauseMs: [20, 80] },
  normal: { msPerPixel: 0.8, minMoveMs: 140, maxMoveMs: 700, keyDelayMs: 90, pauseMs: [80, 260] },
  slow: { msPerPixel: 1.5, minMoveMs: 260, maxMoveMs: 1300, keyDelayMs: 190, pauseMs: [220, 620] },
};

export function speedProfile(speed: RpaSpeed): SpeedProfile {
  return PROFILES[speed] ?? PROFILES.normal;
}

const between = (random: Random, min: number, max: number) => min + (max - min) * random();

/** 动作之间的随机停顿 */
export function pauseDuration(profile: SpeedProfile, random: Random = Math.random): number {
  return Math.round(between(random, profile.pauseMs[0], profile.pauseMs[1]));
}

/** 鼠标按下到松开的时长 */
export function pressDuration(random: Random = Math.random): number {
  return Math.round(between(random, 45, 130));
}

/** 元素内的点击落点：偏向中心，避开边缘 */
export function pointInBox(box: Box, random: Random = Math.random): Point {
  const near = () => (random() + random() + random()) / 3; // 近似正态，集中在 0.5
  const margin = (size: number) => Math.min(size * 0.2, 8);
  const span = (size: number) => Math.max(size - 2 * margin(size), 0);
  return {
    x: box.x + margin(box.width) + span(box.width) * near(),
    y: box.y + margin(box.height) + span(box.height) * near(),
  };
}

export interface MousePathPoint extends Point {
  /** 到这个点之前等待的毫秒数 */
  delayMs: number;
}

/**
 * 从 from 到 to 的鼠标轨迹：三次贝塞尔曲线，控制点偏离直线，先加速后减速，带轻微抖动，最后准确落在 to。
 */
export function mousePath(
  from: Point,
  to: Point,
  profile: SpeedProfile,
  random: Random = Math.random,
  bounds?: { width: number; height: number }
): MousePathPoint[] {
  // 弧线可能冲出视口，Firefox 会直接拒绝视口外的移动
  const clamp = (value: number, size?: number) => (size === undefined ? value : Math.min(Math.max(value, 0), size - 1));
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) {
    return [{ x: to.x, y: to.y, delayMs: 0 }];
  }

  const totalMs = Math.min(
    Math.max(distance * profile.msPerPixel * between(random, 0.8, 1.25), profile.minMoveMs),
    profile.maxMoveMs
  );
  const count = Math.min(Math.max(Math.round(totalMs / 16), 6), 60);

  // 控制点沿法线方向偏移，弧度随距离增大但有上限
  const nx = -dy / distance;
  const ny = dx / distance;
  const bend = () => between(random, -1, 1) * Math.min(distance * 0.25, 90);
  const c1 = { x: from.x + dx * 0.3 + nx * bend(), y: from.y + dy * 0.3 + ny * bend() };
  const c2 = { x: from.x + dx * 0.7 + nx * bend(), y: from.y + dy * 0.7 + ny * bend() };

  const points: MousePathPoint[] = [];
  for (let i = 1; i <= count; i += 1) {
    const linear = i / count;
    const t = linear < 0.5 ? 2 * linear * linear : 1 - (-2 * linear + 2) ** 2 / 2; // 先快后慢
    const u = 1 - t;
    const x = u ** 3 * from.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * to.x;
    const y = u ** 3 * from.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * to.y;
    const jitter = i === count ? 0 : between(random, -0.6, 0.6);
    points.push({
      x: clamp(i === count ? to.x : x + jitter, bounds?.width),
      y: clamp(i === count ? to.y : y + jitter, bounds?.height),
      delayMs: Math.round((totalMs / count) * between(random, 0.7, 1.3)),
    });
  }
  return points;
}

/** 下一次按键前等多久：大多在平均值附近，偶尔停顿一下 */
export function keyDelay(profile: SpeedProfile, random: Random = Math.random): number {
  const base = profile.keyDelayMs * between(random, 0.55, 1.5);
  return Math.round(random() < 0.06 ? base + profile.keyDelayMs * between(random, 2, 5) : base);
}

/** 把一段滚动距离拆成多次滚轮，每次带节奏 */
export function wheelSegments(
  deltaY: number,
  profile: SpeedProfile,
  random: Random = Math.random
): Array<{ deltaY: number; delayMs: number }> {
  const direction = Math.sign(deltaY);
  let left = Math.abs(deltaY);
  const segments: Array<{ deltaY: number; delayMs: number }> = [];
  while (left > 0) {
    const notch = Math.round(between(random, 80, 140));
    const amount = Math.min(notch, left);
    segments.push({
      deltaY: direction * amount,
      delayMs: Math.round(between(random, 18, 60) + profile.pauseMs[0] / 2),
    });
    left -= amount;
  }
  return segments;
}

export interface KeyDescription {
  key: string;
  code: string;
  vk: number;
  shift: boolean;
}

const SHIFTED_SYMBOLS: Record<string, string> = {
  '!': '1', '@': '2', '#': '3', $: '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0',
  _: '-', '+': '=', '{': '[', '}': ']', '|': '\\', ':': ';', '"': "'", '<': ',', '>': '.', '?': '/', '~': '`',
};

const SYMBOL_KEYS: Record<string, [string, number]> = {
  '-': ['Minus', 189], '=': ['Equal', 187], '[': ['BracketLeft', 219], ']': ['BracketRight', 221],
  '\\': ['Backslash', 220], ';': ['Semicolon', 186], "'": ['Quote', 222], ',': ['Comma', 188],
  '.': ['Period', 190], '/': ['Slash', 191], '`': ['Backquote', 192],
};

/** 单个 ASCII 字符对应的按键；键盘上打不出的字符（中文等）返回 null，改用文本插入 */
export function describeChar(char: string): KeyDescription | null {
  if (char === ' ') return { key: ' ', code: 'Space', vk: 32, shift: false };
  if (/^[a-z]$/.test(char)) {
    return { key: char, code: `Key${char.toUpperCase()}`, vk: char.toUpperCase().charCodeAt(0), shift: false };
  }
  if (/^[A-Z]$/.test(char)) return { key: char, code: `Key${char}`, vk: char.charCodeAt(0), shift: true };
  if (/^[0-9]$/.test(char)) return { key: char, code: `Digit${char}`, vk: char.charCodeAt(0), shift: false };
  const base = SHIFTED_SYMBOLS[char];
  if (base) {
    if (/^[0-9]$/.test(base)) return { key: char, code: `Digit${base}`, vk: base.charCodeAt(0), shift: true };
    const [code, vk] = SYMBOL_KEYS[base];
    return { key: char, code, vk, shift: true };
  }
  const symbol = SYMBOL_KEYS[char];
  return symbol ? { key: char, code: symbol[0], vk: symbol[1], shift: false } : null;
}

export interface NamedKey {
  key: string;
  code: string;
  vk: number;
  /** WebDriver BiDi 的键值 */
  bidi: string;
  text?: string;
}

/** 按键步骤能选的功能键 */
export const NAMED_KEYS: Record<string, NamedKey> = {
  Enter: { key: 'Enter', code: 'Enter', vk: 13, bidi: '', text: '\r' },
  Tab: { key: 'Tab', code: 'Tab', vk: 9, bidi: '' },
  Escape: { key: 'Escape', code: 'Escape', vk: 27, bidi: '' },
  Backspace: { key: 'Backspace', code: 'Backspace', vk: 8, bidi: '' },
  Delete: { key: 'Delete', code: 'Delete', vk: 46, bidi: '' },
  Space: { key: ' ', code: 'Space', vk: 32, bidi: ' ', text: ' ' },
  ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', vk: 38, bidi: '' },
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', vk: 40, bidi: '' },
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', vk: 37, bidi: '' },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', vk: 39, bidi: '' },
  Home: { key: 'Home', code: 'Home', vk: 36, bidi: '' },
  End: { key: 'End', code: 'End', vk: 35, bidi: '' },
  PageUp: { key: 'PageUp', code: 'PageUp', vk: 33, bidi: '' },
  PageDown: { key: 'PageDown', code: 'PageDown', vk: 34, bidi: '' },
};
