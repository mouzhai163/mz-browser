import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Loader2,
  Check,
  Plus,
  Globe,
  Facebook,
  Youtube,
  Instagram,
  Linkedin,
  Twitter,
  Search,
  UserCheck,
  ChevronDown,
} from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { TextareaInput } from '@/components/textarea-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
// @ts-ignore - Cross-plugin import
import { listAccounts, type AccountItem } from '../../../environment-manager/src/api';
import { CreateWindowCreateAccountDialog } from './create-window-create-account-dialog';

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

interface CreateWindowSelectAccountDialogProps {
  open: boolean;
  selectedAccountUuids: string[]; // 已选中的账号 UUID 列表
  onOpenChange: (open: boolean) => void;
  onConfirm: (accountUuids: string[]) => void; // 返回选中的账号 UUID 列表
  onAccountCreated?: () => void; // 账号创建完成后的回调，用于刷新账号列表
}

const AccountCard: React.FC<{
  item: AccountItem;
  isSelected: boolean;
  onClick: () => void;
}> = ({ item, isSelected, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors duration-150 ${
        isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/80'
      }`}
    >
      <div className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center bg-muted text-muted-foreground group-hover:text-foreground transition-colors duration-150">
        {getPlatformIcon(item.platform_url || item.account)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{item.account}</span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground truncate">
          {item.platform_name || item.platform_url || '-'}
        </div>
      </div>
      <div
        className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-150 ${
          isSelected
            ? 'bg-primary border-primary'
            : 'border-muted-foreground/30 group-hover:border-muted-foreground/50'
        }`}
      >
        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
      </div>
    </div>
  );
};

const EmptyState: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center py-10 px-4">
    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
      <UserCheck className="h-8 w-8 text-blue-500/60" />
    </div>
    <h4 className="text-sm font-medium text-foreground mb-1">{title}</h4>
    <p className="text-xs text-muted-foreground text-center max-w-[260px]">{description}</p>
  </div>
);

/**
 * 创建窗口选择账号对话框
 */
