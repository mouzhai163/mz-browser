import { open, save } from '@tauri-apps/plugin-dialog';
import i18n from 'i18next';
import { stripBom } from '@/lib/csv';
import { invoke } from '@/lib/tauri';
import { exportEnvironments } from '../api';

/** 环境备份文件的格式标识，和后端 environment_transfer::FORMAT 一致 */
export const ENVIRONMENT_BUNDLE_FORMAT = 'mz-browser-environments';
const SUPPORTED_SCHEMA_VERSION = 1;

export interface EnvironmentBundle {
  format: string;
  schema_version: number;
  exported_at?: string | null;
  /** 带了代理密码、账号密码和 Cookie（明文） */
  includes_secrets: boolean;
  environments: Array<{ source_uuid: string; name: string } & Record<string, unknown>>;
}

export interface ImportedEnvironment {
  uuid: string;
  name: string;
  /** 沿用了原来的环境 ID，指纹和原环境完全一样 */
  kept_identity: boolean;
}

const translate = (key: string, options?: Record<string, unknown>) =>
  i18n.getFixedT(null, 'environment')(key, options) as string;

export function isEnvironmentBundle(value: unknown): value is EnvironmentBundle {
  const bundle = value as Partial<EnvironmentBundle> | null;
  return !!bundle && bundle.format === ENVIRONMENT_BUNDLE_FORMAT && Array.isArray(bundle.environments);
}

/** 解析备份文件。格式不对、版本太新、没有环境时抛出可以直接显示的错误 */
export function parseEnvironmentBundle(content: string): EnvironmentBundle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripBom(content));
  } catch {
    throw new Error(translate('dialog.import.invalidFile'));
  }
  if (!isEnvironmentBundle(parsed)) throw new Error(translate('dialog.import.invalidFile'));
  if (typeof parsed.schema_version !== 'number' || parsed.schema_version > SUPPORTED_SCHEMA_VERSION) {
    throw new Error(translate('dialog.import.tooNew'));
  }
  if (parsed.environments.length === 0) throw new Error(translate('dialog.import.empty'));
  return parsed;
}

/** 让用户选一个备份文件并读出来；取消时返回 null */
export async function pickEnvironmentBundle(): Promise<EnvironmentBundle | null> {
  const selected = await open({ multiple: false, directory: false, filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (!selected || Array.isArray(selected)) return null;
  const content = await invoke<string>('read_text_file', { path: selected });
  return parseEnvironmentBundle(content);
}

/** 导出完整备份。返回是否写入了文件（用户取消时为 false） */
export async function exportEnvironmentBundle(uuids: string[], includeSecrets: boolean): Promise<boolean> {
  const bundle = await exportEnvironments({ uuids, include_secrets: includeSecrets });
  const filePath = await save({
    defaultPath: `environments-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (!filePath) return false;
  await invoke('write_text_file', { path: filePath, content: JSON.stringify(bundle, null, 2) });
  return true;
}
