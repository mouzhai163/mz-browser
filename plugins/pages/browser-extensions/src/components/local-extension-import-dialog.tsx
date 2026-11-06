import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import { FolderOpen, Plus, Upload, X } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TextareaInput } from '@/components/textarea-input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ImportMode = 'file' | 'storeUrl';

interface LocalExtensionImportDialogProps {
  open: boolean;
  importing: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: { mode: ImportMode; crxPath?: string; storeUrl?: string }) => Promise<void>;
}

export function LocalExtensionImportDialog({
  open,
  importing,
  onOpenChange,
  onSubmit,
}: LocalExtensionImportDialogProps) {
  const { t } = useTranslation('extensions');
  const [mode, setMode] = useState<ImportMode>('file');
  const [crxPath, setCrxPath] = useState('');
  const [storeUrl, setStoreUrl] = useState('');

  const canSubmit = useMemo(() => {
    if (importing) {
      return false;
    }
    return mode === 'file' ? crxPath.trim().length > 0 : storeUrl.trim().length > 0;
  }, [crxPath, importing, mode, storeUrl]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setMode('file');
      setCrxPath('');
      setStoreUrl('');
    }
    onOpenChange(nextOpen);
  };

  const handlePickCrx = async () => {
    const selected = await openFileDialog({
      multiple: false,
      filters: [{ name: 'Chrome Extension', extensions: ['crx'] }],
    });

    if (!selected || Array.isArray(selected)) {
      return;
    }

    setCrxPath(selected);
  };
  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    await onSubmit(
      mode === 'file' ? { mode, crxPath: crxPath.trim() } : { mode, storeUrl: storeUrl.trim() }
    );
  };

  return (
    <FormattedDialog
      open={open}
      onOpenChange={handleOpenChange}
      minWidth="min-w-[560px]"
      header={{
        icon: Plus,
        iconColor: 'text-sky-600',
        title: t('dialog.localImport.title'),
        description: t('dialog.localImport.description'),
        gradient: 'bg-gradient-to-r from-sky-500/10 via-cyan-500/10 to-sky-500/10',
        className: 'border-b border-sky-500/20',
      }}
      contentPadding="p-5"
    >
      <div className="space-y-4">
        <Tabs value={mode} onValueChange={(value) => setMode(value as ImportMode)}>
          <TabsList className="h-9 bg-secondary w-full grid grid-cols-2">
            <TabsTrigger value="file" className="text-xs">
              {t('dialog.localImport.mode.file')}
            </TabsTrigger>
            <TabsTrigger value="storeUrl" className="text-xs">
              {t('dialog.localImport.mode.storeUrl')}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === 'file' ? (
          <div className="space-y-2">
            <Label htmlFor="local-extension-crx">{t('dialog.localImport.crxLabel')}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="local-extension-crx"
                value={crxPath}
                readOnly
                placeholder={t('dialog.localImport.crxPlaceholder')}
              />
              <Button type="button" variant="outline" onClick={() => void handlePickCrx()}>
                <FolderOpen className="h-4 w-4 mr-1.5" />
                {t('dialog.localImport.browse')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="local-extension-store-url">
              {t('dialog.localImport.storeUrlLabel')}
            </Label>
            <TextareaInput
              id="local-extension-store-url"
              value={storeUrl}
              onChange={(event) => setStoreUrl(event.target.value)}
              placeholder={t('dialog.localImport.storeUrlPlaceholder')}
            />
          </div>
        )}
      </div>

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleOpenChange(false)}
          disabled={importing}
        >
          <X className="h-4 w-4 mr-1.5" />
          {t('dialog.localImport.cancel')}
        </Button>
        <Button size="sm" onClick={() => void handleSubmit()} disabled={!canSubmit}>
          <Upload className="h-4 w-4 mr-1.5" />
          {importing ? t('dialog.localImport.importing') : t('dialog.localImport.confirm')}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
