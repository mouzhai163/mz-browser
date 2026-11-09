import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Upload, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageTitle } from '@/components/page-title';

interface AccountHeaderProps {
  onSearchChange: (query: string) => void;
  onCreateNew: () => void;
  onImport: () => void;
  onExport: () => void;
  /** 放在页头和搜索栏之间（统计卡片） */
  children?: ReactNode;
}

export function AccountHeader({
  onSearchChange,
  onCreateNew,
  onImport,
  onExport,
  children,
}: AccountHeaderProps) {
  const { t } = useTranslation('account');
  const [searchValue, setSearchValue] = useState('');
  const searchChangeRef = useRef(onSearchChange);

  useEffect(() => {
    searchChangeRef.current = onSearchChange;
  }, [onSearchChange]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      searchChangeRef.current(searchValue);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchValue]);

  return (
    <header className="space-y-4 px-6 pb-3 pt-5">
      <PageTitle
        title={t('header.title', { defaultValue: '账号管理' })}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={onImport}>
              <Upload className="h-4 w-4" />
              {t('header.import')}
            </Button>
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="h-4 w-4" />
              {t('header.export')}
            </Button>
            <Button size="sm" onClick={onCreateNew}>
              {t('header.create')}
            </Button>
          </>
        }
      />

      {children}

      <div className="relative w-72">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={t('header.searchPlaceholder')}
          className="h-8 w-72 bg-card pl-8 text-[13px]"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
        />
      </div>
    </header>
  );
}
