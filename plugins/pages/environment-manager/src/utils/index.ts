/**
 * 工具函数统一导出
 */

// 账号相关
export { parseAccountString, serializeAccountString, getPlatformIcon, PLATFORMS } from './account.tsx';
export type { ParsedAccount } from './account.tsx';

// 指纹相关
export { parseFingerprint, getOSColorClass, getBrowserColorClass } from './fingerprint';
export type { OSType, BrowserType, ParsedFingerprint } from './fingerprint';

// 颜色相关
export {
  TAG_COLORS,
  getTagColorClasses,
  getTagDotColorClasses,
  getTagButtonBgClass,
  getGroupColorClasses,
} from './colors';
export type { TagColor } from './colors';

// 分组颜色
export { getGroupColor } from './group-color';

// 本地代理
export {
  getLocalMihomoProxyRecords,
  mapLocalMihomoProxyToProxyCandidate,
  mapLocalMihomoProxyToProxySummary,
  buildMissingLocalProxySummary,
} from './local-proxy';
export type { MihomoLocalProxyRecord, EnvironmentProxyCandidate } from './local-proxy';
