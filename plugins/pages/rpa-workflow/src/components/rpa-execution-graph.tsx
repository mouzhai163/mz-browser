import { CheckCircle2, CircleDot, Clock3, GitBranch, ScanLine, XCircle } from 'lucide-react';
import type { RpaWorkflowStep } from '../types';
import type { RpaExecutionEnvironmentItem } from '../hooks/use-rpa-execution';

interface RpaExecutionGraphProps {
  steps: RpaWorkflowStep[];
  currentStepId?: string;
  activeEnvironment?: RpaExecutionEnvironmentItem | null;
}

type GraphStepStatus = 'pending' | 'running' | 'awaiting_input' | 'success' | 'failed';
type GraphConnectorStatus = 'pending' | 'running' | 'success' | 'failed';

function getStepStatus(stepId: string, env?: RpaExecutionEnvironmentItem | null, currentStepId?: string): GraphStepStatus {
  if (env?.failedStepId === stepId) {
    return 'failed';
  }

  if (env?.currentStepId === stepId && env.status === 'awaiting_input') {
    return 'awaiting_input';
  }

  if (env?.completedStepIds?.includes(stepId)) {
    return 'success';
  }

  if (currentStepId === stepId || env?.currentStepId === stepId) {
    return 'running';
  }

  return 'pending';
}

function getStepVisual(status: GraphStepStatus) {
  switch (status) {
    case 'running':
      return {
        className:
          'border-blue-500/50 bg-blue-500/10 text-blue-600 shadow-[0_0_0_1px_rgba(59,130,246,0.18),0_0_18px_rgba(59,130,246,0.12)]',
        icon: <ScanLine className="h-3.5 w-3.5" />,
      };
    case 'awaiting_input':
      return {
        className:
          'border-amber-500/50 bg-amber-500/10 text-amber-600 shadow-[0_0_0_1px_rgba(245,158,11,0.18),0_0_18px_rgba(245,158,11,0.12)]',
        icon: <CircleDot className="h-3.5 w-3.5" />,
      };
    case 'success':
      return {
        className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      };
    case 'failed':
      return {
        className: 'border-destructive/50 bg-destructive/10 text-destructive',
        icon: <XCircle className="h-3.5 w-3.5" />,
      };
    default:
      return {
        className: 'border-border bg-background text-muted-foreground',
        icon: <Clock3 className="h-3.5 w-3.5" />,
      };
  }
}

function getConnectorStatus(current: GraphStepStatus, next: GraphStepStatus): GraphConnectorStatus {
  if (current === 'failed' || next === 'failed') {
    return 'failed';
  }

  if (current === 'success' && next === 'success') {
    return 'success';
  }

  if (current === 'running' || current === 'awaiting_input' || next === 'running' || next === 'awaiting_input') {
    return 'running';
  }

  if (current === 'success') {
    return 'success';
  }

  return 'pending';
}

function getConnectorPalette(status: GraphConnectorStatus) {
  switch (status) {
    case 'running':
      return {
        primary: '#3b82f6',
        secondary: '#60a5fa',
        tertiary: '#22d3ee',
        quaternary: '#818cf8',
        subtle: '#93c5fd',
      };
    case 'success':
      return {
        primary: '#10b981',
        secondary: '#34d399',
        tertiary: '#6ee7b7',
        quaternary: '#2dd4bf',
        subtle: '#a7f3d0',
      };
    case 'failed':
      return {
        primary: '#ef4444',
        secondary: '#f87171',
        tertiary: '#fb7185',
        quaternary: '#fca5a5',
        subtle: '#fecaca',
      };
    default:
      return {
        primary: 'rgba(148, 163, 184, 0.45)',
        secondary: 'rgba(148, 163, 184, 0.34)',
        tertiary: 'rgba(148, 163, 184, 0.24)',
        quaternary: 'rgba(148, 163, 184, 0.2)',
        subtle: 'rgba(148, 163, 184, 0.16)',
      };
  }
}

