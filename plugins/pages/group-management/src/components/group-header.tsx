import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageTitle } from '@/components/page-title';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

interface GroupHeaderProps {
  onSearchChange?: (value: string) => void;
  onCreateNew?: () => void;
}

export function GroupHeader({ onSearchChange, onCreateNew }: GroupHeaderProps) {
  const { t } = useTranslation('groups');
  const [searchValue, setSearchValue] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    onSearchChange?.(value);
  };

  return (
    <header className="space-y-4 px-6 pb-3 pt-5">
      <PageTitle
        title={t('header.title', { defaultValue: '分组管理' })}
        actions={
          <Button size="sm" onClick={onCreateNew}>
            {t('header.create')}
          </Button>
        }
      />
      <div className="relative w-72">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={t('header.searchPlaceholder')}
          value={searchValue}
          onChange={handleSearchChange}
          className="h-8 w-72 bg-card pl-8 text-[13px]"
        />
      </div>
    </header>
  );
}
