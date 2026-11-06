export const PAGE_SIZE = 10;

export const COMMON_PLATFORMS = [
  { name: 'Facebook', url: 'https://facebook.com', icon: 'facebook' },
  { name: 'Google', url: 'https://google.com', icon: 'google' },
  { name: 'YouTube', url: 'https://youtube.com', icon: 'youtube' },
  { name: 'Instagram', url: 'https://instagram.com', icon: 'instagram' },
  { name: 'Twitter/X', url: 'https://x.com', icon: 'twitter' },
  { name: 'LinkedIn', url: 'https://linkedin.com', icon: 'linkedin' },
  { name: 'TikTok', url: 'https://tiktok.com', icon: 'tiktok' },
  { name: 'Amazon', url: 'https://amazon.com', icon: 'amazon' },
];

// 从 URL 提取平台名称
export function getPlatformName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const platform = COMMON_PLATFORMS.find((p) =>
      hostname.includes(new URL(p.url).hostname.replace('www.', ''))
    );
    if (platform) return platform.name;

    // 提取域名作为名称
    return hostname.replace('www.', '').split('.')[0];
  } catch {
    return url;
  }
}
