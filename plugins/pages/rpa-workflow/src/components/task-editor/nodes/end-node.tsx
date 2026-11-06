import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Flag, Loader2, Square } from 'lucide-react';

export interface EndNodeData {
  runStatus?: 'idle' | 'starting' | 'running' | 'success' | 'failed' | 'stopping' | 'stopped';
}

function EndNodeComponent({ selected, data }: NodeProps) {
  const { t } = useTranslation('rpa');
  const nodeData = (data ?? {}) as EndNodeData;
  const isRunning = nodeData.runStatus === 'running';
  const isSuccess = nodeData.runStatus === 'success';
  const isFailed = nodeData.runStatus === 'failed';
  const isStopped = nodeData.runStatus === 'stopped' || nodeData.runStatus === 'stopping';

  const accentClass = isRunning
    ? 'border-sky-500/70 bg-sky-500/10 text-sky-500'
    : isSuccess
      ? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-500'
      : isFailed
        ? 'border-destructive/70 bg-destructive/10 text-destructive'
        : isStopped
          ? 'border-amber-500/70 bg-amber-500/10 text-amber-600'
          : 'border-blue-500/50 bg-blue-500/10 text-blue-500';

  const handleColorClass = isRunning
    ? '!bg-sky-500'
    : isSuccess
      ? '!bg-emerald-500'
      : isFailed
        ? '!bg-destructive'
        : isStopped
          ? '!bg-amber-500'
          : '!bg-blue-500';

  return (
    <div
      className={`
        px-4 py-2 rounded-full border-2 shadow-sm transition-all
        ${accentClass}
        ${selected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className={`!w-3 !h-3 !border-2 !border-background ${handleColorClass}`}
      />

      <div className="flex items-center gap-2">
        {isRunning ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSuccess ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : isFailed ? (
          <AlertCircle className="h-4 w-4" />
        ) : isStopped ? (
          <Square className="h-4 w-4" />
        ) : (
          <Flag className="h-4 w-4" />
        )}
        <span className="text-xs font-semibold">{t('editor.end')}</span>
      </div>
    </div>
  );
}

export const EndNode = memo(EndNodeComponent);
