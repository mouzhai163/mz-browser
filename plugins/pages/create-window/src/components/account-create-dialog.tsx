import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ChevronDown, Eye, EyeOff, Globe } from 'lucide-react';
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

// 常见平台列表
const PLATFORMS = [
  { name: 'Facebook', url: 'https://www.facebook.com/' },
  { name: 'TikTok', url: 'https://www.tiktok.com/' },
  { name: 'YouTube', url: 'https://www.youtube.com/' },
  { name: 'X (Twitter)', url: 'https://x.com/' },
  { name: 'Instagram', url: 'https://www.instagram.com/' },
  { name: 'LinkedIn', url: 'https://www.linkedin.com/' },
];

export interface AccountFormData {
  platform: string;
  account: string;
  password: string;
}

interface AccountCreateDialogProps {
  open: boolean;
  formData: AccountFormData;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onFormDataChange: (data: AccountFormData) => void;
  onSubmit: () => void;
}

/**
 * 创建账号对话框组件
 */
export function AccountCreateDialog({
  open,
  formData,
  submitting,
  onOpenChange,
  onFormDataChange,
  onSubmit,
}: AccountCreateDialogProps) {
  const { t } = useTranslation('create-window');
  const [showPassword, setShowPassword] = useState(false);
  const [platformError, setPlatformError] = useState('');

  // 验证平台URL格式
  const validatePlatformUrl = (url: string): boolean => {
    if (!url.trim()) {
      setPlatformError(t('accountDialog.platformError.required'));
      return false;
    }
    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        setPlatformError(t('accountDialog.platformError.invalidProtocol'));
        return false;
      }
      setPlatformError('');
      return true;
    } catch {
      setPlatformError(t('accountDialog.platformError.invalidUrl'));
      return false;
    }
  };

  const handlePlatformChange = (value: string) => {
    onFormDataChange({ ...formData, platform: value });
    if (value) {
      validatePlatformUrl(value);
    } else {
      setPlatformError('');
    }
  };

  const handlePlatformSelect = (url: string) => {
    handlePlatformChange(url);
  };

  const handleSubmit = () => {
    if (!validatePlatformUrl(formData.platform)) {
      return;
    }
    if (!formData.account.trim()) {
      toast.warning(t('accountDialog.accountError.required'));
      return;
    }
    if (!formData.password.trim()) {
      toast.warning(t('accountDialog.passwordError.required'));
      return;
    }
    onSubmit();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          onFormDataChange({ platform: '', account: '', password: '' });
          setPlatformError('');
          setShowPassword(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-[500px] gap-0 p-3">
        <DialogHeader className="mb-3">
          <DialogTitle className="text-sm font-semibold mb-0">
            {t('accountDialog.title')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* 平台字段 */}
          <div className="space-y-1">
            <Label htmlFor="create-platform" className="text-[10px] mb-0.5">
              {t('accountDialog.platform')} *
            </Label>
            <div className="relative flex items-center">
              <TextareaInput
                id="create-platform"
                value={formData.platform}
                onChange={(e) => handlePlatformChange(e.target.value)}
                onBlur={() => validatePlatformUrl(formData.platform)}
                className={`pr-8 text-xs ${
                  platformError
                    ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/50'
                    : ''
                }`}
                placeholder={t('accountDialog.platformPlaceholder')}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="absolute right-0 h-8 w-8 flex items-center justify-center rounded-r transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {PLATFORMS.map((platform) => (
                    <DropdownMenuItem
                      key={platform.url}
                      onClick={() => handlePlatformSelect(platform.url)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Globe className="w-4 h-4 shrink-0 text-muted-foreground" />
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
            <Label htmlFor="create-account" className="text-[10px] mb-0.5">
              {t('accountDialog.account')} *
            </Label>
            <TextareaInput
              id="create-account"
              value={formData.account}
              onChange={(e) => onFormDataChange({ ...formData, account: e.target.value })}
              className="text-xs"
              placeholder={t('accountDialog.accountPlaceholder')}
            />
          </div>

          {/* 密码字段 */}
          <div className="space-y-1">
            <Label htmlFor="create-password" className="text-[10px] mb-0.5">
              {t('accountDialog.password')} *
            </Label>
            <div className="relative">
              <TextareaInput
                id="create-password"
                value={formData.password}
                onChange={(e) => onFormDataChange({ ...formData, password: e.target.value })}
                className="pr-8 text-xs"
                placeholder={t('accountDialog.passwordPlaceholder')}
                style={
                  {
                    WebkitTextSecurity: showPassword ? 'none' : 'disc',
                    lineHeight: '1.75rem',
                  } as React.CSSProperties
                }
              />
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
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-[10px] px-3 py-1.5 h-7"
            onClick={() => {
              onOpenChange(false);
              onFormDataChange({ platform: '', account: '', password: '' });
              setPlatformError('');
              setShowPassword(false);
            }}
          >
            {t('accountDialog.cancel')}
          </Button>
          <Button
            size="sm"
            className="text-[10px] px-3 py-1.5 h-7"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? t('accountDialog.submitting') : t('accountDialog.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
