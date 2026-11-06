import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Upload, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface AccountHeaderProps {
  onSearchChange: (query: string) => void;
  onCreateNew: () => void;
  onImport: () => void;
  onExport: () => void;
}

export function AccountHeader({
  onSearchChange,
  onCreateNew,
  onImport,
  onExport,
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
    <header className="border-b border-border flex items-center justify-between px-6 py-2 bg-background/10 backdrop-blur-2xl">
      {/* 搜索框 */}
      <div className="relative w-72">
        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="text"
          placeholder={t('header.searchPlaceholder')}
          className="h-9 w-72 pl-8 text-xs"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* 导入按钮 */}
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={onImport}>
          <Upload className="h-3.5 w-3.5" />
          {t('header.import')}
        </Button>

        {/* 导出按钮 */}
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={onExport}>
          <Download className="h-3.5 w-3.5" />
          {t('header.export')}
        </Button>

        {/* 创建按钮 */}
        <Button size="sm" className="h-8 text-xs" onClick={onCreateNew}>
          {t('header.create')}
        </Button>
      </div>
    </header>
  );
}
