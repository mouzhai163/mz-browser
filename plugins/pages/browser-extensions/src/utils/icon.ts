import { convertFileSrc } from '@tauri-apps/api/core';

const URL_PREFIXES = ['http://', 'https://', 'data:', 'blob:', 'asset:', 'tauri:'];

function isAbsoluteLocalPath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('/') || value.startsWith('\\\\');
}

export function resolveExtensionIconSrc(icon?: string | null): string | undefined {
  if (!icon) {
    return undefined;
  }

  if (URL_PREFIXES.some((prefix) => icon.startsWith(prefix))) {
    return icon;
  }

  if (icon.startsWith('file://')) {
    const normalizedPath = decodeURIComponent(icon.replace(/^file:\/+/, '/'));
    return convertFileSrc(normalizedPath);
  }

  if (isAbsoluteLocalPath(icon)) {
    return convertFileSrc(icon);
  }

  return undefined;
}
