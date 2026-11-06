import type { Account } from '../types';

const passwordCache = new Map<string, string>();

export async function decryptAccountPassword(account: Account): Promise<string> {
  if (!account.password) {
    return '';
  }

  const cacheKey = account.uuid || account.password;
  const cached = passwordCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  passwordCache.set(cacheKey, account.password);
  return account.password;
}
