import { useState } from 'react';
import { Eye, EyeOff, Copy, RefreshCw, Circle, AlertTriangle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';

interface ApiKeyDisplayProps {
  apiKey: string;
  onCopy: () => void;
  onReset: () => void;
  resetting: boolean;
}

export function ApiKeyDisplay({
  apiKey,
  onCopy,
  onReset,
  resetting,
}: ApiKeyDisplayProps) {
  const { t } = useTranslation('apiConsole');
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy();
    } catch {
      toast.error(t('errors.copyFailed'));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-foreground">{t('service.apiKey')}</label>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setApiKeyVisible(!apiKeyVisible)}
            className="p-1.5 hover:bg-muted rounded transition-colors"
            title={apiKeyVisible ? t('service.hideKey') : t('service.showKey')}
          >
            {apiKeyVisible ? (
              <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <Eye className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-muted rounded transition-colors"
            title={t('service.copyKey')}
          >
            {copied ? (
              <span className="text-xs text-emerald-500">✓</span>
            ) : (
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={() => setResetDialogOpen(true)}
            disabled={resetting}
            className="p-1.5 hover:bg-muted rounded transition-colors disabled:opacity-60"
            title={t('service.resetKey')}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-muted-foreground ${resetting ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>
      <div className="bg-muted rounded border border-border">
        <div className="px-3 h-12 flex items-center">
          {apiKeyVisible ? (
            <span className="text-xs font-mono text-foreground select-all break-all leading-5">
              {apiKey}
            </span>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              {Array.from({ length: 32 }).map((_, i) => (
                <Circle key={i} className="w-2 h-2 fill-foreground text-foreground" />
              ))}
            </div>
          )}
        </div>
      </div>

      <FormattedDialog
        open={resetDialogOpen}
        onOpenChange={(open) => {
          if (!resetting) {
            setResetDialogOpen(open);
          }
        }}
        minWidth="min-w-[440px]"
        header={{
          icon: AlertTriangle,
          iconColor: 'text-destructive',
          title: t('confirm.resetKeyTitle'),
          description: t('confirm.resetKey'),
          gradient: 'bg-gradient-to-r from-red-500/10 via-rose-500/10 to-red-500/10',
          className: 'border-b border-destructive/20',
        }}
        contentPadding="p-5"
      >
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
          <p className="text-xs font-medium text-destructive">{t('confirm.warningTitle')}</p>
          <p className="mt-1 text-xs text-destructive/90">{t('confirm.warningDescription')}</p>
        </div>

        <FormattedDialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setResetDialogOpen(false)}
            disabled={resetting}
          >
            <X className="h-4 w-4 mr-1.5" />
            {t('confirm.cancel')}
          </Button>
          <Button variant="destructive" size="sm" onClick={onReset} disabled={resetting}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${resetting ? 'animate-spin' : ''}`} />
            {t('confirm.confirm')}
          </Button>
        </FormattedDialogFooter>
      </FormattedDialog>
    </div>
  );
}
