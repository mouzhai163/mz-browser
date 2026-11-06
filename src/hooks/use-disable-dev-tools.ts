import { useEffect } from 'react';

/**
 * 禁止右键菜单和一些快捷键
 * 仅在 production 环境下启用
 */
export function useDisableDevTools() {
  useEffect(() => {
    // 仅在生产环境启用
    if (!import.meta.env.PROD) {
      return;
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      if (e.key === 'F5' || (e.ctrlKey && (e.key === 'R' || e.key === 'r'))) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    document.addEventListener('contextmenu', handleContextMenu, { capture: true });
    document.addEventListener('keydown', handleKeyDown, { capture: true });

    // 清理函数：移除事件监听器
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, []);
}
