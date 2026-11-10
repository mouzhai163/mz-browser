import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, type NavigateFunction } from 'react-router';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { listBrowserKernels } from '../../../../pages/create-window/src/api';

/** 软件打开后等这么久再查，不和启动时的其他请求抢 */
const CHECK_DELAY_MS = 5000;

// 布局在切换页面时会重新挂载，所以“查过没有”不能放在组件状态里：整个软件运行期间只查一次
let scheduled = false;
const latest: { navigate: NavigateFunction | null; t: TFunction<'appLayout'> | null } = {
  navigate: null,
  t: null,
};

async function checkOnce() {
  try {
    const groups = await listBrowserKernels('windows');
    const outdated = Object.values(groups)
      .flat()
      .filter((kernel) => kernel.installed && kernel.update_available);
    const t = latest.t;
    if (outdated.length === 0 || !t) return;
    toast.info(t('kernelUpdate.available', { count: outdated.length }), {
      description: outdated.map((kernel) => kernel.resource_name).join('、'),
      duration: 10000,
      action: {
        label: t('kernelUpdate.open'),
        onClick: () => latest.navigate?.('/settings?menu=browser'),
      },
    });
  } catch {
    // 查不到就不提醒，不影响使用
  }
}

/**
 * 软件打开 5 秒后检查一次：已安装的内核有新版本就提醒一次。
 * 只提醒、不更新——启动环境时也不会自动更新内核，用户在 设置 → 浏览器 里自己点“更新”。
 */
export function KernelUpdateNotifier() {
  const { t } = useTranslation('appLayout');
  const navigate = useNavigate();

  useEffect(() => {
    latest.navigate = navigate;
    latest.t = t;
  }, [navigate, t]);

  useEffect(() => {
    if (scheduled) return;
    scheduled = true;
    // 不随组件卸载取消：切换页面时布局会重新挂载，计时要从软件打开时算
    window.setTimeout(() => void checkOnce(), CHECK_DELAY_MS);
  }, []);

  return null;
}
