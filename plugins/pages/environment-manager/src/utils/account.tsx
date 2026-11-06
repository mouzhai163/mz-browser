/**
 * 账号相关工具函数
 */

import { Globe } from 'lucide-react';

export interface ParsedAccount {
  platform: string;
  account: string;
  password: string;
}

/**
 * 常见平台列表
 */
export const PLATFORMS = [
  { name: 'Facebook', url: 'https://www.facebook.com/' },
  { name: 'TikTok', url: 'https://www.tiktok.com/' },
  { name: 'YouTube', url: 'https://www.youtube.com/' },
  { name: 'X (Twitter)', url: 'https://x.com/' },
  { name: 'Instagram', url: 'https://www.instagram.com/' },
  { name: 'LinkedIn', url: 'https://www.linkedin.com/' },
  { name: 'Google', url: 'https://www.google.com/' },
  { name: 'Amazon', url: 'https://www.amazon.com/' },
];

/**
 * 根据平台 URL 获取 Font Awesome 图标
 */
export function getPlatformIcon(platform: string): React.ReactNode {
  const lower = platform.toLowerCase();

  if (lower.includes('facebook.com') || lower.includes('fb.com')) {
    return <i className="fa-brands fa-facebook text-blue-600"></i>;
  }
  if (lower.includes('youtube.com')) {
    return <i className="fa-brands fa-youtube text-red-600"></i>;
  }
  if (lower.includes('instagram.com')) {
    return <i className="fa-brands fa-instagram text-pink-600"></i>;
  }
  if (lower.includes('linkedin.com')) {
    return <i className="fa-brands fa-linkedin text-blue-700"></i>;
  }
  if (lower.includes('twitter.com') || lower.includes('x.com')) {
    return <i className="fa-brands fa-x-twitter text-sky-500"></i>;
  }
  if (lower.includes('tiktok.com')) {
    return <i className="fa-brands fa-tiktok"></i>;
  }
  if (lower.includes('google.com') || lower.includes('gmail.com')) {
    return <i className="fa-brands fa-google text-blue-500"></i>;
  }
  if (lower.includes('amazon.com')) {
    return <i className="fa-brands fa-amazon text-orange-500"></i>;
  }

  // 默认使用 Globe 图标
  return <Globe className="h-4 w-4 text-muted-foreground" />;
}

/**
 * 从账号字符串解析平台、账号和密码信息
 * @param accountStr 账号字符串，格式为 "platform|account|password" 或直接是邮箱
 * @returns 解析后的账号信息，如果无效则返回 null
 */
export function parseAccountString(accountStr: string): ParsedAccount | null {
  if (!accountStr) return null;

  // 格式为 "platform|account|password"
  if (accountStr.includes('|')) {
    const [platform, account, password] = accountStr.split('|');
    return {
      platform: platform || '',
      account: account || '',
      password: password || '',
    };
  }

  // 直接是邮箱格式
  return {
    platform: '',
    account: accountStr,
    password: '',
  };
}

/**
 * 将账号信息序列化为字符串
 * @param account 账号信息
 * @returns 序列化后的字符串
 */
export function serializeAccountString(account: ParsedAccount): string {
  if (!account.platform && !account.password) {
    return account.account;
  }
  return `${account.platform}|${account.account}|${account.password}`;
}
