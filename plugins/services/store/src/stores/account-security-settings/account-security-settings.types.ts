/**
 * 账户安全相关本地设置
 * 仅用于持久化存储，不包含业务逻辑实现
 */
export interface AccountSecuritySettings {
  /** 是否启用自动锁定 */
  autoLockEnabled: boolean;
  /** 自动锁定时间（分钟） */
  autoLockTime: number;
  /** 退出时是否清除数据 */
  cleanDataOnExit: boolean;
}

export const DEFAULT_ACCOUNT_SECURITY_SETTINGS: AccountSecuritySettings = {
  autoLockEnabled: false,
  autoLockTime: 5,
  cleanDataOnExit: false,
};

export const LOCK_TIME_OPTIONS = [1, 5, 10, 15, 30] as const;
