import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ChevronDown, Eye, EyeOff, Loader2, KeyRound, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TextareaInput } from '@/components/textarea-input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEnvironmentDialogStore } from '../stores';
import { createAccount } from '../api';
import { PLATFORMS, getPlatformIcon } from '../utils/account';

interface AccountFormData {
  platform: string;
  account: string;
  password: string;
}

interface EnvironmentCreateAccountDialogProps {
  onComplete?: () => void;
}

/**
 * 创建账号对话框
 */
export function EnvironmentCreateAccountDialog({
  onComplete,
}: EnvironmentCreateAccountDialogProps) {
  const { t } = useTranslation('environment');
  const dialogStore = useEnvironmentDialogStore();

  // 表单数据
  const [formData, setFormData] = useState<AccountFormData>({
    platform: '',
    account: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [platformError, setPlatformError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 重置表单
  const resetForm = () => {
    setFormData({ platform: '', account: '', password: '' });
    setShowPassword(false);
    setPlatformError('');
  };

  // 验证平台URL格式
  const validatePlatformUrl = (url: string): boolean => {
    if (!url.trim()) {
      setPlatformError(t('dialog.account.platformRequired'));
      return false;
    }
    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        setPlatformError(t('dialog.account.invalidProtocol'));
        return false;
      }
      setPlatformError('');
      return true;
    } catch {
      setPlatformError(t('dialog.account.invalidUrl'));
      return false;
    }
  };

  const handlePlatformChange = (value: string) => {
    setFormData({ ...formData, platform: value });
    if (value) {
      validatePlatformUrl(value);
    } else {
      setPlatformError('');
    }
  };

  // 创建账号
  const handleCreate = async () => {
    if (!validatePlatformUrl(formData.platform)) {
      return;
    }
    if (!formData.account.trim()) {
      toast.warning(t('dialog.account.accountRequired'));
      return;
    }

    setSubmitting(true);
    try {
      await createAccount({
        platform_url: formData.platform,
        account: formData.account,
        password: formData.password || undefined,
      });
      toast.success(t('dialog.account.createSuccess'));
      dialogStore.closeCreateAccountDialog();
      resetForm();
      onComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('dialog.account.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={dialogStore.createAccountDialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          dialogStore.closeCreateAccountDialog();
          resetForm();
        }
      }}
    >
      <DialogContent className="max-w-[520px] gap-0 p-0 overflow-hidden">
        {/* 渐变头部 */}
        <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10 px-5 py-4 border-b border-border/50">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-500" />
              {t('dialog.account.createTitle')}
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="p-4 space-y-4">
          {/* 平台字段 */}
          <div className="space-y-1">
            <Label htmlFor="env-platform" className="text-xs text-muted-foreground">
              {t('dialog.account.platform')} <span className="text-destructive">*</span>
            </Label>
            <div className="relative flex items-center">
              <TextareaInput
                id="env-platform"
                value={formData.platform}
                onChange={(e) => handlePlatformChange(e.target.value)}
                onBlur={() => formData.platform && validatePlatformUrl(formData.platform)}
                className={`pr-8 text-sm min-h-9 ${platformError ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/50' : ''}`}
                placeholder={t('dialog.account.platformPlaceholder')}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="absolute right-0 top-0 h-9 w-9 flex items-center justify-center rounded-r transition-colors"
                  >
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {PLATFORMS.map((platform) => (
                    <DropdownMenuItem
                      key={platform.url}
                      onClick={() => handlePlatformChange(platform.url)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <span className="shrink-0">{getPlatformIcon(platform.url)}</span>
                        <span className="flex-1 text-xs truncate">{platform.url}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {platformError && (
              <p className="text-[10px] text-destructive mt-0.5">{platformError}</p>
            )}
          </div>

          {/* 账号字段 */}
          <div className="space-y-1">
            <Label htmlFor="env-account" className="text-xs text-muted-foreground">
              {t('dialog.account.account')} <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <TextareaInput
                id="env-account"
                value={formData.account}
                onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                className="pl-9 text-sm min-h-9"
                placeholder={t('dialog.account.accountPlaceholder')}
              />
            </div>
          </div>

          {/* 密码字段 */}
          <div className="space-y-1">
            <Label htmlFor="env-password" className="text-xs text-muted-foreground">
              {t('dialog.account.password')}
            </Label>
            <div className="relative">
              <TextareaInput
                id="env-password"
                value={formData.password}
                style={
                  {
                    WebkitTextSecurity: showPassword ? 'none' : 'disc',
                    lineHeight: '1.75rem',
                  } as React.CSSProperties
                }
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="pr-9 text-sm min-h-9"
                placeholder={t('dialog.account.passwordPlaceholder')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-0 h-9 w-9 flex items-center justify-center hover:bg-accent rounded-r transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="px-5 py-3 bg-muted/30 border-t border-border/50 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => {
              dialogStore.closeCreateAccountDialog();
              resetForm();
            }}
            disabled={submitting}
          >
            {t('dialog.account.cancel')}
          </Button>
          <Button
            size="sm"
            className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
            onClick={handleCreate}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                {t('dialog.account.creating')}
              </>
            ) : (
              t('dialog.account.create')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
