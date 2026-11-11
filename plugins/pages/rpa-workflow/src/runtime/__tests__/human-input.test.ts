import { describe, expect, it } from 'vitest';
import { describeChar, keyDelay, mousePath, pointInBox, speedProfile, wheelSegments } from '../human-input';

const seeded = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const normal = speedProfile('normal');

describe('mousePath bounds', () => {
  it('never leaves the viewport even when the curve bends past the edge', () => {
    const bounds = { width: 800, height: 600 };
    // random 固定为 1：弧度最大，从顶部附近横向移动时控制点会冲出视口
    const path = mousePath({ x: 10, y: 3 }, { x: 700, y: 4 }, speedProfile('normal'), () => 1, bounds);
    const flipped = mousePath({ x: 700, y: 3 }, { x: 10, y: 4 }, speedProfile('normal'), () => 1, bounds);
    for (const point of [...path, ...flipped]) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(799);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(599);
    }
    expect(path.at(-1)).toMatchObject({ x: 700, y: 4 });
  });
});

describe('mousePath', () => {
  it('ends exactly on the target and is not a straight line', () => {
    const from = { x: 10, y: 10 };
    const to = { x: 700, y: 400 };
    const path = mousePath(from, to, normal, seeded());
    expect(path.at(-1)).toMatchObject(to);
    expect(path.length).toBeGreaterThan(5);
    const middle = path[Math.floor(path.length / 2)];
    const onLine = from.y + ((middle.x - from.x) * (to.y - from.y)) / (to.x - from.x);
    expect(Math.abs(middle.y - onLine)).toBeGreaterThan(1);
  });

  it('a slower profile takes longer', () => {
    const total = (speed: 'fast' | 'slow') =>
      mousePath({ x: 0, y: 0 }, { x: 600, y: 0 }, speedProfile(speed), seeded()).reduce((sum, p) => sum + p.delayMs, 0);
    expect(total('slow')).toBeGreaterThan(total('fast'));
  });

  it('does not move when already there', () => {
    expect(mousePath({ x: 5, y: 5 }, { x: 5, y: 5 }, normal)).toHaveLength(1);
  });
});

describe('pointInBox', () => {
  it('stays inside the element', () => {
    const box = { x: 100, y: 50, width: 80, height: 30 };
    const random = seeded(7);
    for (let i = 0; i < 500; i += 1) {
      const point = pointInBox(box, random);
      expect(point.x).toBeGreaterThanOrEqual(box.x);
      expect(point.x).toBeLessThanOrEqual(box.x + box.width);
      expect(point.y).toBeGreaterThanOrEqual(box.y);
      expect(point.y).toBeLessThanOrEqual(box.y + box.height);
    }
  });
});

describe('wheelSegments', () => {
  it('adds up to the requested distance in small notches', () => {
    const segments = wheelSegments(-1000, normal, seeded());
    expect(segments.reduce((sum, s) => sum + s.deltaY, 0)).toBe(-1000);
    expect(segments.every((s) => Math.abs(s.deltaY) <= 140)).toBe(true);
  });
});

describe('keyboard', () => {
  it('maps characters to physical keys', () => {
    expect(describeChar('a')).toMatchObject({ code: 'KeyA', vk: 65, shift: false });
    expect(describeChar('A')).toMatchObject({ code: 'KeyA', vk: 65, shift: true });
    expect(describeChar('!')).toMatchObject({ code: 'Digit1', shift: true });
    expect(describeChar('.')).toMatchObject({ code: 'Period', shift: false });
  });
  it('has no physical key for Chinese', () => {
    expect(describeChar('中')).toBeNull();
  });
  it('key delays vary', () => {
    const random = seeded(3);
    const delays = new Set(Array.from({ length: 30 }, () => keyDelay(normal, random)));
    expect(delays.size).toBeGreaterThan(5);
  });
});
