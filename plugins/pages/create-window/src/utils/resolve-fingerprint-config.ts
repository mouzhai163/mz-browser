/**
 * 解析指纹配置工具
 *
 * 处理 'ip' 模式的指纹配置：
 * - 如果有代理：检测代理 IP 并填充真实值
 * - 如果无代理：生成地理位置相关联的随机值
 */

import type { ProxyConfig } from '../../../../services/environment/src/types';

/** 地区信息 */
interface RegionInfo {
  language: string;
  timezone: string;
  latitude: number;
  longitude: number;
  countryCode: string;
  countryName: string;
}

/** 预定义的地区列表（地理位置相关联） */
const REGIONS: RegionInfo[] = [
  // 北美
  {
    language: 'en-US',
    timezone: 'America/New_York',
    latitude: 40.7128,
    longitude: -74.0060,
    countryCode: 'US',
    countryName: 'United States',
  },
  {
    language: 'en-US',
    timezone: 'America/Los_Angeles',
    latitude: 34.0522,
    longitude: -118.2437,
    countryCode: 'US',
    countryName: 'United States',
  },
  {
    language: 'en-CA',
    timezone: 'America/Toronto',
    latitude: 43.6532,
    longitude: -79.3832,
    countryCode: 'CA',
    countryName: 'Canada',
  },

  // 欧洲
  {
    language: 'en-GB',
    timezone: 'Europe/London',
    latitude: 51.5074,
    longitude: -0.1278,
    countryCode: 'GB',
    countryName: 'United Kingdom',
  },
  {
    language: 'fr-FR',
    timezone: 'Europe/Paris',
    latitude: 48.8566,
    longitude: 2.3522,
    countryCode: 'FR',
    countryName: 'France',
  },
  {
    language: 'de-DE',
    timezone: 'Europe/Berlin',
    latitude: 52.5200,
    longitude: 13.4050,
    countryCode: 'DE',
    countryName: 'Germany',
  },

  // 亚洲
  {
    language: 'zh-CN',
    timezone: 'Asia/Shanghai',
    latitude: 31.2304,
    longitude: 121.4737,
    countryCode: 'CN',
    countryName: 'China',
  },
  {
    language: 'ja-JP',
    timezone: 'Asia/Tokyo',
    latitude: 35.6762,
    longitude: 139.6503,
    countryCode: 'JP',
    countryName: 'Japan',
  },
  {
    language: 'ko-KR',
    timezone: 'Asia/Seoul',
    latitude: 37.5665,
    longitude: 126.9780,
    countryCode: 'KR',
    countryName: 'South Korea',
  },

  // 大洋洲
  {
    language: 'en-AU',
    timezone: 'Australia/Sydney',
    latitude: -33.8688,
    longitude: 151.2093,
    countryCode: 'AU',
    countryName: 'Australia',
  },
];

/**
 * 生成随机地区信息
 */
function generateRandomRegion(): RegionInfo {
  const randomIndex = Math.floor(Math.random() * REGIONS.length);
  return REGIONS[randomIndex];
}

/**
 * 检测代理 IP 信息
 */
async function detectProxyIP(proxy: ProxyConfig): Promise<RegionInfo | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');

    // 调用 Tauri 后端的 IP 检测服务
    const ipInfo = await invoke<{
      ip: string;
      country: string;
      country_code: string;
      city: string;
      region: string;
      isp: string;
      timezone: string;
      latitude?: number;
      longitude?: number;
    } | null>('detect_proxy_ip', { config: proxy });

    if (!ipInfo) {
      return null;
    }

    // 根据国家代码推断语言
    const language = inferLanguageFromCountryCode(ipInfo.country_code);

    return {
      language,
      timezone: ipInfo.timezone,
      latitude: ipInfo.latitude || 0,
      longitude: ipInfo.longitude || 0,
      countryCode: ipInfo.country_code,
      countryName: ipInfo.country,
    };
  } catch (error) {
    console.error('检测代理 IP 失败:', error);
    return null;
  }
}

/**
 * 根据国家代码推断语言
 */
function inferLanguageFromCountryCode(countryCode: string): string {
  const languageMap: Record<string, string> = {
    CN: 'zh-CN',
    TW: 'zh-TW',
    HK: 'zh-HK',
    US: 'en-US',
    GB: 'en-GB',
    CA: 'en-CA',
    AU: 'en-AU',
    JP: 'ja-JP',
    KR: 'ko-KR',
    FR: 'fr-FR',
    DE: 'de-DE',
    ES: 'es-ES',
    IT: 'it-IT',
    RU: 'ru-RU',
    BR: 'pt-BR',
    MX: 'es-MX',
    IN: 'en-IN',
    SG: 'en-SG',
  };

  return languageMap[countryCode.toUpperCase()] || 'en-US';
}

/**
 * 解析指纹配置
 *
 * @param config 原始配置
 * @param proxy 代理配置
 * @returns 解析后的配置
 */
export async function resolveFingerprintConfig(
  config: any,
  proxy: ProxyConfig | null
): Promise<any> {
  const resolved = { ...config };

  // 检查是否需要处理 'ip' 模式
  const needsIpResolution =
    config.language === 'ip' ||
    config.interfaceLanguage === 'ip' ||
    config.timezone === 'ip' ||
    config.geolocation === 'ip';

  if (!needsIpResolution) {
    return resolved;
  }

  let regionInfo: RegionInfo | null = null;

  // 如果有代理，尝试检测 IP
  if (proxy) {
    regionInfo = await detectProxyIP(proxy);
  }

  // 如果没有代理或检测失败，生成随机地区
  if (!regionInfo) {
    regionInfo = generateRandomRegion();
  }

  // 应用地区信息
  if (config.language === 'ip') {
    resolved.language = regionInfo.language;
  }

  if (config.interfaceLanguage === 'ip') {
    resolved.interfaceLanguage = regionInfo.language;
  }

  if (config.timezone === 'ip') {
    resolved.timezone = regionInfo.timezone;
  }

  if (config.geolocation === 'ip') {
    resolved.geolocation = `${regionInfo.latitude},${regionInfo.longitude}`;
  }

  return resolved;
}

/**
 * 批量解析多个环境的指纹配置
 */
export async function resolveFingerprintConfigs(
  configs: Array<{ config: any; proxy: ProxyConfig | null }>
): Promise<any[]> {
  return Promise.all(
    configs.map(({ config, proxy }) => resolveFingerprintConfig(config, proxy))
  );
}