export function CreateWindowSelectAccountDialog({
  open,
  selectedAccountUuids: initialSelectedAccountUuids,
  onOpenChange,
  onConfirm,
  onAccountCreated,
}: CreateWindowSelectAccountDialogProps) {
  const { t } = useTranslation('create-window');

  // 所有可用账号列表
  const [availableAccounts, setAvailableAccounts] = useState<AccountItem[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  // 当前选中的账号 UUID 列表
  const [selectedAccountUuids, setSelectedAccountUuids] = useState<Set<string>>(new Set());

  // 创建账号对话框状态
  const [createAccountDialogOpen, setCreateAccountDialogOpen] = useState(false);

  // 加载账号列表
  useEffect(() => {
    if (open) {
      loadAccounts();
      setSearchQuery('');
      setSelectedPlatform(null);
      // 初始化已选中的账号
      setSelectedAccountUuids(new Set(initialSelectedAccountUuids || []));
    }
  }, [open, initialSelectedAccountUuids]);

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const list = await listAccounts();
      setAvailableAccounts(list);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t('dialog.account.loadFailed') || '加载账号失败'
      );
    } finally {
      setLoadingAccounts(false);
    }
  };

  // 切换账号选中状态
  const toggleAccountSelection = (account: AccountItem) => {
    setSelectedAccountUuids((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(account.uuid)) {
        newSet.delete(account.uuid);
      } else {
        newSet.add(account.uuid);
      }
      return newSet;
    });
  };

  // 检查账号是否被选中
  const isAccountSelected = (account: AccountItem): boolean => {
    return selectedAccountUuids.has(account.uuid);
  };

  // 提取所有可用的平台类型
  const availablePlatforms = useMemo(() => {
    const platforms = new Set<string>();
    availableAccounts.forEach((account) => {
      const platformUrl = account.platform_url?.toLowerCase() || '';
      if (platformUrl) {
        try {
          const url = new URL(account.platform_url);
          const hostname = url.hostname.replace('www.', '');
          platforms.add(hostname);
        } catch {
          platforms.add(platformUrl);
        }
      }
    });
    return Array.from(platforms).sort();
  }, [availableAccounts]);

  // 根据平台 URL 获取平台名称
  const getPlatformName = (platformUrl: string): string => {
    const lower = platformUrl.toLowerCase();
    if (lower.includes('facebook.com') || lower.includes('fb.com')) return 'Facebook';
    if (lower.includes('youtube.com')) return 'YouTube';
    if (lower.includes('instagram.com')) return 'Instagram';
    if (lower.includes('linkedin.com')) return 'LinkedIn';
    if (lower.includes('twitter.com') || lower.includes('x.com')) return 'X (Twitter)';
    if (lower.includes('tiktok.com')) return 'TikTok';
    if (lower.includes('google.com') || lower.includes('gmail.com')) return 'Google';
    if (lower.includes('amazon.com')) return 'Amazon';
    try {
      const url = new URL(platformUrl);
      return url.hostname.replace('www.', '');
    } catch {
      return platformUrl;
    }
  };

  // 检查账号是否匹配选中的平台
  const matchesPlatform = (account: AccountItem, platform: string | null): boolean => {
    if (!platform) return true;
    const accountUrl = account.platform_url?.toLowerCase() || '';
    try {
      const url = new URL(account.platform_url);
      const hostname = url.hostname.replace('www.', '');
      return hostname === platform;
    } catch {
      return accountUrl.includes(platform);
    }
  };

  const filteredAccounts = useMemo(() => {
    let filtered = availableAccounts;

    // 平台筛选
    if (selectedPlatform) {
      filtered = filtered.filter((a) => matchesPlatform(a, selectedPlatform));
    }

    // 搜索筛选
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((a) => {
        const account = a.account?.toLowerCase?.() || '';
        const platformName = a.platform_name?.toLowerCase?.() || '';
        const platformUrl = a.platform_url?.toLowerCase?.() || '';
        return account.includes(q) || platformName.includes(q) || platformUrl.includes(q);
      });
    }

    return filtered;
  }, [availableAccounts, searchQuery, selectedPlatform]);

  const handleConfirm = () => {
    onConfirm(Array.from(selectedAccountUuids));
    onOpenChange(false);
  };

  // 打开创建账号弹窗
  const handleOpenCreateAccount = () => {
    setCreateAccountDialogOpen(true);
  };

  // 账号创建完成后的回调
  const handleAccountCreated = () => {
    loadAccounts(); // 重新加载账号列表
    onAccountCreated?.();
  };

  return (
    <FormattedDialog
      open={open}
      onOpenChange={onOpenChange}
      minWidth="min-w-[600px]"
      header={{
        icon: UserCheck,
        iconColor: 'text-blue-500',
        title: t('dialog.account.title') || '设置平台账号',
        description: t('dialog.account.selectDescription') || '选择要使用的平台账号',
        gradient: 'bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10',
        className: 'border-b border-border/50',
      }}
      contentClassName="space-y-3"
    >
      {availableAccounts.length > 0 && (
        <div className="relative flex items-center">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <TextareaInput
            placeholder={t('dialog.account.searchPlaceholder') || '搜索账号...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`pl-9 pr-8 text-sm min-h-9 ${selectedPlatform ? 'border-primary/50' : ''}`}
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
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => setSelectedPlatform(null)}
                className="cursor-pointer"
              >
                {t('dialog.account.filterAll') || '所有平台'}
              </DropdownMenuItem>
              {availablePlatforms.length > 0 && (
                <>
                  {availablePlatforms.map((platform) => (
                    <DropdownMenuItem
                      key={platform}
                      onClick={() => setSelectedPlatform(platform)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <span className="shrink-0">
                          {getPlatformIcon(
                            platform.startsWith('http') ? platform : `https://${platform}`
                          )}
                        </span>
                        <span className="flex-1 text-xs truncate">
                          {getPlatformName(
                            platform.startsWith('http') ? platform : `https://${platform}`
                          )}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {loadingAccounts ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : availableAccounts.length === 0 ? (
        <EmptyState
          title={t('dialog.account.noAccounts') || '暂无账号'}
          description={t('dialog.account.noAccountsDescription') || '请先创建账号'}
        />
      ) : filteredAccounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">
            {t('dialog.account.noMatch') || '未找到匹配的账号'}
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[280px] -mx-1 px-1">
          <div className="space-y-2">
            {filteredAccounts.map((account) => (
              <AccountCard
                key={account.uuid}
                item={account}
                isSelected={isAccountSelected(account)}
                onClick={() => toggleAccountSelection(account)}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          className="text-xs mr-auto border-dashed hover:border-primary/50 hover:bg-primary/5"
          onClick={handleOpenCreateAccount}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {t('dialog.account.createNew') || '创建账号'}
        </Button>
        <Button variant="outline" size="sm" className="text-xs" onClick={() => onOpenChange(false)}>
          {t('dialog.account.cancel') || '取消'}
        </Button>
        <Button
          size="sm"
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={handleConfirm}
        >
          {t('dialog.account.confirm') || '确认'}
        </Button>
      </FormattedDialogFooter>

      {/* 创建账号对话框 */}
      <CreateWindowCreateAccountDialog
        open={createAccountDialogOpen}
        onOpenChange={setCreateAccountDialogOpen}
        onComplete={handleAccountCreated}
      />
    </FormattedDialog>
  );
}
