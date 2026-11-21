import type { ReactNode } from 'react';
import { Globe, Laptop, Network, Server, ShieldCheck, User } from 'lucide-react';
import type { NetworkMode } from './types';

interface LinkFlowDiagramProps {
  mode: NetworkMode;
}

interface FlowNode {
  key: string;
  label: string;
  icon: ReactNode;
  iconBg: string;
}

export function LinkFlowDiagram({ mode }: LinkFlowDiagramProps) {
  const nodes: FlowNode[] =
    mode === 'direct'
      ? [
          {
            key: 'client',
            label: '客户端',
            icon: <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />,
            iconBg: 'bg-blue-500/15',
          },
          {
            key: 'proxy',
            label: '代理IP',
            icon: <ShieldCheck className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />,
            iconBg: 'bg-cyan-500/15',
          },
          {
            key: 'target',
            label: '目标网站',
            icon: <Globe className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />,
            iconBg: 'bg-emerald-500/15',
          },
        ]
      : mode === 'system_proxy'
        ? [
            {
              key: 'client',
              label: '客户端',
              icon: <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />,
              iconBg: 'bg-blue-500/15',
            },
            {
              key: 'system',
              label: '系统代理',
              icon: <Laptop className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />,
              iconBg: 'bg-indigo-500/15',
            },
            {
              key: 'proxy',
              label: '代理IP',
              icon: <ShieldCheck className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />,
              iconBg: 'bg-cyan-500/15',
            },
            {
              key: 'target',
              label: '目标网站',
              icon: <Globe className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />,
              iconBg: 'bg-emerald-500/15',
            },
          ]
        : [
            {
              key: 'client',
              label: '客户端',
              icon: <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />,
              iconBg: 'bg-blue-500/15',
            },
            {
              key: 'relay',
              label: '中转节点',
              icon: <Server className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />,
              iconBg: 'bg-violet-500/15',
            },
            {
              key: 'proxy',
              label: '代理IP',
              icon: <ShieldCheck className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />,
              iconBg: 'bg-cyan-500/15',
            },
            {
              key: 'target',
              label: '目标网站',
              icon: <Globe className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />,
              iconBg: 'bg-emerald-500/15',
            },
          ];

  const gradients = [
    'from-blue-500 to-violet-500',
    'from-violet-500 to-cyan-500',
    'from-cyan-500 to-emerald-500',
  ];

  return (
    <div className="rounded-xl border border-border/60 bg-background/70 px-4 py-3.5">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Network className="h-3.5 w-3.5 text-violet-500" />
        <span>访问链路</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        {nodes.map((node, idx) => (
          <div key={node.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-border/70 bg-card px-3.5 py-2 shadow-xs">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full ${node.iconBg}`}
              >
                {node.icon}
              </span>
              <span className="text-[13px] font-medium text-foreground">{node.label}</span>
            </div>
            {idx < nodes.length - 1 && (
              <div
                className={`mx-2 h-[3px] flex-1 rounded-full bg-gradient-to-r ${
                  gradients[idx % gradients.length]
                } opacity-80`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
