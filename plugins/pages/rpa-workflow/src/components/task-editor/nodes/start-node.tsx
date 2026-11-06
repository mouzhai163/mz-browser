import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Loader2, Play, Square } from 'lucide-react';

export interface StartNodeData {
  runStatus?: 'idle' | 'starting' | 'running' | 'success' | 'failed' | 'stopping' | 'stopped';
}

function StartNodeComponent({ selected, data }: NodeProps) {
  const { t } = useTranslation('rpa');
  const nodeData = (data ?? {}) as StartNodeData;
  const isActive = nodeData.runStatus === 'starting' || nodeData.runStatus === 'running';
  const isCompleted = nodeData.runStatus === 'success';
  const isFailed = nodeData.runStatus === 'failed';
  const isStopped = nodeData.runStatus === 'stopped' || nodeData.runStatus === 'stopping';

  const accentClass = isActive
    ? 'border-sky-500/70 bg-sky-500/10 text-sky-500'
    : isFailed
      ? 'border-destructive/70 bg-destructive/10 text-destructive'
      : isStopped
        ? 'border-amber-500/70 bg-amber-500/10 text-amber-600'
        : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500';

  const handleColorClass = isActive
    ? '!bg-sky-500'
    : isFailed
      ? '!bg-destructive'
      : isStopped
        ? '!bg-amber-500'
        : '!bg-emerald-500';

  return (
    <div
      className={`
        px-4 py-2 rounded-full border-2 shadow-sm transition-all
        ${accentClass}
        ${selected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}
      `}
    >
      <div className="flex items-center gap-2">
        {isActive ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isCompleted ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : isFailed ? (
          <AlertCircle className="h-4 w-4" />
        ) : isStopped ? (
          <Square className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        <span className="text-xs font-semibold">{t('editor.start')}</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className={`!w-3 !h-3 !border-2 !border-background ${handleColorClass}`}
      />
    </div>
  );
}

export const StartNode = memo(StartNodeComponent);
