import { invoke } from '@/lib/tauri';
import { parseCsvRows } from '@/lib/csv';
import { open, save } from '@tauri-apps/plugin-dialog';
import { toast } from 'sonner';
import type { Account, ExportRange } from '../types';
import { createAccount } from '../api';

/**
 * 导入账号数据项
 */
export interface ImportAccountItem {
  platform: string;
  account: string;
  password: string;
  remark: string;
  valid: boolean;
  error?: string;
}

/**
 * 从 URL 提取平台名称
 */
function getPlatformNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * 解析 CSV 内容为导入数据
 */
export function parseCSVContent(content: string): ImportAccountItem[] {
  const rows = parseCsvRows(content);
  if (rows.length === 0) return [];

  // 检查第一行是否为表头
  const firstLine = rows[0].join(',').toLowerCase();
  const hasHeader =
    firstLine.includes('platform') ||
    firstLine.includes('account') ||
    firstLine.includes('password');

  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows.map((values) => {
    // 导出格式：platform, account, password, remark
    const [platform = '', account = '', password = '', remark = ''] = values;

    const item: ImportAccountItem = {
      platform,
      account,
      password,
      remark,
      valid: true,
    };

    // 验证必填字段
    if (!platform) {
      item.valid = false;
      item.error = '缺少平台地址';
    } else if (!account) {
      item.valid = false;
      item.error = '缺少账号';
    } else {
      // 验证 URL 格式
      try {
        new URL(platform);
      } catch {
        item.valid = false;
        item.error = '平台地址格式无效';
      }
    }

    return item;
  });
}

/**
 * 解析 JSON 内容为导入数据
 */
export function parseJSONContent(content: string): ImportAccountItem[] {
  try {
    const parsed = JSON.parse(content);
    const data = Array.isArray(parsed) ? parsed : [parsed];

    return data.map((item: Record<string, unknown>) => {
      const platform = String(item.platform || '');
      const account = String(item.account || '');
      const password = String(item.password || '');
      const remark = String(item.remark || '');

      const result: ImportAccountItem = {
        platform,
        account,
        password,
        remark,
        valid: true,
      };

      // 验证必填字段
      if (!platform) {
        result.valid = false;
        result.error = '缺少平台地址';
      } else if (!account) {
        result.valid = false;
        result.error = '缺少账号';
      } else {
        try {
          new URL(platform);
        } catch {
          result.valid = false;
          result.error = '平台地址格式无效';
        }
      }

      return result;
    });
  } catch {
    return [];
  }
}

/**
 * 选择并读取账号文件（支持 CSV 和 JSON）
 */
export async function selectAndReadAccountFile(): Promise<ImportAccountItem[] | null> {
  try {
    const filePath = await open({
      multiple: false,
      filters: [
        { name: '账号文件', extensions: ['csv', 'json'] },
        { name: 'CSV 文件', extensions: ['csv'] },
        { name: 'JSON 文件', extensions: ['json'] },
      ],
    });

    if (!filePath) {
      return null;
    }

    // 读取文件内容
    const content = await invoke<string>('read_text_file', { path: filePath });

    // 根据文件扩展名判断格式
    const isJSON = String(filePath).toLowerCase().endsWith('.json');
    const items = isJSON ? parseJSONContent(content) : parseCSVContent(content);

    if (items.length === 0) {
      toast.warning('文件中没有可导入的数据');
      return null;
    }

    return items;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '读取文件失败');
    return null;
  }
}

/**
 * 批量导入账号
 */
export async function importAccountItems(items: ImportAccountItem[]): Promise<number> {
  let successCount = 0;

  const validItems = items.filter((item) => item.valid);

  for (const item of validItems) {
    try {
      await createAccount({
        platform_url: item.platform,
        platform_name: getPlatformNameFromUrl(item.platform),
        account: item.account,
        password: item.password || undefined,
        remark: item.remark || undefined,
      });
      successCount++;
    } catch {
      // 忽略单个导入失败
    }
  }

  return successCount;
}

/**
 * 将值转义为 CSV 安全格式
 */
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * 将账号数据转换为 CSV 格式
 */
export function convertToCSV(accounts: Account[]): string {
  // 核心字段：平台、账号、密码、备注
  const headers = ['platform', 'account', 'password', 'remark'];

  const rows = accounts.map((account) => {
    return [
      escapeCSV(account.platform),
      escapeCSV(account.account),
      escapeCSV(account.password),
      escapeCSV(account.remark || ''),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * 根据导出范围获取要导出的账号列表
 */
export function getAccountsToExport(
  accounts: Account[],
  range: ExportRange,
  selectedIds: Set<string>,
  filteredAccounts: Account[]
): Account[] {
  switch (range) {
    case 'selected':
      return accounts.filter((a) => selectedIds.has(a.uuid));
    case 'filtered':
      return filteredAccounts;
    default:
      return accounts;
  }
}

/**
 * 导出账号数据到 CSV 文件
 */
export async function exportAccountsToCSV(
  accounts: Account[],
  defaultFileName?: string
): Promise<boolean> {
  if (accounts.length === 0) {
    toast.warning('没有可导出的账号');
    return false;
  }

  try {
    // 转换为 CSV 格式
    const csvContent = convertToCSV(accounts);

    // 生成默认文件名
    const fileName = defaultFileName || `accounts-${new Date().toISOString().slice(0, 10)}`;

    // 选择文件保存路径
    const filePath = await save({
      defaultPath: `${fileName}.csv`,
      filters: [{ name: 'CSV 文件', extensions: ['csv'] }],
    });

    if (!filePath) {
      return false;
    }

    // 写入文件
    await invoke('write_text_file', {
      path: filePath,
      content: csvContent,
    });

    toast.success(`成功导出 ${accounts.length} 个账号`);
    return true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '导出失败');
    return false;
  }
}

/**
 * 导出账号数据
 */
export function exportAccounts(
  allAccounts: Account[],
  exportRange: ExportRange,
  selectedIds: Set<string>,
  filteredAccounts: Account[]
): void {
  const accountsToExport = getAccountsToExport(
    allAccounts,
    exportRange,
    selectedIds,
    filteredAccounts
  );
  void exportAccountsToCSV(accountsToExport);
}
