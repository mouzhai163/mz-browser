import { memo } from 'react';
import type { ElementType } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Code,
  Database,
  Download,
  FileText,
  GitBranch,
  Globe,
  Keyboard,
  Loader2,
  LogOut,
  Mail,
  MessageSquare,
  MousePointer2,
  Navigation,
  PanelsTopLeft,
  Repeat,
  Upload,
  Variable,
  X,
  Camera,
} from 'lucide-react';

const stepIcons: Record<string, ElementType> = {
  click: MousePointer2,
  input: Keyboard,
  navigate: Navigation,
  select_tab: PanelsTopLeft,
  close_tab: X,
  screenshot: Camera,
  scroll: Globe,
  wait: Clock3,
  condition: GitBranch,
  loop: Repeat,
  break_loop: LogOut,
  extract: FileText,
  download: Download,
  upload: Upload,
  variable: Variable,
  email: Mail,
  api: Database,
  script: Code,
  notify: MessageSquare,
};

/**
 * 节点颜色只按 4 个类别区分（浏览器操作 / 流程控制 / 数据 / 高级），
 * 不再给每种步骤一个颜色：节点左侧一条色带 + 图标底色，画布整体更安静。
 */
type StepCategory = 'browser' | 'flow' | 'data' | 'advanced';

const stepCategories: Record<string, StepCategory> = {
  click: 'browser',
  input: 'browser',
  navigate: 'browser',
  select_tab: 'browser',
  close_tab: 'browser',
  screenshot: 'browser',
  scroll: 'browser',
  wait: 'flow',
  condition: 'flow',
  loop: 'flow',
  break_loop: 'flow',
  extract: 'data',
  download: 'data',
  upload: 'data',
  variable: 'data',
  api: 'data',
  email: 'advanced',
  notify: 'advanced',
  script: 'advanced',
};

const categoryStyles: Record<StepCategory, { node: string; icon: string; tile: string }> = {
  browser: { node: 'border-border bg-card border-l-[3px] border-l-[#1677ff]', icon: 'text-[#1677ff]', tile: 'bg-[#1677ff]/10' },
  flow: { node: 'border-border bg-card border-l-[3px] border-l-[#fa8c16]', icon: 'text-[#fa8c16]', tile: 'bg-[#fa8c16]/10' },
  data: { node: 'border-border bg-card border-l-[3px] border-l-[#52c41a]', icon: 'text-[#52c41a]', tile: 'bg-[#52c41a]/10' },
  advanced: { node: 'border-border bg-card border-l-[3px] border-l-[#8c8c8c]', icon: 'text-[#8c8c8c]', tile: 'bg-[#8c8c8c]/10' },
};

export interface StepNodeData {
  label: string;
  subtitle?: string;
  type: string;
  enabled: boolean;
  runStatus?: 'pending' | 'running' | 'awaiting_input' | 'success' | 'failed';
  errorSummary?: string;
  onDelete?: (id: string) => void;
}

function StepNodeComponent({ id, data, selected }: NodeProps) {
  const { t } = useTranslation('rpa');
  const nodeData = data as unknown as StepNodeData;
  const Icon = stepIcons[nodeData.type] || Code;
  const categoryStyle = categoryStyles[stepCategories[nodeData.type] ?? 'advanced'];
  const colorClass = categoryStyle.node;
  const iconColor = categoryStyle.icon;
  const runStatus = nodeData.runStatus ?? 'pending';
  const errorSummary = nodeData.errorSummary?.trim();
  const subtitle = nodeData.subtitle?.trim();
  const hasStatusTag = runStatus !== 'pending';
  const hasMetaRow = Boolean(subtitle) || hasStatusTag;
  const isCondition = nodeData.type === 'condition';
  const hasSourceHandle = nodeData.type !== 'break_loop';

  return (
    <div
      className={`
        w-[210px] px-3 py-2 rounded-lg border shadow-sm transition-all relative
        ${colorClass}
        ${selected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}
        ${!nodeData.enabled ? 'opacity-50' : ''}
        ${runStatus === 'running' ? 'ring-2 ring-sky-500 ring-offset-1 ring-offset-background' : ''}
        ${runStatus === 'awaiting_input' ? 'ring-2 ring-amber-500 ring-offset-1 ring-offset-background' : ''}
        ${runStatus === 'success' ? 'border-emerald-500/60 bg-emerald-500/10' : ''}
        ${runStatus === 'failed' ? 'border-destructive/70 bg-destructive/10' : ''}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
      />

      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded flex items-center justify-center ${categoryStyle.tile} ${iconColor}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className={`flex-1 min-w-0 ${hasMetaRow ? '' : 'flex items-center min-h-7'}`}>
          <div className="text-xs font-medium text-foreground truncate max-w-[168px]">{nodeData.label}</div>
          {hasMetaRow ? (
            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 min-h-4 min-w-0">
              {subtitle ? <span className="truncate flex-1 min-w-0">{subtitle}</span> : null}
              {runStatus === 'running' && (
                <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sky-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>{t('editor.canvas.status.running')}</span>
                </span>
              )}
              {runStatus === 'awaiting_input' && (
                <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-amber-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>{t('editor.canvas.status.awaitingInput')}</span>
                </span>
              )}
              {runStatus === 'success' && (
                <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-emerald-500">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>{t('editor.canvas.status.success')}</span>
                </span>
              )}
              {runStatus === 'failed' && (
                <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{t('editor.canvas.status.failed')}</span>
                </span>
              )}
            </div>
          ) : null}
          {runStatus === 'failed' && errorSummary ? (
            <div className="mt-1 text-[10px] text-destructive leading-4 break-words max-w-[180px]">
              {errorSummary}
            </div>
          ) : null}
        </div>
        {nodeData.onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onDelete?.(id);
            }}
            className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {isCondition ? (
        <>
          <Handle
            id="branch-true"
            type="source"
            position={Position.Bottom}
            style={{ left: '28%' }}
            className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background"
          />
          <Handle
            id="branch-false"
            type="source"
            position={Position.Bottom}
            style={{ left: '72%' }}
            className="!w-3 !h-3 !bg-rose-500 !border-2 !border-background"
          />
        </>
      ) : hasSourceHandle ? (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
        />
      ) : null}
    </div>
  );
}

export const StepNode = memo(StepNodeComponent);

