/**
 * 存储管理 API（调用 Tauri 命令）
 */
import { invoke } from '@/lib/tauri';

export interface StoragePathsResponse {
  app_base: string;
  profiles: string;
  cache: string;
  logs: string;
  downloads: string;
}

export async function getStorageDefaultPaths(): Promise<StoragePathsResponse> {
  return invoke<StoragePathsResponse>('get_storage_default_paths');
}

export interface GetDirectorySizesRequest {
  paths: string[];
}

export interface GetDirectorySizesResponse {
  sizes: number[];
}

export async function getDirectorySizes(
  paths: string[]
): Promise<GetDirectorySizesResponse> {
  return invoke<GetDirectorySizesResponse>('get_directory_sizes', {
    request: { paths },
  });
}
