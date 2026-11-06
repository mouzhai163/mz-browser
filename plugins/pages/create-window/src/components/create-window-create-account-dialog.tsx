import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Globe,
  Facebook,
  Youtube,
  Instagram,
  Linkedin,
  Twitter,
  KeyRound,
  User,
} from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TextareaInput } from '@/components/textarea-input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
// @ts-ignore - Cross-plugin import
import { createAccount } from '../../../environment-manager/src/api';

// 常见平台列表
const PLATFORMS = [
  { name: 'Facebook', url: 'https://www.facebook.com/' },
  { name: 'TikTok', url: 'https://www.tiktok.com/' },
  { name: 'YouTube', url: 'https://www.youtube.com/' },
  { name: 'X (Twitter)', url: 'https://x.com/' },
  { name: 'Instagram', url: 'https://www.instagram.com/' },
  { name: 'LinkedIn', url: 'https://www.linkedin.com/' },
  { name: 'Google', url: 'https://www.google.com/' },
  { name: 'Amazon', url: 'https://www.amazon.com/' },
];

// 根据平台 URL 获取图标组件
function getPlatformIcon(platform: string): React.ReactNode {
  const lower = platform.toLowerCase();

  if (lower.includes('facebook.com') || lower.includes('fb.com')) {
    return <Facebook className="h-4 w-4 text-blue-600" />;
  }
  if (lower.includes('youtube.com')) {
    return <Youtube className="h-4 w-4 text-red-600" />;
  }
  if (lower.includes('instagram.com')) {
    return <Instagram className="h-4 w-4 text-pink-600" />;
  }
  if (lower.includes('linkedin.com')) {
    return <Linkedin className="h-4 w-4 text-blue-700" />;
  }
  if (lower.includes('twitter.com') || lower.includes('x.com')) {
    return <Twitter className="h-4 w-4 text-sky-500" />;
  }
  if (lower.includes('tiktok.com')) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
      </svg>
    );
  }
  if (lower.includes('google.com') || lower.includes('gmail.com')) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
    );
  }
  if (lower.includes('amazon.com')) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-orange-500" fill="currentColor">
        <path d="M.045 18.02c.072-.116.187-.124.348-.022 3.636 2.11 7.594 3.166 11.87 3.166 2.852 0 5.668-.533 8.447-1.595l.315-.14c.138-.06.234-.1.293-.13.226-.088.39-.046.525.13.12.174.09.336-.12.48-.154.106-.476.326-.966.66-.653.449-1.383.872-2.19 1.27-1.57.77-3.26 1.267-5.067 1.49-1.806.22-3.532.203-5.175-.05-1.643-.255-3.156-.68-4.542-1.27-1.387-.592-2.616-1.32-3.688-2.19-.072-.06-.104-.12-.096-.18.01-.06.056-.1.14-.1z" />
      </svg>
    );
  }

  return <Globe className="h-4 w-4 text-muted-foreground" />;
}

interface AccountFormData {
  platform: string;
  account: string;
  password: string;
}

interface CreateWindowCreateAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

/**
 * 创建窗口创建账号对话框
 */
export function CreateWindowCreateAccountDialog({
  open,
  onOpenChange,
  onComplete,
}: CreateWindowCreateAccountDialogProps) {
  const { t } = useTranslation('create-window');

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
      setPlatformError(t('dialog.account.platformRequired') || '请输入平台 URL');
      return false;
    }
    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        setPlatformError(
          t('dialog.account.invalidProtocol') || '平台 URL 必须以 http:// 或 https:// 开头'
        );
        return false;
      }
      setPlatformError('');
      return true;
    } catch {
      setPlatformError(t('dialog.account.invalidUrl') || '请输入正确的平台 URL');
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
      toast.warning(t('dialog.account.accountRequired') || '请输入账号');
      return;
    }

    setSubmitting(true);
    try {
      await createAccount({
        platform_url: formData.platform,
        account: formData.account,
        password: formData.password || undefined,
      });
      toast.success(t('dialog.account.createSuccess') || '账号创建成功');
      onOpenChange(false);
      resetForm();
      onComplete?.();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t('dialog.account.createFailed') || '创建账号失败'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <FormattedDialog
      open={open}
      onOpenChange={onOpenChange}
      minWidth="min-w-[520px]"
      header={{
        icon: KeyRound,
        iconColor: 'text-blue-500',
        title: t('dialog.account.createTitle') || '创建账号',
        description: t('dialog.account.createDescription') || '创建一个新的平台账号',
        gradient: 'bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10',
        className: 'border-b border-border/50',
      }}
    >
      <div className="space-y-4">
        {/* 平台字段 */}
        <div className="space-y-1.5">
          <Label htmlFor="create-platform" className="text-xs font-medium text-foreground">
            {t('dialog.account.platform') || '平台'} <span className="text-destructive">*</span>
          </Label>
          <div className="relative flex items-center">
            <TextareaInput
              id="create-platform"
              value={formData.platform}
              onChange={(e) => handlePlatformChange(e.target.value)}
              onBlur={() => formData.platform && validatePlatformUrl(formData.platform)}
              className={`pr-8 text-sm min-h-9 ${platformError ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/50' : ''}`}
              placeholder={t('dialog.account.platformPlaceholder') || '请输入或选择平台 URL'}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="absolute right-0 top-0 h-9 w-9 flex items-center justify-center rounded-r"
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
          {platformError && <p className="text-[10px] text-destructive mt-0.5">{platformError}</p>}
        </div>

        {/* 账号字段 */}
        <div className="space-y-1.5">
          <Label htmlFor="create-account" className="text-xs font-medium text-foreground">
            {t('dialog.account.account') || '账号'} <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <TextareaInput
              id="create-account"
              value={formData.account}
              onChange={(e) => setFormData({ ...formData, account: e.target.value })}
              className="pl-9 text-sm min-h-9"
              placeholder={t('dialog.account.accountPlaceholder') || '请输入账号'}
            />
          </div>
        </div>

        {/* 密码字段 */}
        <div className="space-y-1.5">
          <Label htmlFor="create-password" className="text-xs font-medium text-foreground">
            {t('dialog.account.password') || '密码'}
          </Label>
          <div className="relative">
            <TextareaInput
              id="create-password"
              value={formData.password}
              style={
                {
                  WebkitTextSecurity: showPassword ? 'none' : 'disc',
                  lineHeight: '1.75rem',
                } as React.CSSProperties
              }
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="pr-9 text-sm min-h-9"
              placeholder={t('dialog.account.passwordPlaceholder') || '请输入密码（可选）'}
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

      <FormattedDialogFooter>
        <Button variant="outline" size="sm" onClick={handleClose} disabled={submitting}>
          {t('dialog.account.cancel') || '取消'}
        </Button>
        <Button
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={handleCreate}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {t('dialog.account.creating') || '创建中...'}
            </>
          ) : (
            t('dialog.account.create') || '创建'
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