function RpaExecutionConnector({ status }: { status: GraphConnectorStatus }) {
  const palette = getConnectorPalette(status);
  const isRunning = status === 'running';

  return (
    <div className="relative -mx-[2px] h-12 w-24 shrink-0 overflow-visible">
      <svg
        className="absolute inset-0 overflow-visible"
        width="96"
        height="48"
        viewBox="0 0 96 48"
        fill="none"
        aria-hidden="true"
      >
        <style>{`
          @keyframes rpa-execution-connector-dash {
            to { stroke-dashoffset: -24; }
          }
        `}</style>
        <path d="M2 24 C 26 24, 24 8, 48 8 S 70 24, 94 24" stroke={palette.primary} strokeOpacity={isRunning ? 0.28 : 0.18} strokeWidth="2" strokeLinecap="round" />
        <path d="M2 24 C 22 24, 24 11, 48 11 S 74 24, 94 24" stroke={palette.secondary} strokeOpacity={isRunning ? 0.16 : 0.09} strokeWidth="1.15" strokeLinecap="round" />
        <path d="M2 24 C 24 24, 26 14, 48 14 S 72 24, 94 24" stroke={palette.tertiary} strokeOpacity={isRunning ? 0.18 : 0.1} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M2 24 C 23 24, 26 16, 48 16 S 73 24, 94 24" stroke={palette.quaternary} strokeOpacity={isRunning ? 0.12 : 0.07} strokeWidth="1.1" strokeLinecap="round" />
        <path d="M2 24 C 24 24, 26 18, 48 18 S 72 24, 94 24" stroke={palette.secondary} strokeOpacity={isRunning ? 0.14 : 0.08} strokeWidth="1.25" strokeLinecap="round" />
        <path d="M2 24 C 24 24, 26 20, 48 20 S 72 24, 94 24" stroke={palette.subtle} strokeOpacity={isRunning ? 0.11 : 0.06} strokeWidth="1" strokeLinecap="round" />
        <path d="M2 24 C 26 24, 24 40, 48 40 S 70 24, 94 24" stroke={palette.primary} strokeOpacity={isRunning ? 0.22 : 0.14} strokeWidth="2" strokeLinecap="round" />
        <path d="M2 24 C 22 24, 24 37, 48 37 S 74 24, 94 24" stroke={palette.secondary} strokeOpacity={isRunning ? 0.16 : 0.09} strokeWidth="1.15" strokeLinecap="round" />
        <path d="M2 24 C 24 24, 26 30, 48 30 S 72 24, 94 24" stroke={palette.tertiary} strokeOpacity={isRunning ? 0.18 : 0.1} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M2 24 C 23 24, 26 32, 48 32 S 73 24, 94 24" stroke={palette.quaternary} strokeOpacity={isRunning ? 0.12 : 0.07} strokeWidth="1.1" strokeLinecap="round" />
        <path d="M2 24 C 24 24, 26 34, 48 34 S 72 24, 94 24" stroke={palette.secondary} strokeOpacity={isRunning ? 0.14 : 0.08} strokeWidth="1.25" strokeLinecap="round" />
        <path d="M2 24 C 24 24, 26 28, 48 28 S 72 24, 94 24" stroke={palette.subtle} strokeOpacity={isRunning ? 0.11 : 0.06} strokeWidth="1" strokeLinecap="round" />
        <path d="M2 24 C 26 24, 24 8, 48 8 S 70 24, 94 24" stroke={palette.primary} strokeWidth={isRunning ? 2.5 : 2} strokeLinecap="round" strokeDasharray={isRunning ? '8 10' : undefined} style={isRunning ? { animation: 'rpa-execution-connector-dash 1s linear infinite' } : undefined} />
        <path d="M2 24 C 26 24, 24 40, 48 40 S 70 24, 94 24" stroke={palette.primary} strokeWidth={isRunning ? 2.5 : 2} strokeLinecap="round" strokeDasharray={isRunning ? '8 10' : undefined} style={isRunning ? { animation: 'rpa-execution-connector-dash 1s linear infinite 0.18s' } : undefined} />
        <path d="M2 24 C 24 24, 26 14, 48 14 S 72 24, 94 24" stroke={palette.tertiary} strokeWidth={isRunning ? 1.75 : 1.5} strokeLinecap="round" strokeDasharray={isRunning ? '7 12' : undefined} style={isRunning ? { animation: 'rpa-execution-connector-dash 1.08s linear infinite 0.08s' } : undefined} />
        <path d="M2 24 C 24 24, 26 30, 48 30 S 72 24, 94 24" stroke={palette.tertiary} strokeWidth={isRunning ? 1.75 : 1.5} strokeLinecap="round" strokeDasharray={isRunning ? '7 12' : undefined} style={isRunning ? { animation: 'rpa-execution-connector-dash 1.12s linear infinite 0.22s' } : undefined} />
        <path d="M2 24 C 22 24, 24 11, 48 11 S 74 24, 94 24" stroke={palette.secondary} strokeWidth={isRunning ? 1.35 : 1.15} strokeLinecap="round" strokeDasharray={isRunning ? '6 13' : undefined} style={isRunning ? { animation: 'rpa-execution-connector-dash 1.18s linear infinite 0.05s' } : undefined} />
        <path d="M2 24 C 23 24, 26 16, 48 16 S 73 24, 94 24" stroke={palette.quaternary} strokeWidth={isRunning ? 1.25 : 1.1} strokeLinecap="round" strokeDasharray={isRunning ? '5 14' : undefined} style={isRunning ? { animation: 'rpa-execution-connector-dash 1.24s linear infinite 0.14s' } : undefined} />
        <path d="M2 24 C 24 24, 26 20, 48 20 S 72 24, 94 24" stroke={palette.subtle} strokeWidth={isRunning ? 1.1 : 1} strokeLinecap="round" strokeDasharray={isRunning ? '4 15' : undefined} style={isRunning ? { animation: 'rpa-execution-connector-dash 1.3s linear infinite 0.24s' } : undefined} />
        <path d="M2 24 C 22 24, 24 37, 48 37 S 74 24, 94 24" stroke={palette.secondary} strokeWidth={isRunning ? 1.35 : 1.15} strokeLinecap="round" strokeDasharray={isRunning ? '6 13' : undefined} style={isRunning ? { animation: 'rpa-execution-connector-dash 1.18s linear infinite 0.09s' } : undefined} />
        <path d="M2 24 C 23 24, 26 32, 48 32 S 73 24, 94 24" stroke={palette.quaternary} strokeWidth={isRunning ? 1.25 : 1.1} strokeLinecap="round" strokeDasharray={isRunning ? '5 14' : undefined} style={isRunning ? { animation: 'rpa-execution-connector-dash 1.24s linear infinite 0.19s' } : undefined} />
        <path d="M2 24 C 24 24, 26 28, 48 28 S 72 24, 94 24" stroke={palette.subtle} strokeWidth={isRunning ? 1.1 : 1} strokeLinecap="round" strokeDasharray={isRunning ? '4 15' : undefined} style={isRunning ? { animation: 'rpa-execution-connector-dash 1.3s linear infinite 0.29s' } : undefined} />
      </svg>
    </div>
  );
}

