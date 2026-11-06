import { invoke } from '@/lib/tauri';
import { save } from '@tauri-apps/plugin-dialog';
import { toast } from 'sonner';
import type { Environment } from '../types';

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
 * 将环境数据转换为 CSV 格式
 */
export function convertToCSV(environments: Environment[]): string {
  // 使用英文列名
  const headers = [
    'name',
    'description',
    'status',
    'proxy_name',
    'proxy_host',
    'proxy_port',
    'proxy_type',
    'proxy_country',
    'proxy_city',
    'group_name',
    'group_description',
    'tags',
    'accounts',
    'fingerprint_summary',
    'system_info',
    'kernel_info',
    'last_opened_at',
    'created_at',
    'updated_at',
  ];

  const rows = environments.map((env) => {
    // 处理代理数据
    const proxyName = env.proxy?.name || '';
    const proxyHost = env.proxy?.host || '';
    const proxyPort = env.proxy?.port || '';
    const proxyType = env.proxy?.proxy_type || '';
    const proxyCountry = env.proxy?.country || '';
    const proxyCity = env.proxy?.city || '';

    // 处理分组数据
    const groupName = env.group?.name || '';
    const groupDescription = env.group?.description || '';

    // 处理标签数据 - 将标签名称用分号连接
    const tagsStr = env.tags?.map((t) => t.name).join(';') || '';

    // 处理账号数据 - 将账号信息用分号连接
    const accountsStr =
      env.accounts?.map((a) => `${a.platform_name || a.platform_url}:${a.account}`).join(';') || '';

    return [
      escapeCSV(env.name),
      escapeCSV(env.description || ''),
      escapeCSV(env.status),
      escapeCSV(proxyName),
      escapeCSV(proxyHost),
      escapeCSV(proxyPort),
      escapeCSV(proxyType),
      escapeCSV(proxyCountry),
      escapeCSV(proxyCity),
      escapeCSV(groupName),
      escapeCSV(groupDescription),
      escapeCSV(tagsStr),
      escapeCSV(accountsStr),
      escapeCSV(env.fingerprint_summary || ''),
      escapeCSV(env.system_info || ''),
      escapeCSV(env.kernel_info || ''),
      escapeCSV(env.last_opened_at || ''),
      escapeCSV(env.created_at),
      escapeCSV(env.updated_at),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * 导出环境数据到 CSV 文件
 * @param environments 要导出的环境列表
 * @param defaultFileName 默认文件名（不含扩展名）
 * @returns 是否成功导出
 */
export async function exportEnvironmentsToCSV(
  environments: Environment[],
  defaultFileName?: string
): Promise<boolean> {
  if (environments.length === 0) {
    toast.warning('没有可导出的环境');
    return false;
  }

  try {
    // 转换为 CSV 格式
    const csvContent = convertToCSV(environments);

    // 生成默认文件名
    const fileName = defaultFileName || `environments-${new Date().toISOString().slice(0, 10)}`;

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

    toast.success(`成功导出 ${environments.length} 个环境`);
    return true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '导出失败');
    return false;
  }
}
