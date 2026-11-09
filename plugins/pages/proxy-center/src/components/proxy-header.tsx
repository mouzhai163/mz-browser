import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Download, Search } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageTitle } from '@/components/page-title';
import { useMihomoRuntimeStore } from '../../../../services/store/src';
import { ClashIcon } from '../mihomo/clash-icon';

interface ProxyHeaderProps {
  mode?: 'remote' | 'local';
  searchValue?: string;
  mihomoAttached?: boolean;
  onModeChange?: (mode: 'remote' | 'local') => void;
  onSearchChange?: (value: string) => void;
  onOpenMihomo?: () => void;
  onCreateNew?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  /** 放在页头和工具栏之间（统计卡片） */
  children?: ReactNode;
}

export function ProxyHeader({
  mode = 'remote',
  searchValue = '',
  mihomoAttached = false,
  onModeChange,
  onSearchChange,
  onOpenMihomo,
  onCreateNew,
  onImport,
  onExport,
  children,
}: ProxyHeaderProps) {
  const { t } = useTranslation('proxy');
  const mihomoRunning = useMihomoRuntimeStore((state) => state.running);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const searchChangeRef = useRef(onSearchChange);
  const inputRef = useRef<HTMLInputElement>(null);
  const mihomoStatusTone = mihomoRunning
    ? mihomoAttached
      ? 'connected'
      : 'warning'
    : 'offline';

  const handleOpenMihomo = () => {
    if (!mihomoRunning) {
      toast.info(
        t('header.mihomoUnavailableHint', {
          defaultValue: '当前未检测到可用的 Mihomo/Clash 核心，请先启动代理核心。',
        })
      );
      return;
    }

    onOpenMihomo?.();
  };

  useEffect(() => {
    searchChangeRef.current = onSearchChange;
  }, [onSearchChange]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        setSearchDialogOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (searchDialogOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [searchDialogOpen]);

  return (
    <>
      <header className="space-y-4 px-6 pb-3 pt-5">
        <PageTitle
          title={t('header.title', { defaultValue: '代理中心' })}
          actions={
            mode === 'remote' ? (
              <>
                <Button variant="outline" size="sm" onClick={onImport} title={t('header.import')}>
                  <Upload className="h-4 w-4" />
                  {t('header.import')}
                </Button>
                <Button variant="outline" size="sm" onClick={onExport} title={t('header.export')}>
                  <Download className="h-4 w-4" />
                  {t('header.export')}
                </Button>
                <Button size="sm" onClick={onCreateNew}>
                  {t('header.create')}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenMihomo}
                className={cn(
                  mihomoStatusTone === 'connected' && 'border-success/40 text-success',
                  mihomoStatusTone === 'warning' && 'border-warning/40 text-warning',
                  mihomoStatusTone === 'offline' && 'border-destructive/40 text-destructive'
                )}
                title={
                  mihomoStatusTone === 'connected'
                    ? t('header.mihomoConnected', { defaultValue: 'Mihomo 已连接' })
                    : mihomoStatusTone === 'warning'
                      ? t('header.mihomoNotConnected', { defaultValue: 'Mihomo 未连接' })
                      : t('header.mihomoUnavailableHint', {
                          defaultValue: '当前未检测到可用的 Mihomo/Clash 核心，请先启动代理核心。',
                        })
                }
              >
                <ClashIcon className="h-4 w-4 text-current" aria-hidden="true" />
                Mihomo
              </Button>
            )
          }
        />

        {children}

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="inline-flex gap-0.5 rounded-md bg-black/[0.04] p-0.5 dark:bg-white/[0.08]">
              {(['remote', 'local'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onModeChange?.(value)}
                  className={cn(
                    'h-7 rounded px-3 text-[13px] transition-colors',
                    mode === value ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {value === 'remote'
                    ? t('header.modeRemote', { defaultValue: '代理' })
                    : t('header.modeLocal', { defaultValue: '本地代理' })}
                </button>
              ))}
            </div>
            <span className="rounded border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs text-warning">
              {t('header.experimentalHint', { defaultValue: '实验性功能 · clash-verge可用' })}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSearchDialogOpen(true)}
            className="flex h-8 w-72 items-center gap-2 rounded-md border border-input bg-card px-3 text-[13px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            title={t('header.search', { defaultValue: '搜索' })}
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">{t('header.searchPlaceholder')}</span>
            <span className="text-[10px] opacity-60">Ctrl+K</span>
          </button>
        </div>
      </header>

      <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
        <DialogContent
          className="top-1/6 max-w-2xl gap-0 overflow-hidden border-0 bg-background/95 p-0 shadow-2xl backdrop-blur-2xl"
          showCloseButton={false}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder={t('header.searchPlaceholder')}
              value={searchValue}
              onChange={(e) => searchChangeRef.current?.(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape' || event.key === 'Enter') {
                  setSearchDialogOpen(false);
                }
              }}
              className="h-16 border-0 bg-transparent pl-12 pr-4 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
