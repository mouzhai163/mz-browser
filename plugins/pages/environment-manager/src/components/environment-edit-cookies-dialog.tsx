import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, Loader2, X, Cookie } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TextareaInput } from '@/components/textarea-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useEnvironmentDialogStore } from '../stores';
import {
  getEnvironmentCookies,
  addEnvironmentCookies,
  clearEnvironmentCookies,
  type CookieGroupItem,
} from '../api';

interface EnvironmentEditCookiesDialogProps {
  onComplete?: () => void;
}

export function EnvironmentEditCookiesDialog({ onComplete }: EnvironmentEditCookiesDialogProps) {
  const { t } = useTranslation('environment');
  const dialogStore = useEnvironmentDialogStore();
  const [cookies, setCookies] = useState<CookieGroupItem[]>([]);
  const [site, setSite] = useState('');
  const [cookieText, setCookieText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dialogStore.editCookiesEnvironment && dialogStore.editCookiesDialogOpen) {
      loadCookies();
    }
  }, [dialogStore.editCookiesEnvironment, dialogStore.editCookiesDialogOpen]);

  const loadCookies = async () => {
    if (!dialogStore.editCookiesEnvironment) return;

    setLoading(true);
    try {
      const result = await getEnvironmentCookies(dialogStore.editCookiesEnvironment.uuid);
      setCookies(result);
    } catch (e) {
      console.error('Failed to load cookies:', e);
      setCookies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCookieGroup = () => {
    const normalizedSite = site.trim();
    const normalizedCookieText = cookieText.trim();

    if (!normalizedSite) {
      setError('请输入目标网页或域名');
      return;
    }

    if (!normalizedCookieText) {
      setError('请输入 Cookie');
      return;
    }

    setCookies((prev) => [
      ...prev,
      {
        site: normalizedSite,
        cookie_text: normalizedCookieText,
      },
    ]);
    setSite('');
    setCookieText('');
    setError('');
  };

  const handleRemoveCookie = (index: number) => {
    setCookies((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!dialogStore.editCookiesEnvironment) return;

    setSaving(true);
    try {
      const uuid = dialogStore.editCookiesEnvironment.uuid;
      await clearEnvironmentCookies(uuid);

      if (cookies.length > 0) {
        await addEnvironmentCookies(uuid, cookies);
      }

      dialogStore.closeEditCookiesDialog();
      toast.success(t('dialog.editCookies.success'));
      onComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('dialog.editCookies.failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setCookies([]);
    setSite('');
    setCookieText('');
    setError('');
    dialogStore.closeEditCookiesDialog();
  };

  if (!dialogStore.editCookiesEnvironment) return null;

  return (
    <FormattedDialog
      open={dialogStore.editCookiesDialogOpen && !!dialogStore.editCookiesEnvironment}
      onOpenChange={(open) => {
        dialogStore.setEditCookiesDialogOpen(open);
        if (!open) {
          handleClose();
        }
      }}
      minWidth="min-w-[680px]"
      header={{
        icon: Cookie,
        title: t('dialog.editCookies.title'),
        description: t('dialog.editCookies.description'),
      }}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">目标网页/域名</Label>
          <Input
            value={site}
            onChange={(e) => {
              setSite(e.target.value);
              setError('');
            }}
            placeholder="https://www.google.com 或 .google.com"
            disabled={saving || loading}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">
            {t('dialog.editCookies.addCookie')}
          </Label>
          <div className="relative">
            <TextareaInput
              value={cookieText}
              onChange={(e) => {
                setCookieText(e.target.value);
                setError('');
              }}
              placeholder="SID=xxx; HSID=yyy"
              className="min-h-[96px] pr-14 pb-12 text-sm font-mono"
              disabled={saving || loading}
            />
            <Button
              type="button"
              size="icon"
              onClick={handleAddCookieGroup}
              disabled={saving || loading}
              className="absolute right-3 bottom-3 h-9 w-9 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
          {error ? <p className="text-[10px] text-destructive">{error}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">
            {t('dialog.editCookies.cookiesList')} ({cookies.length})
          </Label>
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground border border-border/50 rounded-md">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm">{t('dialog.editCookies.loading')}</span>
            </div>
          ) : cookies.length > 0 ? (
            <ScrollArea className="h-[260px] border border-border/50 rounded-md">
              <div className="p-2 space-y-2">
                {cookies.map((cookie, index) => (
                  <div key={`${cookie.site}-${index}`} className="flex items-start gap-1">
                    <div className="flex-1 rounded bg-muted px-2 py-1.5 text-xs">
                      <div className="truncate font-medium">{cookie.site}</div>
                      <div className="whitespace-pre-wrap break-all font-mono text-muted-foreground">
                        {cookie.cookie_text}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => handleRemoveCookie(index)}
                      disabled={saving || loading}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="h-32 px-4 flex items-center justify-center text-sm text-muted-foreground bg-muted/30 border border-border/50 rounded-md">
              {t('dialog.editCookies.noCookies')}
            </div>
          )}
        </div>
      </div>

      <FormattedDialogFooter>
        <Button variant="outline" size="sm" onClick={handleClose} disabled={saving || loading}>
          {t('dialog.editCookies.cancel')}
        </Button>
        <Button
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={handleSave}
          disabled={saving || loading}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              {t('dialog.editCookies.saving')}
            </>
          ) : (
            t('dialog.editCookies.save')
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
