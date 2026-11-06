import { useTranslation } from 'react-i18next';
import { Download, Plus, Ban, Play, Info, SearchX, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ExtensionItem } from '../types';
import { ExtensionIcon } from './extension-icon';

interface LocalExtensionLibraryProps {
  extensions: ExtensionItem[];
  importing: boolean;
  onImport: () => void;
  onInstall: (extension: ExtensionItem) => void;
  onDisable: (extension: ExtensionItem) => void;
  onEnable: (extension: ExtensionItem) => void;
  onRemove: (extension: ExtensionItem) => void;
  onViewDetails: (extension: ExtensionItem) => void;
}

function LocalExtensionCard({
  extension,
  onInstall,
  onDisable,
  onEnable,
  onRemove,
  onViewDetails,
}: {
  extension: ExtensionItem;
  onInstall: (extension: ExtensionItem) => void;
  onDisable: (extension: ExtensionItem) => void;
  onEnable: (extension: ExtensionItem) => void;
  onRemove: (extension: ExtensionItem) => void;
  onViewDetails: (extension: ExtensionItem) => void;
}) {
  const { t } = useTranslation('extensions');

  const isActive = extension.status === 'active';
  const isDisabled = extension.status === 'disabled';
  const isInstalled = isActive || isDisabled;

  return (
    <div className="group relative bg-card border border-border/60 rounded-xl p-4 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 rounded-lg bg-muted/60 border border-border/50 flex items-center justify-center shrink-0 group-hover:border-primary/30 transition-colors">
          <ExtensionIcon
            icon={extension.icon}
            source={extension.source}
            containerClassName="h-9 w-9 rounded-md"
            imageClassName="rounded-md"
            fallbackClassName="h-6 w-6"
          />
        </div>
        <div className="flex-1 min-w-0 h-11 flex flex-col justify-between py-1">
          <div className="flex items-center gap-2">
            <h3 className="max-w-[180px] truncate font-semibold text-[13px] text-foreground">
              {extension.name}
            </h3>
            <span className="text-[9px] font-semibold uppercase tracking-wide border rounded px-1.5 py-0.5 border-sky-500/30 bg-sky-500/10 text-sky-600">
              {t('local.badge')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground/70">
              v{extension.version}
            </span>
            {extension.author && (
              <span className="text-[10px] text-muted-foreground truncate">{extension.author}</span>
            )}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground/80 line-clamp-2 mb-3 min-h-[32px] leading-relaxed">
        {extension.description || t('local.noDescription')}
      </p>

      <div className="flex items-center justify-between pt-3 border-t border-border/40 gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-[11px] rounded-md"
            onClick={() => onViewDetails(extension)}
          >
            <Info className="h-3 w-3 mr-1.5" />
            {t('table.actions.details')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-[11px] rounded-md text-destructive hover:text-destructive"
            onClick={() => onRemove(extension)}
          >
            <Trash2 className="h-3 w-3 mr-1.5" />
            {t('local.remove')}
          </Button>
        </div>

        {!isInstalled ? (
          <Button
            size="sm"
            className="h-7 px-3 text-[11px] rounded-md"
            onClick={() => onInstall(extension)}
          >
            <Download className="h-3 w-3 mr-1.5" />
            {t('local.install')}
          </Button>
        ) : isDisabled ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-3 text-[11px] rounded-md"
            onClick={() => onEnable(extension)}
          >
            <Play className="h-3 w-3 mr-1.5" />
            {t('table.actions.enable')}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-3 text-[11px] rounded-md"
            onClick={() => onDisable(extension)}
          >
            <Ban className="h-3 w-3 mr-1.5" />
            {t('table.actions.disable')}
          </Button>
        )}
      </div>
    </div>
  );
}

export function LocalExtensionLibrary({
  extensions,
  importing,
  onImport,
  onInstall,
  onDisable,
  onEnable,
  onRemove,
  onViewDetails,
}: LocalExtensionLibraryProps) {
  const { t } = useTranslation('extensions');

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="shrink-0 min-h-14 px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground leading-none">{t('local.title')}</div>
          <div className="text-[11px] text-muted-foreground leading-tight mt-1 line-clamp-1">
            {t('local.description')}
          </div>
        </div>
        <Button size="sm" className="ml-auto h-8 text-xs" onClick={onImport} disabled={importing}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {importing ? t('local.importing') : t('local.import')}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {extensions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-500/15 to-cyan-500/15 flex items-center justify-center mb-4">
              <SearchX className="h-8 w-8 text-sky-500/70" />
            </div>
            <h4 className="text-sm font-medium text-foreground mb-1">{t('local.empty')}</h4>
            <p className="text-xs text-muted-foreground max-w-[280px]">
              {t('local.emptyDescription')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
            {extensions.map((extension) => (
              <LocalExtensionCard
                key={extension.id}
                extension={extension}
                onInstall={onInstall}
                onDisable={onDisable}
                onEnable={onEnable}
                onRemove={onRemove}
                onViewDetails={onViewDetails}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
