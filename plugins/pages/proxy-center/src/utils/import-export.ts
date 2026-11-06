import { invoke } from '@/lib/tauri';
import { open, save } from '@tauri-apps/plugin-dialog';
import { toast } from 'sonner';
import type { Proxy, ProxyFormData, ExportRange } from '../types';
import { createProxy } from '../api';

/**
 * 导入代理数据项
 */
export interface ImportProxyItem {
  name: string;
  host: string;
  port: string;
  type: string;
  username: string;
  password: string;
  valid: boolean;
  error?: string;
}

/**
 * 解析 CSV 值（处理引号包裹的值）
 */
function parseCSVValue(value: string): string {
  const trimmed = value.trim();
  // 如果被引号包裹，去掉引号并处理转义的引号
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed;
}

/**
 * 解析 CSV 行（处理引号内的逗号）
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // 转义的引号
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(parseCSVValue(current));
      current = '';
    } else {
      current += char;
    }
  }
  values.push(parseCSVValue(current));

  return values;
}

/**
 * 解析 CSV 内容为导入数据
 */
export function parseCSVContent(content: string): ImportProxyItem[] {
  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length === 0) return [];

  // 检查第一行是否为表头
  const firstLine = lines[0].toLowerCase();
  const hasHeader =
    firstLine.includes('name') || firstLine.includes('host') || firstLine.includes('port');

  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const values = parseCSVLine(line);

    // 根据导出格式：name, host, port, type, username, password
    const [name = '', host = '', port = '', type = '', username = '', password = ''] = values;

    const item: ImportProxyItem = {
      name: name || `${host}:${port}`,
      host,
      port,
      type: type || 'http',
      username,
      password,
      valid: true,
    };

    // 验证必填字段
    if (!host) {
      item.valid = false;
      item.error = '缺少主机地址';
    } else if (!port) {
      item.valid = false;
      item.error = '缺少端口';
    } else if (isNaN(Number(port))) {
      item.valid = false;
      item.error = '端口必须是数字';
    }

    return item;
  });
}

/**
 * 解析 JSON 内容为导入数据
 * 支持字段：name, host, port, type, username, password
 */
export function parseJSONContent(content: string): ImportProxyItem[] {
  try {
    const parsed = JSON.parse(content);
    const data = Array.isArray(parsed) ? parsed : [parsed];

    return data.map((item: Record<string, unknown>) => {
      const name = String(item.name || '');
      const host = String(item.host || '');
      const port = String(item.port || '');
      const type = String(item.type || 'http');
      const username = String(item.username || '');
      const password = String(item.password || '');

      const result: ImportProxyItem = {
        name: name || `${host}:${port}`,
        host,
        port,
        type,
        username,
        password,
        valid: true,
      };

      // 验证必填字段
      if (!host) {
        result.valid = false;
        result.error = '缺少主机地址';
      } else if (!port) {
        result.valid = false;
        result.error = '缺少端口';
      } else if (isNaN(Number(port))) {
        result.valid = false;
        result.error = '端口必须是数字';
      }

      return result;
    });
  } catch {
    return [];
  }
}

/**
 * 选择并读取代理文件（支持 CSV 和 JSON）
 */
export async function selectAndReadProxyFile(): Promise<ImportProxyItem[] | null> {
  try {
    const filePath = await open({
      multiple: false,
      filters: [
        { name: '代理文件', extensions: ['csv', 'json'] },
        { name: 'CSV 文件', extensions: ['csv'] },
        { name: 'JSON 文件', extensions: ['json'] },
      ],
    });

    if (!filePath) {
      return null; // 用户取消选择
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
 * @deprecated 使用 selectAndReadProxyFile 代替
 */
export async function selectAndReadCSVFile(): Promise<ImportProxyItem[] | null> {
  return selectAndReadProxyFile();
}

/**
 * 解析导入的 JSON 数据
 */
export function parseImportData(importJson: string): Partial<ProxyFormData>[] {
  try {
    const parsed = JSON.parse(importJson);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // 尝试按行解析
    return importJson
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  }
}

/**
 * 批量导入代理
 */
export async function importProxies(proxiesToImport: Partial<ProxyFormData>[]): Promise<number> {
  let successCount = 0;

  for (const proxy of proxiesToImport) {
    if (!proxy.host || !proxy.port) continue;

    try {
      await createProxy({
        name: proxy.name || `${proxy.host}:${proxy.port}`,
        host: proxy.host,
        port: Number(proxy.port),
        proxy_type: proxy.type || 'http',
        username: proxy.username || undefined,
        password: proxy.password || undefined,
      });
      successCount++;
    } catch {
      // 忽略单个导入失败
    }
  }

  return successCount;
}

/**
 * 批量导入代理（从 ImportProxyItem）
 */
export async function importProxyItems(items: ImportProxyItem[]): Promise<number> {
  let successCount = 0;

  const validItems = items.filter((item) => item.valid);

  for (const item of validItems) {
    try {
      await createProxy({
        name: item.name || `${item.host}:${item.port}`,
        host: item.host,
        port: Number(item.port),
        proxy_type: item.type || 'http',
        username: item.username || undefined,
        password: item.password || undefined,
      });
      successCount++;
    } catch {
      // 忽略单个导入失败
    }
  }

  return successCount;
}

/**
 * 根据导出范围获取要导出的代理列表
 */
export function getProxiesToExport(
  proxies: Proxy[],
  range: ExportRange,
  selectedIds: Set<string>,
  filteredProxies: Proxy[]
): Proxy[] {
  switch (range) {
    case 'selected':
      return proxies.filter((p) => selectedIds.has(p.uuid));
    case 'filtered':
      return filteredProxies;
    default:
      return proxies;
  }
}

/**
 * 导出代理数据到 CSV 文件
 * @param proxies 要导出的代理列表
 * @param exportPlainPassword 是否导出明文密码（true=解密后导出，false=导出加密密码）
 * @param defaultFileName 默认文件名（不含扩展名）
 * @returns 是否成功导出
 */
export async function exportProxiesToCSV(
  proxies: Proxy[],
  exportPlainPassword: boolean = false,
  defaultFileName?: string
): Promise<boolean> {
  if (proxies.length === 0) {
    toast.warning('没有可导出的代理');
    return false;
  }

  try {
    // 生成默认文件名
    const fileName = defaultFileName || `proxies-${new Date().toISOString().slice(0, 10)}`;

    // 选择文件保存路径
    const filePath = await save({
      defaultPath: `${fileName}.csv`,
      filters: [{ name: 'CSV 文件', extensions: ['csv'] }],
    });

    if (!filePath) {
      // 用户取消了选择
      return false;
    }

    // 准备导出数据：转换为后端需要的格式
    const exportItems = proxies.map(proxy => ({
      name: proxy.name,
      host: proxy.host,
      port: proxy.port,
      proxy_type: proxy.type,
      username: proxy.username || null,
      password: proxy.password || null,
    }));

    // 调用 Tauri 后端导出命令
    await invoke('export_proxies_to_csv', {
      path: filePath,
      proxies: exportItems,
      exportPlainPassword,
    });

    toast.success(`成功导出 ${proxies.length} 个代理`);
    return true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '导出失败');
    return false;
  }
}

/**
 * 导出代理数据（兼容旧接口）
 */
export async function exportProxies(
  proxies: Proxy[],
  range: ExportRange,
  selectedIds: Set<string>,
  filteredProxies: Proxy[]
): Promise<boolean> {
  const dataToExport = getProxiesToExport(proxies, range, selectedIds, filteredProxies);
  return exportProxiesToCSV(dataToExport);
}
