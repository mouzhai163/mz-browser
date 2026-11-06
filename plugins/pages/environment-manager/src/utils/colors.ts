/**
 * 颜色相关工具函数和常量
 */

/**
 * 可用的标签颜色
 */
export const TAG_COLORS = [
  'slate',
  'blue',
  'purple',
  'green',
  'orange',
  'red',
  'yellow',
  'pink',
  'cyan',
  'indigo',
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

/**
 * 获取标签颜色的 CSS 类名
 * @param color 颜色名称
 * @returns Tailwind CSS 类名
 */
export function getTagColorClasses(color: string): string {
  const colorMap: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400',
    purple:
      'border-purple-200 bg-purple-50 text-purple-600 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-400',
    green:
      'border-green-200 bg-green-50 text-green-600 dark:border-green-800 dark:bg-green-950 dark:text-green-400',
    orange:
      'border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400',
    red: 'border-red-200 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400',
    yellow:
      'border-yellow-200 bg-yellow-50 text-yellow-600 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-400',
    pink: 'border-pink-200 bg-pink-50 text-pink-600 dark:border-pink-800 dark:bg-pink-950 dark:text-pink-400',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-600 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-400',
    indigo:
      'border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-400',
    slate: 'border-border bg-secondary text-secondary-foreground',
  };

  return colorMap[color] || colorMap.slate;
}

/**
 * 获取标签颜色指示器的 CSS 类名（小圆点）
 * @param color 颜色名称
 * @returns Tailwind CSS 类名
 */
export function getTagDotColorClasses(color: string): string {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500 border-blue-600',
    purple: 'bg-purple-500 border-purple-600',
    green: 'bg-green-500 border-green-600',
    orange: 'bg-orange-500 border-orange-600',
    red: 'bg-red-500 border-red-600',
    yellow: 'bg-yellow-500 border-yellow-600',
    pink: 'bg-pink-500 border-pink-600',
    cyan: 'bg-cyan-500 border-cyan-600',
    indigo: 'bg-indigo-500 border-indigo-600',
    slate: 'bg-slate-500 border-slate-600',
  };

  return colorMap[color] || colorMap.slate;
}

/**
 * 获取标签颜色按钮的背景色类名
 * @param color 颜色名称
 * @returns Tailwind CSS 类名
 */
export function getTagButtonBgClass(color: TagColor): string {
  const colorMap: Record<TagColor, string> = {
    slate: 'bg-slate-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    pink: 'bg-pink-500',
    cyan: 'bg-cyan-500',
    indigo: 'bg-indigo-500',
  };

  return colorMap[color];
}

/**
 * 获取分组颜色的 CSS 类名
 * @param color 颜色名称
 * @returns Tailwind CSS 类名
 */
export function getGroupColorClasses(color: string): string {
  const colorMap: Record<string, string> = {
    green:
      'border-green-200 bg-green-50 text-green-600 dark:border-green-800 dark:bg-green-950 dark:text-green-400',
    orange:
      'border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400',
  };

  return colorMap[color] || 'border-border bg-secondary text-secondary-foreground';
}
