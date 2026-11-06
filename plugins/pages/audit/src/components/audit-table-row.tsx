import { useTranslation } from 'react-i18next';
import {
  Plus,
  Pencil,
  Trash2,
  LogIn,
  LogOut,
  Download,
  Upload,
  Play,
  Square,
  Layers,
  Monitor,
  FolderOpen,
  Globe,
  Users,
  Settings,
  Server,
  UserPlus,
  UserMinus,
  UserCheck,
  UserX,
  DoorOpen,
  Key,
  Tag,
  User,
} from 'lucide-react';
import { DataTableRowContainer, DataTableCell } from '@/components/data-table';

import type { AuditLog } from '../types';

interface AuditTableRowProps {
  log: AuditLog;
}

export function AuditTableRow({ log }: AuditTableRowProps) {
  const { t } = useTranslation('audit');

  const formatDate = (dateString: string) => {
    if (!dateString || dateString === '-') return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const getActionIcon = () => {
    const iconClass = 'h-3.5 w-3.5';
    switch (log.action) {
      case 'create':
        return <Plus className={`${iconClass} text-green-500`} />;
      case 'update':
        return <Pencil className={`${iconClass} text-blue-500`} />;
      case 'delete':
        return <Trash2 className={`${iconClass} text-red-500`} />;
      case 'login':
        return <LogIn className={`${iconClass} text-emerald-500`} />;
      case 'logout':
        return <LogOut className={`${iconClass} text-gray-500`} />;
      case 'register':
        return <UserPlus className={`${iconClass} text-green-500`} />;
      case 'export':
        return <Download className={`${iconClass} text-purple-500`} />;
      case 'import':
        return <Upload className={`${iconClass} text-indigo-500`} />;
      case 'start':
        return <Play className={`${iconClass} text-green-500`} />;
      case 'stop':
        return <Square className={`${iconClass} text-orange-500`} />;
      case 'batch':
      case 'batch_create':
      case 'batch_delete':
      case 'batch_import':
        return <Layers className={`${iconClass} text-cyan-500`} />;
      case 'invite':
        return <UserPlus className={`${iconClass} text-blue-500`} />;
      case 'remove':
        return <UserMinus className={`${iconClass} text-red-500`} />;
      case 'accept_invitation':
        return <UserCheck className={`${iconClass} text-green-500`} />;
      case 'reject_invitation':
        return <UserX className={`${iconClass} text-orange-500`} />;
      case 'leave':
        return <DoorOpen className={`${iconClass} text-yellow-500`} />;
      case 'update_password':
        return <Key className={`${iconClass} text-amber-500`} />;
      default:
        return null;
    }
  };

  const getActionBadge = () => {
    const colors: Record<string, string> = {
      create: 'bg-green-500/10 text-green-500',
      update: 'bg-blue-500/10 text-blue-500',
      delete: 'bg-red-500/10 text-red-500',
      login: 'bg-emerald-500/10 text-emerald-500',
      logout: 'bg-gray-500/10 text-gray-500',
      register: 'bg-green-500/10 text-green-500',
      export: 'bg-purple-500/10 text-purple-500',
      import: 'bg-indigo-500/10 text-indigo-500',
      start: 'bg-green-500/10 text-green-500',
      stop: 'bg-orange-500/10 text-orange-500',
      batch: 'bg-cyan-500/10 text-cyan-500',
      batch_create: 'bg-cyan-500/10 text-cyan-500',
      batch_delete: 'bg-cyan-500/10 text-cyan-500',
      batch_import: 'bg-cyan-500/10 text-cyan-500',
      invite: 'bg-blue-500/10 text-blue-500',
      remove: 'bg-red-500/10 text-red-500',
      accept_invitation: 'bg-green-500/10 text-green-500',
      reject_invitation: 'bg-orange-500/10 text-orange-500',
      leave: 'bg-yellow-500/10 text-yellow-500',
      update_password: 'bg-amber-500/10 text-amber-500',
    };
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${colors[log.action] || 'bg-muted text-muted-foreground'}`}
      >
        {getActionIcon()}
        {t(`action.${log.action}`, log.action)}
      </span>
    );
  };

  const getTargetTypeIcon = () => {
    const iconClass = 'h-3.5 w-3.5 text-muted-foreground';
    switch (log.targetType) {
      case 'environment':
        return <Monitor className={iconClass} />;
      case 'group':
        return <FolderOpen className={iconClass} />;
      case 'tag':
        return <Tag className={iconClass} />;
      case 'proxy':
        return <Globe className={iconClass} />;
      case 'team':
        return <Users className={iconClass} />;
      case 'team_member':
        return <UserPlus className={iconClass} />;
      case 'user':
        return <User className={iconClass} />;
      case 'settings':
        return <Settings className={iconClass} />;
      case 'system':
        return <Server className={iconClass} />;
      default:
        return null;
    }
  };

  return (
    <DataTableRowContainer isSelected={false}>
      {/* 操作类型 */}
      <DataTableCell>{getActionBadge()}</DataTableCell>

      {/* 操作对象 */}
      <DataTableCell>
        <div className="flex items-center gap-2">
          {getTargetTypeIcon()}
          <div>
            <div className="text-[11px] text-muted-foreground">
              {t(`targetType.${log.targetType}`)}
            </div>
            {log.targetName && (
              <div className="font-medium text-[12px] text-foreground">{log.targetName}</div>
            )}
          </div>
        </div>
      </DataTableCell>

      {/* 操作详情 */}
      <DataTableCell>
        <span className="text-[12px] text-foreground">{log.details}</span>
      </DataTableCell>

      {/* 操作时间 */}
      <DataTableCell>
        <div className="text-[12px] text-muted-foreground">{formatDate(log.timestamp)}</div>
      </DataTableCell>

      {/* 操作者 */}
      <DataTableCell>
        <span className="text-[12px] text-foreground font-medium">{log.operator}</span>
      </DataTableCell>

      {/* IP 地址 */}
      <DataTableCell>
        <span className="font-mono text-[11px] text-muted-foreground">{log.ipAddress || '-'}</span>
      </DataTableCell>
    </DataTableRowContainer>
  );
}
