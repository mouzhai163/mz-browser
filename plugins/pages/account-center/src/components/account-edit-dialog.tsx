import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Eye, EyeOff, Loader2, UserCog, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TextareaInput } from '@/components/textarea-input';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import type { Account, AccountFormData } from '../types';
import { COMMON_PLATFORMS } from '../constants';

interface AccountEditDialogProps {
  open: boolean;
  account: Account | null;
  formData: AccountFormData;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onFormDataChange: (data: AccountFormData) => void;
  onSubmit: () => void;
}

export function AccountEditDialog({
  open,
  account,
  formData,
  submitting,
  onOpenChange,
  onFormDataChange,
  onSubmit,
}: AccountEditDialogProps) {
  const { t } = useTranslation('account');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  if (!account) return null;

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.platform.trim()) {
      newErrors.platform = t('dialog.create.errors.platformRequired');
    } else {
      try {
        new URL(formData.platform);
      } catch {
        newErrors.platform = t('dialog.create.errors.invalidUrl');
      }
    }

    if (!formData.account.trim()) {
      newErrors.account = t('dialog.create.errors.accountRequired');
    }

    if (!formData.password.trim()) {
      newErrors.password = t('dialog.create.errors.passwordRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit();
    }
  };

  const handlePlatformSelect = (url: string) => {
    onFormDataChange({ ...formData, platform: url });
    setErrors((prev) => ({ ...prev, platform: '' }));
  };

  const handleClose = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      setErrors({});
      setShowPassword(false);
    }
  };

  return (
    <FormattedDialog
      open={open}
      onOpenChange={handleClose}
      minWidth="min-w-[500px]"
      header={{
        icon: UserCog,
        iconColor: 'text-blue-500',
        title: t('dialog.edit.title'),
        description: t('dialog.edit.description', { defaultValue: '修改账号信息' }),
        gradient: 'bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10',
      }}
      contentPadding="p-4"
    >
      <div className="space-y-3">
        {/* 平台 */}
        <div className="space-y-1.5">
          <Label htmlFor="edit-platform" className="text-xs">
            {t('dialog.create.platform')} <span className="text-destructive">*</span>
          </Label>
          <div className="relative flex items-center">
            <TextareaInput
              id="edit-platform"
              placeholder={t('dialog.create.platformPlaceholder')}
              value={formData.platform}
              onChange={(e) => {
                onFormDataChange({ ...formData, platform: e.target.value });
                setErrors((prev) => ({ ...prev, platform: '' }));
              }}
              className={`pr-8 text-xs ${errors.platform ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/50' : ''}`}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="absolute right-0 h-8 w-8 flex items-center justify-center rounded-r transition-colors hover:bg-accent"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {COMMON_PLATFORMS.map((platform) => (
                  <DropdownMenuItem
                    key={platform.url}
                    onClick={() => handlePlatformSelect(platform.url)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${platform.url}&sz=16`}
                        alt=""
                        className="w-4 h-4 shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <span className="flex-1 text-xs truncate">{platform.url}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {errors.platform && <p className="text-[10px] text-destructive">{errors.platform}</p>}
        </div>

        {/* 账号 */}
        <div className="space-y-1.5">
          <Label htmlFor="edit-account" className="text-xs">
            {t('dialog.create.account')} <span className="text-destructive">*</span>
          </Label>
          <TextareaInput
            id="edit-account"
            placeholder={t('dialog.create.accountPlaceholder')}
            value={formData.account}
            onChange={(e) => {
              onFormDataChange({ ...formData, account: e.target.value });
              setErrors((prev) => ({ ...prev, account: '' }));
            }}
            className={`text-xs ${errors.account ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/50' : ''}`}
          />
          {errors.account && <p className="text-[10px] text-destructive">{errors.account}</p>}
        </div>

        {/* 密码 */}
        <div className="space-y-1.5">
          <Label htmlFor="edit-password" className="text-xs">
            {t('dialog.create.password')} <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <TextareaInput
              id="edit-password"
              placeholder={t('dialog.create.passwordPlaceholder')}
              value={formData.password}
              onChange={(e) => {
                onFormDataChange({ ...formData, password: e.target.value });
                setErrors((prev) => ({ ...prev, password: '' }));
              }}
              className={`pr-8 text-xs ${!showPassword ? 'text-transparent caret-transparent selection:bg-transparent' : ''} ${errors.password ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/50' : ''}`}
              style={{ lineHeight: '1.75rem' }}
            />
            {!showPassword && formData.password && (
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-foreground">
                ••••••••
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-0 h-8 w-8 flex items-center justify-center hover:bg-accent rounded-r transition-colors"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>
          {errors.password && <p className="text-[10px] text-destructive">{errors.password}</p>}
        </div>

        {/* 备注 */}
        <div className="space-y-1.5">
          <Label htmlFor="edit-remark" className="text-xs">
            {t('dialog.create.remark')}
          </Label>
          <TextareaInput
            id="edit-remark"
            placeholder={t('dialog.create.remarkPlaceholder')}
            value={formData.remark}
            onChange={(e) => onFormDataChange({ ...formData, remark: e.target.value })}
            className="text-xs"
          />
        </div>
      </div>

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleClose(false)}
          disabled={submitting}
        >
          <X className="h-4 w-4 mr-1.5" />
          {t('dialog.edit.cancel')}
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              {t('dialog.edit.submitting')}
            </>
          ) : (
            t('dialog.edit.submit')
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
