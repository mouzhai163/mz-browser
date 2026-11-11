import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useStore } from 'zustand';
import { ArrowLeft, Laptop, Play, Redo2, Save, Settings, Settings2, Square, Trash2, Undo2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { createRpaTask, getRpaTaskDetail, listRpaEnvironments, updateRpaTask } from '../../api';
import { useEditorRun } from '../../hooks/use-editor-run';
import {
  branchesOf,
  duplicateStep,
  findStep,
  insertStep,
  moveStep,
  removeStep,
  updateStep,
  walkSteps,
  type EditorStep,
  type InsertPosition,
} from '../../lib/step-tree';
import type { PortableRpaTaskDocument } from '../../lib/rpa-transfer';
import { rpaExecutionStore } from '../../runtime/execution-manager';
import { validateSteps, type RpaValidationCode } from '../../runtime/validate-workflow';
import { ComponentPanel } from './component-panel';
import { EnvironmentSelectorDialog } from './environment-selector-dialog';
import { PropertyPanel } from './property-panel';
import { RunLogPanel } from './run-log-panel';
import { StepList, type StepSelection } from './step-list';
import { TaskSettingsForm, type TaskConfig, type TaskVariable } from './task-settings-form';
import { VariablePanel, type RuntimeVariableItem } from './variable-panel';
import {
  buildTaskPayload,
  buildWorkflowSchema,
  mapPortableTaskToEditorState,
  mapTaskDetailToEditorState,
  type EditorState,
} from './workflow-mapper';

function createDefaultTaskConfig(name: string): TaskConfig {
  const now = new Date();
  const stamp = `${now.getMonth() + 1}${now.getDate()}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  return {
    name: `${name}-${stamp}`,
    description: '',
    tags: [],
    triggerType: 'manual',
    selectedEnvironments: [],
    runMode: 'sequential',
    globalVariables: [],
    retryCount: 0,
    retryInterval: 5,
    timeout: 300,
    concurrency: 1,
    stopOnError: true,
    closeBrowserOnComplete: false,
    notifyOnComplete: false,
    notifyOnError: true,
    speed: 'normal',
  };
}

const randomSuffix = () => Math.random().toString(36).slice(2, 8);

function defaultConfig(type: string): Record<string, unknown> {
  switch (type) {
    case 'navigate':
      return { url: '', newTab: true };
    case 'select_tab':
    case 'close_tab':
      return { tabIndex: 1 };
    case 'input':
      return { text: '' };
    case 'wait':
      return { waitType: 'time', duration: 1000, timeout: 10000 };
    case 'condition':
      return { conditionType: 'element_visible', expectedText: '', urlFragment: '' };
    case 'screenshot':
      return { captureMode: 'viewport' };
    case 'scroll':
      return { scrollMode: 'by_viewport', direction: 'down', viewportCount: 1, edge: 'bottom', block: 'center' };
    case 'loop':
      return { iterations: 3 };
    case 'extract':
      return { extractType: 'text', outputKey: `value_${randomSuffix()}` };
    case 'upload':
      return { filePath: '' };
    case 'script':
      return { script: '', outputKey: `result_${randomSuffix()}`, executionMode: 'browser' };
    case 'press_key':
      return { key: 'Enter' };
    case 'select_option':
      return { optionBy: 'label', optionValue: '' };
    case 'set_variable':
      return { variableName: '', variableValue: '' };
    default:
      return {};
  }
}

interface History {
  past: EditorStep[][];
  future: EditorStep[][];
}

const MAX_HISTORY = 100;
const MERGE_WINDOW_MS = 800;

const isTextTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['input', 'textarea', 'select'].includes(target.tagName.toLowerCase()));

export function TaskEditor() {
  const { t } = useTranslation('rpa');
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const importedDocument =
    (location.state as { importedRpaDocument?: PortableRpaTaskDocument } | null)?.importedRpaDocument ?? null;

  const [config, setConfig] = useState<TaskConfig>(() => createDefaultTaskConfig(t('editor.defaultTaskName')));
  const [steps, setSteps] = useState<EditorStep[]>([]);
  const [selection, setSelection] = useState<StepSelection>(null);
  const [saving, setSaving] = useState(false);
  const [loadingTask, setLoadingTask] = useState(Boolean(id));
  const [settingsDraft, setSettingsDraft] = useState<TaskConfig | null>(null);
  const [envDialogOpen, setEnvDialogOpen] = useState(false);
  const [envName, setEnvName] = useState('');
  const [sidebarSection, setSidebarSection] = useState<'properties' | 'variables' | ''>('properties');
  const [history, setHistory] = useState<History>({ past: [], future: [] });
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const lastMerge = useRef<{ key: string; at: number } | null>(null);
  const savedSnapshot = useRef('');

  const stepName = useCallback((stepId: string) => findStep(stepsRef.current, stepId)?.name ?? stepId, []);
  const run = useEditorRun(stepName);

  const selectedStep = selection?.kind === 'step' ? findStep(steps, selection.id) : null;
  const environmentUuid = config.selectedEnvironments[0];

  const workflow = useMemo(() => buildWorkflowSchema(config, steps), [config, steps]);
  const issues = useMemo(() => {
    const map: Record<string, RpaValidationCode> = {};
    for (const issue of validateSteps(workflow.steps)) map[issue.stepId] = issue.code;
    return map;
  }, [workflow.steps]);

  const snapshotOf = useCallback(
    (nextConfig: TaskConfig, nextSteps: EditorStep[]) => JSON.stringify({ c: nextConfig, s: nextSteps }),
    []
  );

  const loadState = useCallback(
    (state: EditorState) => {
      setConfig(state.config);
      setSteps(state.steps);
      setSelection(null);
      setHistory({ past: [], future: [] });
      savedSnapshot.current = snapshotOf(state.config, state.steps);
      if (state.orphaned > 0) toast.warning(t('editor.orphanedSteps', { count: state.orphaned }));
    },
    [snapshotOf, t]
  );

  useEffect(() => {
    if (!id) {
      setLoadingTask(false);
      return;
    }
    let cancelled = false;
    setLoadingTask(true);
    getRpaTaskDetail(id)
      .then((detail) => {
        if (!cancelled) loadState(mapTaskDetailToEditorState(detail));
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : String(error));
          navigate('/rpa');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTask(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, loadState, navigate]);

  useEffect(() => {
    if (!id && importedDocument) loadState(mapPortableTaskToEditorState(importedDocument));
  }, [id, importedDocument, loadState]);

  // 任务被 MCP 改了：没有未保存内容就重新加载，有就提醒，不丢用户正在改的内容
  const externalEdit = useStore(rpaExecutionStore, (state) => (id ? state.externalEdits[id] : undefined));
  useEffect(() => {
    if (!id || !externalEdit) return;
    if (snapshotOf(config, steps) !== savedSnapshot.current) {
      toast.warning(t('editor.externalConflict'));
      return;
    }
    void getRpaTaskDetail(id)
      .then((detail) => {
        loadState(mapTaskDetailToEditorState(detail));
        toast.info(t('editor.externalReloaded'));
      })
      .catch(() => undefined);
    // 只在收到外部修改时触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalEdit]);

  useEffect(() => {
    setEnvName('');
    if (!environmentUuid) return;
    let cancelled = false;
    void listRpaEnvironments()
      .then((environments) => {
        if (!cancelled) setEnvName(environments.find((item) => item.id === environmentUuid)?.name ?? '');
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [environmentUuid]);

  const commit = useCallback((next: EditorStep[], mergeKey?: string) => {
    const now = Date.now();
    const merging = Boolean(
      mergeKey && lastMerge.current?.key === mergeKey && now - lastMerge.current.at < MERGE_WINDOW_MS
    );
    lastMerge.current = mergeKey ? { key: mergeKey, at: now } : null;
    if (!merging) {
      const before = stepsRef.current;
      setHistory((current) => ({ past: [...current.past.slice(-(MAX_HISTORY - 1)), before], future: [] }));
    }
    setSteps(next);
  }, []);

  const canUndo = history.past.length > 0 && !run.busy;
  const canRedo = history.future.length > 0 && !run.busy;

  const undo = useCallback(() => {
    setHistory((current) => {
      const previous = current.past.at(-1);
      if (!previous) return current;
      const now = stepsRef.current;
      setSteps(previous);
      return { past: current.past.slice(0, -1), future: [now, ...current.future].slice(0, MAX_HISTORY) };
    });
    lastMerge.current = null;
  }, []);

  const redo = useCallback(() => {
    setHistory((current) => {
      const next = current.future[0];
      if (!next) return current;
      const now = stepsRef.current;
      setSteps(next);
      return { past: [...current.past, now].slice(-MAX_HISTORY), future: current.future.slice(1) };
    });
    lastMerge.current = null;
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || isTextTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey && canUndo) {
        event.preventDefault();
        undo();
      } else if (((key === 'z' && event.shiftKey) || key === 'y') && canRedo) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canRedo, canUndo, redo, undo]);

  const insertionPoint = useCallback((): InsertPosition => {
    if (selection?.kind === 'branch') {
      return { kind: 'branch', parentId: selection.parentId, branch: selection.branch, at: 'end' };
    }
    if (selection?.kind === 'step') {
      const current = findStep(stepsRef.current, selection.id);
      const [firstBranch] = current ? branchesOf(current.type) : [];
      if (current && firstBranch) return { kind: 'branch', parentId: current.id, branch: firstBranch, at: 'end' };
      return { kind: 'after', id: selection.id };
    }
    return { kind: 'root', at: 'end' };
  }, [selection]);

  const handleAdd = useCallback(
    (type: string) => {
      const step: EditorStep = {
        id: crypto.randomUUID(),
        type,
        name: t(`editor.stepTypes.${type}`),
        config: defaultConfig(type),
        enabled: true,
      };
      for (const branch of branchesOf(type)) step[branch] = [];
      commit(insertStep(stepsRef.current, insertionPoint(), step));
      setSelection({ kind: 'step', id: step.id });
    },
    [commit, insertionPoint, t]
  );

  const handleUpdateStep = useCallback(
    (updated: EditorStep, mergeKey?: string) => commit(updateStep(stepsRef.current, updated.id, () => updated), mergeKey),
    [commit]
  );

  const handleDelete = useCallback(
    (stepId: string) => {
      commit(removeStep(stepsRef.current, stepId));
      setSelection((current) => (current?.kind === 'step' && current.id === stepId ? null : current));
    },
    [commit]
  );

  const handleDuplicate = useCallback(
    (stepId: string) => {
      const { steps: next, copyId } = duplicateStep(stepsRef.current, stepId);
      commit(next);
      if (copyId) setSelection({ kind: 'step', id: copyId });
    },
    [commit]
  );

  const handleToggle = useCallback(
    (stepId: string) => commit(updateStep(stepsRef.current, stepId, (step) => ({ ...step, enabled: !step.enabled }))),
    [commit]
  );

  const handleMove = useCallback(
    (stepId: string, position: InsertPosition) => commit(moveStep(stepsRef.current, stepId, position)),
    [commit]
  );

  const handleClear = () => {
    if (steps.length === 0 || !window.confirm(t('editor.menu.clearSteps'))) return;
    commit([]);
    setSelection(null);
    run.reset();
  };

  const requireEnvironment = () => {
    if (config.selectedEnvironments.length > 0) return true;
    toast.warning(t('editor.errors.environmentRequired'));
    setEnvDialogOpen(true);
    return false;
  };

  const requireValidSteps = () => {
    const first = validateSteps(workflow.steps)[0];
    if (!first) return true;
    toast.warning(t(`editor.validation.${first.code}`));
    setSelection({ kind: 'step', id: first.stepId });
    setSidebarSection('properties');
    return false;
  };

  const handleRun = () => {
    if (steps.length === 0) {
      toast.warning(t('editor.errors.stepsRequired'));
      return;
    }
    if (requireEnvironment() && requireValidSteps()) void run.runAll(workflow);
  };

  const handleRunStep = (stepId: string) => {
    if (requireEnvironment()) void run.runStep(workflow, stepId);
  };

  const handleRunFrom = (stepId: string) => {
    if (requireEnvironment()) void run.runFrom(workflow, stepId);
  };

  const handlePick = async (step: EditorStep) => {
    if (!requireEnvironment()) return;
    toast.info(t('editor.config.pickHint'));
    const captured = await run.pick(workflow);
    if (!captured) return;
    const latest = findStep(stepsRef.current, step.id);
    if (!latest) return;
    const similar = latest.type === 'extract' ? captured.similar : null;
    const wantsAll = latest.type === 'extract' && latest.config.extractAll === true;
    if (wantsAll && !similar) toast.warning(t('editor.config.noSimilar'));
    const useSimilar = wantsAll && similar;
    handleUpdateStep({
      ...latest,
      config: {
        ...latest.config,
        selector: useSimilar ? similar.value : captured.primary.value,
        selectorBy: useSimilar ? 'css' : captured.primary.by,
        selectorCandidates: useSimilar ? [] : (captured.primary.candidates ?? []),
        selectorFrames: captured.primary.frames ?? [],
        similarSelector: similar?.value ?? '',
        similarCount: similar?.count ?? 0,
      },
    });
  };

  const handleSave = async () => {
    if (!config.name.trim()) {
      toast.warning(t('editor.errors.nameRequired'));
      return;
    }
    if (steps.length === 0) {
      toast.warning(t('editor.errors.stepsRequired'));
      return;
    }
    setSaving(true);
    try {
      const payload = buildTaskPayload(config, steps);
      if (id) {
        await updateRpaTask({ ...payload, uuid: id });
      } else {
        const uuid = await createRpaTask(payload);
        navigate(`/rpa/edit/${uuid}`, { replace: true });
      }
      savedSnapshot.current = snapshotOf(config, steps);
      const unfinished = Object.keys(issues).length;
      if (unfinished > 0) toast.warning(t('editor.savedWithIssues', { count: unfinished }));
      else toast.success(t('editor.saved'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message.includes('INVALID_CRON') ? t('editor.errors.invalidCron') : message);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    const dirty = snapshotOf(config, steps) !== (savedSnapshot.current || snapshotOf(config, []));
    if (dirty && !window.confirm(t('editor.confirmLeave'))) return;
    navigate('/rpa');
  };

  const runtimeVariables = useMemo<RuntimeVariableItem[]>(() => {
    const items: RuntimeVariableItem[] = [];
    walkSteps(steps, (step) => {
      const name = typeof step.config.outputKey === 'string' ? step.config.outputKey.trim() : '';
      const value = run.previews[step.id]?.value;
      if (name && value) items.push({ name, value, source: step.type === 'script' ? 'script' : 'extract' });
    });
    return items;
  }, [run.previews, steps]);

  const handleVariablesChange = useCallback(
    (variables: TaskVariable[]) => setConfig((current) => ({ ...current, globalVariables: variables })),
    []
  );

  const envLabel = environmentUuid
    ? t('editor.runEnvironment.bound', { name: envName || environmentUuid.slice(0, 8) })
    : t('editor.runEnvironment.none');
  const envHint =
    config.selectedEnvironments.length > 1
      ? t('editor.runEnvironment.firstOnly', { count: config.selectedEnvironments.length })
      : envLabel;

  const accordionItemClass = (name: string) =>
    sidebarSection === name
      ? 'flex flex-1 min-h-0 flex-col [&>[data-slot=accordion-content]]:flex-1 [&>[data-slot=accordion-content]]:min-h-0'
      : 'shrink-0';
  const accordionContentClass = (name: string) =>
    sidebarSection === name ? 'flex h-full flex-1 min-h-0 flex-col overflow-hidden pb-0' : 'pb-0';

  return (
    <div className="relative flex h-[calc(100vh-50px)] flex-col">
      <div className="flex h-12 items-center justify-between border-b border-border bg-background px-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Input
            value={config.name}
            onChange={(event) => setConfig((current) => ({ ...current, name: event.target.value }))}
            placeholder={t('editor.taskNamePlaceholder')}
            className="h-8 w-56 border-0 bg-transparent px-0 text-sm font-medium shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!canUndo} title={t('editor.menu.undo')} onClick={undo}>
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!canRedo} title={t('editor.menu.redo')} onClick={redo}>
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={run.busy || steps.length === 0}
            title={t('editor.menu.clear')}
            onClick={handleClear}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            title={envHint}
            data-testid="rpa-editor-environment"
            onClick={() => setEnvDialogOpen(true)}
            className={`flex max-w-56 items-center gap-1.5 rounded border px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent ${
              environmentUuid ? 'border-border' : 'border-primary text-primary'
            }`}
          >
            <Laptop className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{envLabel}</span>
          </button>
          <button
            type="button"
            onClick={() => setSettingsDraft(config)}
            className="flex items-center gap-1.5 rounded border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent"
          >
            <Settings className="h-3.5 w-3.5" />
            {t('editor.settings')}
          </button>
          <button
            type="button"
            data-testid="rpa-editor-run"
            onClick={run.busy ? run.stop : handleRun}
            disabled={run.runStatus === 'stopping'}
            className="flex items-center gap-1.5 rounded border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {run.busy ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {run.busy ? t('table.actions.stop') : t('editor.run')}
          </button>
          <button
            type="button"
            data-testid="rpa-editor-save"
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md border border-primary bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? t('editor.saving') : t('editor.save')}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <ComponentPanel onAdd={handleAdd} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/20">
          <StepList
            steps={steps}
            selection={selection}
            busy={run.busy}
            runInfo={run.runInfo}
            issues={issues}
            onSelect={setSelection}
            onMove={handleMove}
            onToggle={handleToggle}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onRunStep={handleRunStep}
            onRunFrom={handleRunFrom}
          />
          <RunLogPanel
            entries={run.log}
            runStatus={run.runStatus}
            onSelectStep={(stepId) => setSelection({ kind: 'step', id: stepId })}
          />
        </div>
        <div className="flex min-h-0 w-80 flex-col overflow-hidden border-l border-border bg-background">
          <Accordion
            type="single"
            collapsible
            value={sidebarSection}
            onValueChange={(value) => setSidebarSection((value as 'properties' | 'variables' | '') ?? '')}
            className="flex min-h-0 flex-1 flex-col"
          >
            <AccordionItem value="properties" className={accordionItemClass('properties')}>
              <AccordionTrigger className="px-3 py-2 text-xs font-semibold hover:no-underline">
                {t('editor.properties')}
              </AccordionTrigger>
              <AccordionContent className={accordionContentClass('properties')}>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <PropertyPanel
                    step={selectedStep}
                    preview={selectedStep ? run.previews[selectedStep.id] : undefined}
                    issue={selectedStep ? issues[selectedStep.id] : undefined}
                    picking={run.picking}
                    pickDisabled={run.busy || run.picking}
                    onUpdateStep={handleUpdateStep}
                    onPick={(step) => void handlePick(step)}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="variables" className={accordionItemClass('variables')}>
              <AccordionTrigger className="px-3 py-2 text-xs font-semibold hover:no-underline">
                {t('editor.variablePanel.title')}
              </AccordionTrigger>
              <AccordionContent className={accordionContentClass('variables')}>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <VariablePanel
                    embedded
                    globalVariables={config.globalVariables}
                    runtimeVariables={runtimeVariables}
                    onGlobalVariablesChange={handleVariablesChange}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {loadingTask && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm text-muted-foreground backdrop-blur-[1px]">
          {t('loading')}
        </div>
      )}

      <EnvironmentSelectorDialog
        open={envDialogOpen}
        onOpenChange={setEnvDialogOpen}
        selectedIds={config.selectedEnvironments}
        onConfirm={(selectedIds) => setConfig((current) => ({ ...current, selectedEnvironments: selectedIds }))}
      />

      <FormattedDialog
        open={settingsDraft !== null}
        onOpenChange={(open) => {
          if (!open) setSettingsDraft(null);
        }}
        header={{ icon: Settings2, title: t('editor.taskSettings') }}
        contentClassName="h-[60vh]"
        contentPadding="p-0"
        minWidth="min-w-[560px]"
      >
        <div className="h-full px-5 py-4">
          {settingsDraft ? <TaskSettingsForm config={settingsDraft} onConfigChange={setSettingsDraft} /> : null}
        </div>
        <FormattedDialogFooter>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setSettingsDraft(null)}>
            {t('dialog.settings.cancel')}
          </Button>
          <Button
            size="sm"
            className="text-xs"
            onClick={() => {
              if (settingsDraft) setConfig(settingsDraft);
              setSettingsDraft(null);
            }}
          >
            {t('dialog.settings.confirm')}
          </Button>
        </FormattedDialogFooter>
      </FormattedDialog>
    </div>
  );
}

export default TaskEditor;
