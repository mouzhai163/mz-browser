import { useTranslation } from 'react-i18next';
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { X } from 'lucide-react';
import { useSettingsDialogStore } from '../../../../services/store/src';
import { getNavItems } from '../config';
import { AccountPanel } from './account-panel';
import { GeneralPanel } from './general-panel';
import { BrowserPanel } from './browser-panel';
import { NetworkPanel } from './network-panel';
import { StoragePanel } from './storage-panel';
import type { SettingsTab } from '../types';

/**
 * 系统设置弹窗组件
 */
export function SettingsDialog() {
  const { t } = useTranslation('settings');
  const { isOpen, activeTab, close, setActiveTab } = useSettingsDialogStore();
  const navItems = getNavItems(t);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
  };

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
    <Drawer open={isOpen} onOpenChange={(open) => !open && close()} direction="bottom">
      <DrawerContent className="data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-[100dvh] h-[100dvh] max-h-[100dvh] rounded-none border-0 bg-background/98">
        <DrawerTitle className="sr-only">{t('pageTitle')}</DrawerTitle>

        <div className="mx-auto flex h-full w-full max-w-[1200px] flex-col overflow-hidden px-4 pb-4 pt-2 sm:px-6">
          <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-4 pt-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                System Settings
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">
                {t('pageTitle')}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{t('pageDescription')}</p>
            </div>

            <DrawerClose asChild>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
                aria-label={t('cancel')}
              >
                <X className="h-4 w-4" />
              </button>
            </DrawerClose>
          </div>

          <nav className="mx-auto mt-4 flex w-full max-w-[880px] items-center justify-center gap-0 overflow-x-auto border-b border-border/60 pb-3">
            {navItems.map((item, index) => {
              const isActive = activeTab === item.id;
              return (
                <div key={item.id} className="flex items-center">
                  <button
                    onClick={() => handleTabChange(item.id)}
                    className={`relative inline-flex min-h-10 items-center justify-center whitespace-nowrap px-4 pb-3 text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {item.label}
                    <span
                      className={`absolute bottom-0 left-4 right-4 h-[3px] rounded-full bg-gradient-to-r from-primary to-sky-600 transition-opacity ${
                        isActive ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  </button>
                  {index < navItems.length - 1 ? (
                    <span className="mb-3 h-3.5 w-px bg-border/70" aria-hidden="true" />
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto pt-4">
            <div className="mx-auto w-full max-w-[880px]">{renderPanel()}</div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
