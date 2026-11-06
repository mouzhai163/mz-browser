import type { NavItem, SettingsTab } from '../types';

interface SettingsNavigationProps {
  navItems: NavItem[];
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

/**
 * 系统设置导航组件
 */
export const SettingsNavigation: React.FC<SettingsNavigationProps> = ({
  navItems,
  activeTab,
  onTabChange,
}) => {
  return (
    <nav className="flex-1 p-2 overflow-y-auto min-h-0">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            }`}
          >
            <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} />
            <span
              className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-foreground'}`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