export function RpaExecutionGraph({ steps, currentStepId, activeEnvironment }: RpaExecutionGraphProps) {
  if (!steps.length) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border/50 bg-muted/15 p-3 overflow-x-auto">
      <style>{`
        @keyframes rpa-execution-node-glow {
          0%, 100% { box-shadow: 0 0 0 1px rgba(59,130,246,0.18), 0 0 14px rgba(59,130,246,0.10); }
          50% { box-shadow: 0 0 0 1px rgba(59,130,246,0.22), 0 0 22px rgba(59,130,246,0.18); }
        }
        @keyframes rpa-execution-awaiting-glow {
          0%, 100% { box-shadow: 0 0 0 1px rgba(245,158,11,0.18), 0 0 14px rgba(245,158,11,0.10); }
          50% { box-shadow: 0 0 0 1px rgba(245,158,11,0.24), 0 0 22px rgba(245,158,11,0.16); }
        }
      `}</style>
      <div className="flex min-w-max items-center gap-0 pb-1">
        {steps.map((step, index) => {
          const status = getStepStatus(step.id, activeEnvironment, currentStepId);
          const visual = getStepVisual(status);
          const isBranch = Boolean(step.branches && Object.keys(step.branches).length > 0);
          const nextStep = steps[index + 1];
          const connectorStatus = nextStep
            ? getConnectorStatus(status, getStepStatus(nextStep.id, activeEnvironment, currentStepId))
            : null;
          const animationStyle =
            status === 'running'
              ? { animation: 'rpa-execution-node-glow 1.8s ease-in-out infinite' }
              : status === 'awaiting_input'
                ? { animation: 'rpa-execution-awaiting-glow 1.8s ease-in-out infinite' }
                : undefined;

          return (
            <div key={step.id} className="flex items-center gap-0">
              <div
                className={`relative z-[1] flex min-w-[160px] items-center gap-2 rounded-md border px-3 py-2 transition-colors ${visual.className}`}
                style={animationStyle}
              >
                <div className="shrink-0">{visual.icon}</div>
                <div className="min-w-0 flex flex-1 items-center gap-1.5">
                  <div className="truncate text-xs font-medium text-foreground">{step.name}</div>
                  {isBranch ? <GitBranch className="h-3 w-3 shrink-0 text-muted-foreground" /> : null}
                </div>
              </div>
              {connectorStatus ? <RpaExecutionConnector status={connectorStatus} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
