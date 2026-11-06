import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Eye, EyeOff, Loader2, Globe, KeyRound, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TextareaInput } from '@/components/textarea-input';
import type { AccountFormData } from '../types';
import { COMMON_PLATFORMS } from '../constants';

// 根据平台 URL 获取 Font Awesome 图标
function getPlatformIcon(platform: string): React.ReactNode {
  const lower = platform.toLowerCase();

  if (lower.includes('facebook.com') || lower.includes('fb.com')) {
    return <i className="fa-brands fa-facebook text-blue-600"></i>;
  }
  if (lower.includes('youtube.com')) {
    return <i className="fa-brands fa-youtube text-red-600"></i>;
  }
  if (lower.includes('instagram.com')) {
    return <i className="fa-brands fa-instagram text-pink-600"></i>;
  }
  if (lower.includes('linkedin.com')) {
    return <i className="fa-brands fa-linkedin text-blue-700"></i>;
  }
  if (lower.includes('twitter.com') || lower.includes('x.com')) {
    return <i className="fa-brands fa-x-twitter text-sky-500"></i>;
  }
  if (lower.includes('tiktok.com')) {
    return <i className="fa-brands fa-tiktok"></i>;
  }
  if (lower.includes('google.com') || lower.includes('gmail.com')) {
    return <i className="fa-brands fa-google text-blue-500"></i>;
  }
  if (lower.includes('amazon.com')) {
    return <i className="fa-brands fa-amazon text-orange-500"></i>;
  }

  return <Globe className="h-4 w-4 text-muted-foreground" />;
}

interface AccountCreateDialogProps {
  open: boolean;
  formData: AccountFormData;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onFormDataChange: (data: AccountFormData) => void;
  onSubmit: () => void;
}

export function AccountCreateDialog({
  open,
  formData,
  submitting,
  onOpenChange,
  onFormDataChange,
  onSubmit,
}: AccountCreateDialogProps) {
  const { t } = useTranslation('account');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.platform.trim()) {
      newErrors.platform = t('dialog.create.errors.platformRequired');
    } else {
      try {
        const urlObj = new URL(formData.platform);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          newErrors.platform = t('dialog.create.errors.invalidUrl');
        }
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

  const handlePlatformChange = (value: string) => {
    onFormDataChange({ ...formData, platform: value });
    if (value) {
      try {
        const urlObj = new URL(value);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          setErrors((prev) => ({ ...prev, platform: t('dialog.create.errors.invalidUrl') }));
        } else {
          setErrors((prev) => ({ ...prev, platform: '' }));
        }
      } catch {
        setErrors((prev) => ({ ...prev, platform: t('dialog.create.errors.invalidUrl') }));
      }
    } else {
      setErrors((prev) => ({ ...prev, platform: '' }));
    }
  };

  const handleClose = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      setErrors({});
      setShowPassword(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[520px] gap-0 p-0 overflow-hidden">
        {/* 渐变头部 */}
        <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10 px-5 py-4 border-b border-border/50">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-500" />
              {t('dialog.create.title')}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t('dialog.create.description', { defaultValue: '添加一个新的平台账号' })}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-4 space-y-4">
          {/* 平台字段 */}
          <div className="space-y-1">
            <Label htmlFor="platform" className="text-xs text-muted-foreground">
              {t('dialog.create.platform')} <span className="text-destructive">*</span>
            </Label>
            <div className="relative flex items-center">
              <TextareaInput
                id="platform"
                value={formData.platform}
                onChange={(e) => handlePlatformChange(e.target.value)}
                onBlur={() => formData.platform && handlePlatformChange(formData.platform)}
                className={`pr-8 text-sm min-h-9 ${errors.platform ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/50' : ''}`}
                placeholder={t('dialog.create.platformPlaceholder')}
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
                  {COMMON_PLATFORMS.map((platform) => (
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
            {errors.platform && (
              <p className="text-[10px] text-destructive mt-0.5">{errors.platform}</p>
            )}
          </div>

          {/* 账号字段 */}
          <div className="space-y-1">
            <Label htmlFor="account" className="text-xs text-muted-foreground">
              {t('dialog.create.account')} <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <TextareaInput
                id="account"
                value={formData.account}
                onChange={(e) => {
                  onFormDataChange({ ...formData, account: e.target.value });
                  setErrors((prev) => ({ ...prev, account: '' }));
                }}
                className={`pl-9 text-sm min-h-9 ${errors.account ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/50' : ''}`}
                placeholder={t('dialog.create.accountPlaceholder')}
              />
            </div>
            {errors.account && (
              <p className="text-[10px] text-destructive mt-0.5">{errors.account}</p>
            )}
          </div>

          {/* 密码字段 */}
          <div className="space-y-1">
            <Label htmlFor="password" className="text-xs text-muted-foreground">
              {t('dialog.create.password')} <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <TextareaInput
                id="password"
                value={formData.password}
                style={
                  {
                    WebkitTextSecurity: showPassword ? 'none' : 'disc',
                    lineHeight: '1.75rem',
                  } as React.CSSProperties
                }
                onChange={(e) => {
                  onFormDataChange({ ...formData, password: e.target.value });
                  setErrors((prev) => ({ ...prev, password: '' }));
                }}
                className={`pr-9 text-sm min-h-9 ${errors.password ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/50' : ''}`}
                placeholder={t('dialog.create.passwordPlaceholder')}
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
            {errors.password && (
              <p className="text-[10px] text-destructive mt-0.5">{errors.password}</p>
            )}
          </div>

          {/* 备注字段 */}
          <div className="space-y-1">
            <Label htmlFor="remark" className="text-xs text-muted-foreground">
              {t('dialog.create.remark')}
            </Label>
            <TextareaInput
              id="remark"
              value={formData.remark}
              onChange={(e) => onFormDataChange({ ...formData, remark: e.target.value })}
              className="text-sm min-h-9"
              placeholder={t('dialog.create.remarkPlaceholder')}
            />
          </div>
        </div>

        <DialogFooter className="px-5 py-3 bg-muted/30 border-t border-border/50 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => handleClose(false)}
            disabled={submitting}
          >
            {t('dialog.create.cancel')}
          </Button>
          <Button
            size="sm"
            className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                {t('dialog.create.submitting')}
              </>
            ) : (
              t('dialog.create.submit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
