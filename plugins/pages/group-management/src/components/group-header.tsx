import { useState } from 'react';
import { Input } from '@/components/ui/input';
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
    <header className="border-b border-border flex items-center justify-between px-6 py-2 bg-background/10 backdrop-blur-2xl">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('header.searchPlaceholder')}
            value={searchValue}
            onChange={handleSearchChange}
            className="h-9 w-72 pl-8 text-xs"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={onCreateNew}
          className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 hover:bg-primary/90 transition-colors border border-primary rounded-md"
        >
          {t('header.create')}
        </button>
      </div>
    </header>
  );
}
