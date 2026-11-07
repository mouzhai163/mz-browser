import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { SettingsTab } from '../types';

/**
 * 有效的设置标签列表
 */
const VALID_TABS: SettingsTab[] = ['general', 'browser', 'network', 'storage'];

interface UseSettingsTabsReturn {
  activeTab: SettingsTab;
  setActiveTab: (tab: SettingsTab) => void;
  handleTabChange: (tab: SettingsTab) => void;
}

/**
 * 系统设置 Tab 管理 Hook
 * 负责管理 Tab 状态和 URL 参数同步
 */
export function useSettingsTabs(): UseSettingsTabsReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  const menuParam = searchParams.get('menu');

  // 从 URL 参数获取当前标签，如果无效则默认为 'general'
  const currentTabFromUrl = useMemo((): SettingsTab => {
    if (menuParam && VALID_TABS.includes(menuParam as SettingsTab)) {
      return menuParam as SettingsTab;
    }
    return 'general';
  }, [menuParam]);

  const [activeTab, setActiveTab] = useState<SettingsTab>(currentTabFromUrl);

  // 同步 URL 参数和状态
  useEffect(() => {
    const newTab =
      menuParam && VALID_TABS.includes(menuParam as SettingsTab)
        ? (menuParam as SettingsTab)
        : 'general';

    // 使用函数式更新避免在 effect 中直接调用 setState
    setActiveTab((prev) => {
      if (newTab !== prev) {
        return newTab;
      }
      return prev;
    });

    if (!menuParam) {
      // 如果没有 menu 参数，添加默认参数
      setSearchParams({ menu: 'general' }, { replace: true });
    }
  }, [menuParam, setSearchParams]);

  // 处理标签切换
  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setSearchParams({ menu: tab }, { replace: true });
  };

  return {
    activeTab,
    setActiveTab,
    handleTabChange,
  };
}
