import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2, Check, Plus, Globe, Search, UserCheck, ChevronDown } from 'lucide-react';
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
import { useEnvironmentDialogStore } from '../stores';
import { setEnvironmentAccounts, listAccounts, AccountItem } from '../api';

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

interface EnvironmentSelectAccountDialogProps {
  onComplete?: () => void;
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
 * 选择账号对话框
 */
export function EnvironmentSelectAccountDialog({
  onComplete,
}: EnvironmentSelectAccountDialogProps) {
  const { t } = useTranslation('environment');
  const dialogStore = useEnvironmentDialogStore();

  // 所有可用账号列表
  const [availableAccounts, setAvailableAccounts] = useState<AccountItem[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  // 当前环境已选中的账号 UUID 列表
  const [selectedAccountUuids, setSelectedAccountUuids] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 加载账号列表
  useEffect(() => {
    if (dialogStore.selectAccountDialogOpen) {
      loadAccounts();
      setSearchQuery('');
      setSelectedPlatform(null);
    }
  }, [dialogStore.selectAccountDialogOpen]);

  // 当环境变化时，设置已选中的账号
  useEffect(() => {
    if (dialogStore.selectAccountEnvironment?.accounts) {
      const uuids = dialogStore.selectAccountEnvironment.accounts.map((a) => a.uuid);
      setSelectedAccountUuids(uuids);
    } else {
      setSelectedAccountUuids([]);
    }
  }, [dialogStore.selectAccountEnvironment]);

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const list = await listAccounts();
      setAvailableAccounts(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('dialog.account.loadFailed'));
    } finally {
      setLoadingAccounts(false);
    }
  };

  // 切换账号选中状态
  const toggleAccountSelection = (uuid: string) => {
    setSelectedAccountUuids((prev) =>
      prev.includes(uuid) ? prev.filter((id) => id !== uuid) : [...prev, uuid]
    );
  };

  // 打开创建账号弹窗
  const handleOpenCreateAccount = () => {
    dialogStore.openCreateAccountDialog();
  };

  // 保存所有账号
  const handleSave = async () => {
    if (!dialogStore.selectAccountEnvironment) return;

    setSubmitting(true);
    try {
      await setEnvironmentAccounts({
        uuid: dialogStore.selectAccountEnvironment.uuid,
        account_uuids: selectedAccountUuids,
      });
      dialogStore.closeSelectAccountDialog();
      toast.success(t('dialog.account.saveSuccess'));
      onComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('dialog.account.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const environmentName =
    dialogStore.selectAccountEnvironment?.name || t('dialog.account.defaultEnvName');

  // 提取所有可用的平台类型
  const availablePlatforms = useMemo(() => {
    const platforms = new Set<string>();
    availableAccounts.forEach((account) => {
      const platformUrl = account.platform_url?.toLowerCase() || '';
      if (platformUrl) {
        // 提取平台域名
        try {
          const url = new URL(account.platform_url);
          const hostname = url.hostname.replace('www.', '');
          platforms.add(hostname);
        } catch {
          // 如果 URL 解析失败，使用原始 URL
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

  return (
    <FormattedDialog
      open={dialogStore.selectAccountDialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          dialogStore.closeSelectAccountDialog();
        }
      }}
      header={{
        icon: UserCheck,
        title: t('dialog.account.title'),
        description: t('dialog.account.selectDescription', { envName: environmentName }),
      }}
      contentClassName="space-y-3"
    >
      {availableAccounts.length > 0 && (
        <div className="relative flex items-center">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <TextareaInput
            placeholder={t('dialog.account.searchPlaceholder')}
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
                {t('dialog.account.filterAll')}
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
          title={t('dialog.account.noAccounts')}
          description={t('dialog.account.noAccountsDescription')}
        />
      ) : filteredAccounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">{t('dialog.account.noMatch')}</p>
        </div>
      ) : (
        <ScrollArea className="h-[280px] -mx-1 px-1">
          <div className="space-y-2">
            {filteredAccounts.map((account) => (
              <AccountCard
                key={account.uuid}
                item={account}
                isSelected={selectedAccountUuids.includes(account.uuid)}
                onClick={() => toggleAccountSelection(account.uuid)}
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
          {t('dialog.account.addAccount')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => dialogStore.closeSelectAccountDialog()}
        >
          {t('dialog.account.cancel')}
        </Button>
        <Button
          size="sm"
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={handleSave}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {t('dialog.account.saving')}
            </>
          ) : (
            t('dialog.account.save')
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
