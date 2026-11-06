import { invoke } from '@/lib/tauri';
import { save } from '@tauri-apps/plugin-dialog';
import { toast } from 'sonner';
import type { AuditLog } from '../api';

/**
 * 将值转义为 CSV 安全格式
 */
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  // 如果包含逗号、换行符或引号，需要用引号包裹并转义内部引号
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * 将审计日志数据转换为 CSV 格式
 */
function convertToCSV(logs: AuditLog[]): string {
  const headers = [
    'id',
    'action',
    'target_type',
    'target_id',
    'target_name',
    'details',
    'timestamp',
    'operator',
    'ip_address',
  ];

  const rows = logs.map((log) =>
    [
      escapeCSV(log.id),
      escapeCSV(log.action),
      escapeCSV(log.targetType),
      escapeCSV(log.targetId || ''),
      escapeCSV(log.targetName || ''),
      escapeCSV(log.details),
      escapeCSV(log.timestamp),
      escapeCSV(log.operator),
      escapeCSV(log.ipAddress || ''),
    ].join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

/**
 * 导出审计日志到 CSV 文件
 * @param logs 要导出的日志列表
 * @returns 是否成功导出
 */
export async function exportAuditLogsToCSV(logs: AuditLog[]): Promise<boolean> {
  if (logs.length === 0) {
    toast.warning('没有可导出的日志');
    return false;
  }

  try {
    // 转换为 CSV 格式
    const csvContent = convertToCSV(logs);

    // 生成文件名
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `audit-logs-${dateStr}`;

    // 选择文件保存路径
    const filePath = await save({
      defaultPath: `${fileName}.csv`,
      filters: [{ name: 'CSV 文件', extensions: ['csv'] }],
    });

    if (!filePath) {
      // 用户取消了选择
      return false;
    }

    // 写入文件
    await invoke('write_text_file', {
      path: filePath,
      content: csvContent,
    });

    toast.success(`成功导出 ${logs.length} 条审计日志`);
    return true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '导出失败');
    return false;
  }
}
