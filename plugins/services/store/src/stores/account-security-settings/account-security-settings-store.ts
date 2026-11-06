/**
 * 账户安全设置持久化存储（通过 Tauri command 读写）
 */
import { getStoreKey, setStoreKey } from '../../store-commands';
import {
  DEFAULT_ACCOUNT_SECURITY_SETTINGS,
  LOCK_TIME_OPTIONS,
  type AccountSecuritySettings,
} from './account-security-settings.types';

const STORE_KEY = 'accountSecurity';

/**
 * 获取账户安全设置
 */
export async function getAccountSecuritySettings(): Promise<AccountSecuritySettings> {
  const raw = await getStoreKey<Partial<AccountSecuritySettings>>(STORE_KEY);
  if (!raw) {
    return { ...DEFAULT_ACCOUNT_SECURITY_SETTINGS };
  }
  const autoLockTime = raw.autoLockTime ?? DEFAULT_ACCOUNT_SECURITY_SETTINGS.autoLockTime;
  const validLockTime =
    typeof autoLockTime === 'number' && LOCK_TIME_OPTIONS.includes(autoLockTime)
      ? autoLockTime
      : DEFAULT_ACCOUNT_SECURITY_SETTINGS.autoLockTime;

  return {
    autoLockEnabled: raw.autoLockEnabled ?? DEFAULT_ACCOUNT_SECURITY_SETTINGS.autoLockEnabled,
    autoLockTime: validLockTime,
    cleanDataOnExit: raw.cleanDataOnExit ?? DEFAULT_ACCOUNT_SECURITY_SETTINGS.cleanDataOnExit,
  };
}

/**
 * 更新账户安全设置（支持部分更新）
 */
export async function setAccountSecuritySettings(
  patch: Partial<AccountSecuritySettings>
): Promise<void> {
  const current = await getAccountSecuritySettings();
  const next: AccountSecuritySettings = {
    ...current,
    ...patch,
  };
  await setStoreKey(STORE_KEY, next);
}
