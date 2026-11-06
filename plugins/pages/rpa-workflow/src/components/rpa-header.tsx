import { useTranslation } from 'react-i18next';
import { Search, Plus, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface RpaHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onCreateTask: () => void;
  onImportTask: () => void;
}

export function RpaHeader({ searchQuery, onSearchChange, onCreateTask, onImportTask }: RpaHeaderProps) {
  const { t } = useTranslation('rpa');

  return (
    <div className="border-b border-border flex items-center justify-between px-6 py-2 bg-background/10 backdrop-blur-2xl">
      <div className="relative w-72">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('header.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 w-72 pl-8 text-xs"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={onImportTask}>
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {t('header.importTask', { defaultValue: '导入' })}
        </Button>
        <Button size="sm" className="h-8 px-4 text-xs" onClick={onCreateTask}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t('header.createTask')}
        </Button>
      </div>
    </div>
  );
}
