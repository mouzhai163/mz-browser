import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MoreVertical,
  Copy,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Facebook,
  Youtube,
  Instagram,
  Linkedin,
  Twitter,
  Globe,
  Monitor,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  DataTableRowContainer,
  DataTableCell,
  DataTableCheckboxCell,
  DataTableActionsCell,
} from '@/components/data-table';
import type { Account } from '../types';
import { decryptAccountPassword } from '../utils/password';

interface AccountTableRowProps {
  account: Account;
  isSelected: boolean;
  onSelect: (uuid: string, selected: boolean) => void;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
}

// 获取平台图标
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

// 状态徽章
function StatusBadge({ status }: { status: Account['status'] }) {
  const { t } = useTranslation('account');
  const statusConfig = {
    active: {
      className: 'bg-emerald-500/10 text-emerald-500',
      dot: 'bg-emerald-500',
    },
    inactive: {
      className: 'bg-slate-500/10 text-slate-500',
      dot: 'bg-slate-500',
    },
    expired: {
      className: 'bg-destructive/10 text-destructive',
      dot: 'bg-destructive',
    },
  };

  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
      {t(`status.${status}`)}
    </span>
  );
}

export function AccountTableRow({
  account,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: AccountTableRowProps) {
  const { t } = useTranslation('account');
  const [showPassword, setShowPassword] = useState(false);
  const [decryptedPassword, setDecryptedPassword] = useState<string | null>(null);
  const [decryptingPassword, setDecryptingPassword] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const ensurePlainPassword = async () => {
    if (decryptedPassword !== null) {
      return decryptedPassword;
    }

    setDecryptingPassword(true);
    try {
      const plainPassword = await decryptAccountPassword(account);
      setDecryptedPassword(plainPassword);
      return plainPassword;
    } catch (error) {
      console.error('Decrypt password failed:', error);
      toast.error('密码解密失败');
      return null;
    } finally {
      setDecryptingPassword(false);
    }
  };

  const handleTogglePassword = async () => {
    if (showPassword) {
      setShowPassword(false);
      return;
    }

    const plainPassword = await ensurePlainPassword();
    if (plainPassword !== null) {
      setShowPassword(true);
    }
  };

  const handleCopyPassword = async () => {
    const plainPassword = await ensurePlainPassword();
    if (plainPassword !== null) {
      await handleCopy(plainPassword);
    }
  };

  const handleRowMouseLeave = () => {
    setShowPassword(false);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString || dateString === '-') return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <DataTableRowContainer isSelected={isSelected} onMouseLeave={handleRowMouseLeave}>
      {/* 选择框列 */}
      <DataTableCheckboxCell
        isSelected={isSelected}
        onSelect={(selected) => onSelect(account.uuid, selected)}
      />

      {/* 平台列 */}
      <DataTableCell>
        <div className="flex items-center gap-2">
          {getPlatformIcon(account.platform)}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm font-medium cursor-help">{account.platformName}</span>
            </TooltipTrigger>
            <TooltipContent>{account.platform}</TooltipContent>
          </Tooltip>
        </div>
      </DataTableCell>

      {/* 账号列 */}
      <DataTableCell>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-sm">{account.account}</span>
          <button
            onClick={() => handleCopy(account.account)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded"
            title={t('table.actions.copy')}
          >
            <Copy className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </DataTableCell>

      {/* 密码列 */}
      <DataTableCell>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-sm">
            {showPassword ? decryptedPassword || '' : '••••••••'}
          </span>
          <button
            onClick={() => void handleTogglePassword()}
            disabled={decryptingPassword}
            className="p-1 hover:bg-accent rounded transition-colors"
          >
            {decryptingPassword ? (
              <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
            ) : showPassword ? (
              <EyeOff className="h-3 w-3 text-muted-foreground" />
            ) : (
              <Eye className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={() => void handleCopyPassword()}
            disabled={decryptingPassword}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded"
            title={t('table.actions.copyPassword')}
          >
            <Copy className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </DataTableCell>

      {/* 状态列 */}
      <DataTableCell>
        <StatusBadge status={account.status} />
      </DataTableCell>

      {/* 关联环境列 */}
      <DataTableCell>
        <div className="flex items-center gap-1.5">
          <Monitor className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono text-sm text-foreground">{account.environmentsCount}</span>
        </div>
      </DataTableCell>

      {/* 最后使用列 */}
      <DataTableCell>
        <div className="text-sm text-muted-foreground">{formatDate(account.lastUsedAt)}</div>
      </DataTableCell>

      {/* 创建时间列 */}
      <DataTableCell>
        <div className="text-sm text-muted-foreground">{formatDate(account.createdAt)}</div>
      </DataTableCell>

      {/* 操作列 */}
      <DataTableActionsCell isSelected={isSelected}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
              title={t('table.actions.more')}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onEdit(account)} className="cursor-pointer">
              <Edit className="w-4 h-4 mr-2" />
              <span>{t('table.actions.edit')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(account)}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              <span>{t('table.actions.delete')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </DataTableActionsCell>
    </DataTableRowContainer>
  );
}
