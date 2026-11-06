import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Download, Search } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
      <header className="border-b border-border flex items-center justify-between px-4 py-2 bg-background/10 backdrop-blur-2xl">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-xl bg-secondary p-1">
          <button
            type="button"
            onClick={() => onModeChange?.('remote')}
            className={cn(
              'rounded-xl px-3 py-1.5 text-xs transition-all duration-200',
              mode === 'remote'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {t('header.modeRemote', { defaultValue: '代理' })}
          </button>
          <button
            type="button"
            onClick={() => onModeChange?.('local')}
            className={cn(
              'rounded-xl px-3 py-1.5 text-xs transition-all duration-200',
              mode === 'local'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {t('header.modeLocal', { defaultValue: '本地代理' })}
          </button>
        </div>
        <div className="hidden items-center rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 md:flex dark:text-amber-400">
          {t('header.experimentalHint', { defaultValue: '实验性功能 · clash-verge可用' })}
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSearchDialogOpen(true)}
          className="flex h-8 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={t('header.search', { defaultValue: '搜索' })}
        >
          <Search className="h-4 w-4" />
          <div className="h-3 w-px bg-border" />
          <span className="text-[10px] font-medium opacity-60">Ctrl+K</span>
        </button>
        {mode === 'local' && (
          <>
            <div className="h-4 w-px bg-border" />
            <button
              type="button"
              onClick={handleOpenMihomo}
              className={cn(
                'relative flex h-8 w-8 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors',
                mihomoStatusTone === 'connected' &&
                  'border-emerald-500/30 text-emerald-600 hover:bg-muted hover:text-foreground',
                mihomoStatusTone === 'warning' &&
                  'border-amber-500/30 text-amber-600 hover:bg-muted hover:text-foreground',
                mihomoStatusTone === 'offline' &&
                  'border-rose-500/30 text-rose-600 hover:bg-muted hover:text-rose-600'
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
              {mihomoStatusTone === 'connected' ? (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
              ) : mihomoStatusTone === 'warning' ? (
                <span className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold leading-none text-white">
                  !
                </span>
              ) : (
                <span className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold leading-none text-white">
                  !
                </span>
              )}
            </button>
          </>
        )}
        {mode === 'remote' && (
          <>
            <button
              onClick={onImport}
              className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={t('header.import')}
            >
              <Upload className="h-3.5 w-3.5" />
              {t('header.import')}
            </button>
            <button
              onClick={onExport}
              className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={t('header.export')}
            >
              <Download className="h-3.5 w-3.5" />
              {t('header.export')}
            </button>
            <button
              onClick={onCreateNew}
              className="h-8 rounded-md border border-primary bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t('header.create')}
            </button>
          </>
        )}
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
