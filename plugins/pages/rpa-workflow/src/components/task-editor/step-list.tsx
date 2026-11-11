import { createElement, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  ListPlus,
  Loader2,
  Play,
  SkipForward,
  Square,
  Trash2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { flattenRows, type EditorStep, type InsertPosition, type StepRow } from '../../lib/step-tree';
import type { RpaStepBranch } from '../../types';
import type { RpaValidationCode } from '../../runtime/validate-workflow';
import { componentIcon } from '../../lib/step-catalog';

export type StepRunStatus = 'running' | 'success' | 'failed' | 'skipped' | 'stopped';

export interface StepRunInfo {
  status: StepRunStatus;
  error?: string;
  loopIteration?: number;
  loopTotal?: number;
}

export type StepSelection =
  | { kind: 'step'; id: string }
  | { kind: 'branch'; parentId: string; branch: RpaStepBranch }
  | null;

interface StepListProps {
  steps: EditorStep[];
  selection: StepSelection;
  busy: boolean;
  runInfo: Record<string, StepRunInfo>;
  issues: Record<string, RpaValidationCode>;
  onSelect: (selection: StepSelection) => void;
  onMove: (id: string, position: InsertPosition) => void;
  onToggle: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onRunStep: (id: string) => void;
  onRunFrom: (id: string) => void;
}

function StatusIcon({ info }: { info?: StepRunInfo }) {
  switch (info?.status) {
    case 'running':
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
    case 'success':
      return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
    case 'failed':
      return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    case 'skipped':
      return <CircleSlash className="h-3.5 w-3.5 text-muted-foreground" />;
    case 'stopped':
      return <Square className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return null;
  }
}

function stepSummary(step: EditorStep): string {
  const config = step.config;
  const text = (key: string) => (typeof config[key] === 'string' ? (config[key] as string) : '');
  switch (step.type) {
    case 'navigate':
      return text('url');
    case 'input':
      return text('text') || text('selector');
    case 'press_key':
      return text('key');
    case 'select_option':
      return text('optionValue') || text('selector');
    case 'set_variable':
      return text('variableName') ? `${text('variableName')} = ${text('variableValue')}` : '';
    case 'wait':
      return config.waitType === 'element' ? text('selector') : `${config.duration ?? 1000} ms`;
    case 'loop':
      return `× ${config.iterations ?? 3}`;
    case 'condition':
      return text('expectedText') || text('urlFragment') || text('selector');
    case 'select_tab':
    case 'close_tab':
      return `#${config.tabIndex ?? 1}`;
    case 'script':
      return text('script').split('\n')[0];
    case 'upload':
      return text('filePath');
    default:
      return text('selector');
  }
}

function IconAction({
  title,
  disabled,
  danger,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        danger ? 'hover:bg-destructive/10 hover:text-destructive' : 'hover:bg-accent hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

const INDENT = 22;

function StepRowView({ row, props }: { row: Extract<StepRow, { kind: 'step' }>; props: StepListProps }) {
  const { t } = useTranslation('rpa');
  const { step, depth, number } = row;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.key });
  const info = props.runInfo[step.id];
  const issue = props.issues[step.id];
  const selected = props.selection?.kind === 'step' && props.selection.id === step.id;
  const summary = stepSummary(step);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, marginLeft: depth * INDENT }}
      data-testid="rpa-step-row"
      onClick={() => props.onSelect({ kind: 'step', id: step.id })}
      className={cn(
        'group flex min-h-10 cursor-pointer items-center gap-2 rounded-md border bg-background px-2 py-1.5',
        selected ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-primary/40',
        info?.status === 'running' && 'border-primary',
        info?.status === 'failed' && 'border-destructive/60',
        !step.enabled && 'opacity-50',
        isDragging && 'z-10 shadow-md'
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={t('editor.list.drag')}
        onClick={(event) => event.stopPropagation()}
        disabled={props.busy}
        className="cursor-grab touch-none text-muted-foreground/60 hover:text-foreground disabled:cursor-not-allowed"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="w-7 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{number}</span>
      {createElement(componentIcon(step.type), { className: 'h-4 w-4 shrink-0 text-primary' })}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-medium text-foreground">{step.name}</span>
          {info?.loopTotal ? (
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {info.loopIteration ?? 0}/{info.loopTotal}
            </span>
          ) : null}
        </div>
        {info?.status === 'failed' && info.error ? (
          <div className="truncate text-[11px] text-destructive" title={info.error}>
            {info.error}
          </div>
        ) : summary ? (
          <div className="truncate text-[11px] text-muted-foreground">{summary}</div>
        ) : null}
      </div>
      {issue ? (
        <span title={t(`editor.validation.${issue}`)} className="shrink-0">
          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
        </span>
      ) : null}
      <span className="shrink-0">
        <StatusIcon info={info} />
      </span>
      <div className="hidden shrink-0 items-center group-hover:flex">
        <IconAction title={t('editor.list.runStep')} disabled={props.busy} onClick={() => props.onRunStep(step.id)}>
          <Play className="h-3.5 w-3.5" />
        </IconAction>
        <IconAction title={t('editor.list.runFrom')} disabled={props.busy} onClick={() => props.onRunFrom(step.id)}>
          <SkipForward className="h-3.5 w-3.5" />
        </IconAction>
        <IconAction
          title={step.enabled ? t('editor.list.disable') : t('editor.list.enable')}
          disabled={props.busy}
          onClick={() => props.onToggle(step.id)}
        >
          {step.enabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </IconAction>
        <IconAction title={t('editor.list.duplicate')} disabled={props.busy} onClick={() => props.onDuplicate(step.id)}>
          <Copy className="h-3.5 w-3.5" />
        </IconAction>
        <IconAction title={t('editor.list.delete')} danger disabled={props.busy} onClick={() => props.onDelete(step.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </IconAction>
      </div>
    </div>
  );
}

function BranchRowView({ row, props }: { row: Extract<StepRow, { kind: 'branch' }>; props: StepListProps }) {
  const { t } = useTranslation('rpa');
  const { setNodeRef, transform, transition } = useSortable({ id: row.key, disabled: { draggable: true } });
  const selected =
    props.selection?.kind === 'branch' &&
    props.selection.parentId === row.parentId &&
    props.selection.branch === row.branch;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, marginLeft: row.depth * INDENT }}
      onClick={() => props.onSelect({ kind: 'branch', parentId: row.parentId, branch: row.branch })}
      className={cn(
        'flex h-7 cursor-pointer items-center gap-2 rounded px-2 text-[11px] text-muted-foreground',
        selected ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
      )}
    >
      <span className="font-medium">{t(`editor.list.branch.${row.branch}`)}</span>
      {row.empty ? <span className="text-muted-foreground/70">{t('editor.list.branchEmpty')}</span> : null}
    </div>
  );
}

export function StepList(props: StepListProps) {
  const { t } = useTranslation('rpa');
  const rows = useMemo(() => flattenRows(props.steps), [props.steps]);
  const keys = useMemo(() => rows.map((row) => row.key), [rows]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = keys.indexOf(String(active.id));
    const to = keys.indexOf(String(over.id));
    const target = rows[to];
    if (!target) return;
    if (target.kind === 'branch') {
      props.onMove(String(active.id), { kind: 'branch', parentId: target.parentId, branch: target.branch, at: 'start' });
    } else {
      props.onMove(String(active.id), { kind: from < to ? 'after' : 'before', id: target.step.id });
    }
  };

  if (props.steps.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
        <ListPlus className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-xs">{t('editor.list.empty')}</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onSelect(null);
      }}
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={keys} strategy={verticalListSortingStrategy}>
          <div className="mx-auto max-w-3xl space-y-1.5">
            {rows.map((row) =>
              row.kind === 'step' ? (
                <StepRowView key={row.key} row={row} props={props} />
              ) : (
                <BranchRowView key={row.key} row={row} props={props} />
              )
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
