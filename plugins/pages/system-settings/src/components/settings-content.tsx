import { ScrollArea } from '@/components/ui/scroll-area';
import { AccountPanel, GeneralPanel, BrowserPanel, NetworkPanel, StoragePanel } from './index';
import type { SettingsTab } from '../types';

interface SettingsContentProps {
  activeTab: SettingsTab;
}

/**
 * 系统设置内容区域组件
 */
export const SettingsContent: React.FC<SettingsContentProps> = ({ activeTab }) => {
  const renderPanel = () => {
    switch (activeTab) {
      case 'account':
        return <AccountPanel />;
      case 'general':
        return <GeneralPanel />;
      case 'browser':
        return <BrowserPanel />;
      case 'network':
        return <NetworkPanel />;
      case 'storage':
        return <StoragePanel />;
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 min-h-0">
      <ScrollArea className="h-full w-full">
        <div className="p-6">{renderPanel()}</div>
      </ScrollArea>
    </div>
  );
};
