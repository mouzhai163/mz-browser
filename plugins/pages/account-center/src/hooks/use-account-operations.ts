import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { AccountFormData } from '../types';
import {
  createAccount,
  updateAccount,
  deleteAccount,
  batchDeleteAccounts,
  batchImportAccounts,
} from '../api';

function getPlatformNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export function useAccountOperations(onRefresh?: () => void) {
  const [submitting, setSubmitting] = useState(false);

  const create = useCallback(
    async (formData: AccountFormData): Promise<string> => {
      setSubmitting(true);
      try {
        const uuid = await createAccount({
          platform_url: formData.platform,
          platform_name: getPlatformNameFromUrl(formData.platform),
          account: formData.account,
          password: formData.password || undefined,
          remark: formData.remark || undefined,
        });
        toast.success('创建账号成功');
        onRefresh?.();
        return uuid;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '创建账号失败');
        throw e;
      } finally {
        setSubmitting(false);
      }
    },
    [onRefresh]
  );

  const update = useCallback(
    async (uuid: string, formData: AccountFormData): Promise<void> => {
      setSubmitting(true);
      try {
        await updateAccount({
          uuid,
          platform_url: formData.platform,
          platform_name: getPlatformNameFromUrl(formData.platform),
          account: formData.account,
          password: formData.password || undefined,
          remark: formData.remark || undefined,
        });
        toast.success('更新账号成功');
        onRefresh?.();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '更新账号失败');
        throw e;
      } finally {
        setSubmitting(false);
      }
    },
    [onRefresh]
  );

  const remove = useCallback(
    async (uuid: string): Promise<void> => {
      setSubmitting(true);
      try {
        await deleteAccount(uuid);
        toast.success('删除账号成功');
        onRefresh?.();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '删除账号失败');
        throw e;
      } finally {
        setSubmitting(false);
      }
    },
    [onRefresh]
  );

  const batchRemove = useCallback(
    async (uuids: string[]): Promise<void> => {
      setSubmitting(true);
      try {
        await batchDeleteAccounts(uuids);
        toast.success(`成功删除 ${uuids.length} 个账号`);
        onRefresh?.();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '批量删除账号失败');
        throw e;
      } finally {
        setSubmitting(false);
      }
    },
    [onRefresh]
  );

  const batchImport = useCallback(
    async (accounts: AccountFormData[]): Promise<number> => {
      setSubmitting(true);
      try {
        const result = await batchImportAccounts(
          accounts.map((a) => ({
            platform_url: a.platform,
            platform_name: getPlatformNameFromUrl(a.platform),
            account: a.account,
            password: a.password || undefined,
            remark: a.remark || undefined,
          }))
        );
        toast.success(`成功导入 ${result.success_count} 个账号`);
        onRefresh?.();
        return result.success_count;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '批量导入账号失败');
        throw e;
      } finally {
        setSubmitting(false);
      }
    },
    [onRefresh]
  );

  return {
    submitting,
    createAccount: create,
    updateAccount: update,
    deleteAccount: remove,
    batchDeleteAccounts: batchRemove,
    importAccounts: batchImport,
  };
}
