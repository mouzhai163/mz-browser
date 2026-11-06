import type { FontListConfig, Resolution } from '../types';
import { generateFontListConfig, generateScreenResolution } from './fingerprint-generator';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function normalizeResolution(value: unknown): Resolution {
  if (isRecord(value) && typeof value.width === 'number' && typeof value.height === 'number') {
    return {
      width: value.width,
      height: value.height,
    };
  }

  return generateScreenResolution();
}

export function normalizeFontListConfig(value: unknown, system: string): FontListConfig {
  const defaultFontList = generateFontListConfig('random', system);

  if (!isRecord(value)) {
    return defaultFontList;
  }

  const mode = value.mode;
  const fonts = Array.isArray(value.fonts)
    ? value.fonts.filter((font): font is string => typeof font === 'string')
    : defaultFontList.fonts;

  return {
    mode:
      mode === 'system' || mode === 'random' || mode === 'ua-match' || mode === 'custom'
        ? mode
        : defaultFontList.mode,
    fonts,
  };
}
