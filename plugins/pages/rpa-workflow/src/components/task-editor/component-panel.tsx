import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { COMPONENTS } from '../../lib/step-catalog';

const CATEGORIES = ['browser', 'flow', 'data', 'advanced'] as const;

export function ComponentPanel({ onAdd }: { onAdd: (type: string) => void }) {
  const { t } = useTranslation('rpa');
  const [keyword, setKeyword] = useState('');
  const query = keyword.trim().toLowerCase();

  return (
    <div className="flex min-h-0 w-52 flex-col overflow-hidden border-r border-border bg-background">
      <div className="shrink-0 border-b border-border px-3 py-2">
        <h3 className="text-xs font-semibold text-foreground">{t('editor.components')}</h3>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t('editor.searchComponents')}
            className="h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
          />
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-2">
          {CATEGORIES.map((category) => {
            const items = COMPONENTS.filter((item) => {
              if (item.category !== category) return false;
              if (!query) return true;
              return (
                t(`editor.stepTypes.${item.type}`).toLowerCase().includes(query) ||
                t(`editor.stepHints.${item.type}`).toLowerCase().includes(query)
              );
            });
            if (items.length === 0) return null;
            return (
              <div key={category}>
                <div className="px-2 py-1 text-xs text-muted-foreground">{t(`editor.categories.${category}`)}</div>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <button
                      type="button"
                      key={item.type}
                      data-testid={`rpa-add-${item.type}`}
                      onClick={() => onAdd(item.type)}
                      title={t(`editor.stepHints.${item.type}`)}
                      className="group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-accent"
                    >
                      <item.icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                      <span className="text-xs text-muted-foreground group-hover:text-foreground">
                        {t(`editor.stepTypes.${item.type}`)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
