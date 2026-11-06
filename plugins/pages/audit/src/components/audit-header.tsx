import { useEffect, useRef, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useTranslation } from 'react-i18next';
import type { AuditLog } from '../api';
import { AuditExportDialog } from './audit-export-dialog';

interface AuditHeaderProps {
  logs: AuditLog[];
  onSearchChange?: (value: string) => void;
}

export function AuditHeader({ logs, onSearchChange }: AuditHeaderProps) {
  const { t } = useTranslation('audit');
  const [searchValue, setSearchValue] = useState('');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const searchChangeRef = useRef(onSearchChange);

  useEffect(() => {
    searchChangeRef.current = onSearchChange;
  }, [onSearchChange]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      searchChangeRef.current?.(searchValue);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchValue]);

  return (
    <>
      <header className="border-b border-border flex items-center justify-between px-6 py-2 bg-background/10 backdrop-blur-2xl">
        <div className="flex items-center gap-4">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t('header.searchPlaceholder')}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="h-9 w-72 pl-8 text-xs"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExportDialogOpen(true)}
            className="h-8 px-3 flex items-center justify-center gap-2 rounded-md border border-border bg-background hover:bg-muted transition-colors text-muted-foreground hover:text-foreground text-xs font-medium"
          >
            <Download className="h-4 w-4" />
            {t('header.export')}
          </button>
        </div>
      </header>

      <AuditExportDialog open={exportDialogOpen} logs={logs} onOpenChange={setExportDialogOpen} />
    </>
  );
}
