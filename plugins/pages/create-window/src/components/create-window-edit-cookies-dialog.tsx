import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cookie, Plus } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TextareaInput } from '@/components/textarea-input';
import { Input } from '@/components/ui/input';
import type { CookieGroup } from '../types';

interface CreateWindowEditCookiesDialogProps {
  open: boolean;
  cookies: CookieGroup[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (cookies: CookieGroup[]) => void;
}

export function CreateWindowEditCookiesDialog({
  open,
  cookies: initialCookies,
  onOpenChange,
  onConfirm,
}: CreateWindowEditCookiesDialogProps) {
  const { t } = useTranslation('create-window');
  const [site, setSite] = useState('');
  const [cookieText, setCookieText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setSite('');
      setCookieText('');
      setError('');
    }
  }, [open]);

  const handleAddCookieGroup = () => {
    const normalizedSite = site.trim();
    const normalizedCookieText = cookieText.trim();

    if (!normalizedSite) {
      setError('请输入目标网页或域名');
      return;
    }

    if (!normalizedCookieText) {
      setError(t('dialog.cookies.cookieRequired') || '请输入 Cookie');
      return;
    }

    onConfirm([
      ...(initialCookies || []),
      {
        site: normalizedSite,
        cookieText: normalizedCookieText,
      },
    ]);

    setSite('');
    setCookieText('');
    setError('');
    onOpenChange(false);
  };

  const handleClose = () => {
    setSite('');
    setCookieText('');
    setError('');
    onOpenChange(false);
  };

  return (
    <FormattedDialog
      open={open}
      onOpenChange={onOpenChange}
      minWidth="min-w-[560px]"
      header={{
        icon: Cookie,
        iconColor: 'text-orange-500',
        title: t('dialog.cookies.addCookie') || '添加 Cookie',
        description:
          t('dialog.cookies.selectDescription') || '填写目标网页/域名和该网页对应的 Cookie',
        gradient: 'bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10',
        className: 'border-b border-border/50',
      }}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">
            目标网页/域名 <span className="text-destructive">*</span>
          </Label>
          <Input
            value={site}
            onChange={(e) => {
              setSite(e.target.value);
              setError('');
            }}
            placeholder="https://www.google.com 或 .google.com"
            className={error && !site.trim() ? 'border-destructive focus-visible:ring-destructive/50' : ''}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">
            Cookie <span className="text-destructive">*</span>
          </Label>
          <TextareaInput
            value={cookieText}
            onChange={(e) => {
              setCookieText(e.target.value);
              setError('');
            }}
            className={`text-sm min-h-[120px] font-mono ${error && site.trim() ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/50' : ''}`}
            placeholder="SID=xxx; HSID=yyy"
          />
          {error && <p className="text-[10px] text-destructive mt-0.5">{error}</p>}
        </div>

        {initialCookies.length > 0 ? (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">已添加 ({initialCookies.length})</Label>
            <div className="max-h-[180px] space-y-1 overflow-y-auto rounded-md border border-border/50 p-2">
              {initialCookies.map((item, index) => (
                <div key={`${item.site}-${index}`} className="rounded-md bg-muted px-2 py-1.5 text-xs">
                  <div className="truncate font-medium">{item.site}</div>
                  <div className="truncate font-mono text-muted-foreground">{item.cookieText}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <FormattedDialogFooter>
        <Button variant="outline" size="sm" onClick={handleClose}>
          {t('dialog.cookies.cancel') || '取消'}
        </Button>
        <Button
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={handleAddCookieGroup}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t('dialog.cookies.add') || '添加'}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
