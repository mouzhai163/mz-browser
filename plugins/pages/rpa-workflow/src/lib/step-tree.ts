import type { RpaStepBranch } from '../types';

/** 编辑器里的一步。type 是组件类型（navigate、input…），条件和循环带子步骤 */
export interface EditorStep {
  id: string;
  type: string;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  then?: EditorStep[];
  else?: EditorStep[];
  body?: EditorStep[];
}

export type InsertPosition =
  | { kind: 'before' | 'after'; id: string }
  | { kind: 'branch'; parentId: string; branch: RpaStepBranch; at: 'start' | 'end' }
  | { kind: 'root'; at: 'start' | 'end' };

export function branchesOf(type: string): RpaStepBranch[] {
  if (type === 'condition') return ['then', 'else'];
  if (type === 'loop') return ['body'];
  return [];
}

export function walkSteps(steps: EditorStep[], visit: (step: EditorStep) => void): void {
  for (const step of steps) {
    visit(step);
    for (const branch of branchesOf(step.type)) {
      if (step[branch]) walkSteps(step[branch]!, visit);
    }
  }
}

export function findStep(steps: EditorStep[], id: string): EditorStep | null {
  let found: EditorStep | null = null;
  walkSteps(steps, (step) => {
    if (step.id === id) found = step;
  });
  return found;
}

export function countSteps(steps: EditorStep[]): number {
  let count = 0;
  walkSteps(steps, () => {
    count += 1;
  });
  return count;
}

export function updateStep(
  steps: EditorStep[],
  id: string,
  updater: (step: EditorStep) => EditorStep
): EditorStep[] {
  return steps.map((step) => {
    if (step.id === id) return updater(step);
    const branches = branchesOf(step.type);
    if (branches.length === 0) return step;
    const next = { ...step };
    for (const branch of branches) {
      if (step[branch]) next[branch] = updateStep(step[branch]!, id, updater);
    }
    return next;
  });
}

export function removeStep(steps: EditorStep[], id: string): EditorStep[] {
  return steps
    .filter((step) => step.id !== id)
    .map((step) => {
      const branches = branchesOf(step.type);
      if (branches.length === 0) return step;
      const next = { ...step };
      for (const branch of branches) {
        if (step[branch]) next[branch] = removeStep(step[branch]!, id);
      }
      return next;
    });
}

export function insertStep(steps: EditorStep[], position: InsertPosition, inserted: EditorStep): EditorStep[] {
  if (position.kind === 'root') {
    return position.at === 'start' ? [inserted, ...steps] : [...steps, inserted];
  }
  const result: EditorStep[] = [];
  for (const step of steps) {
    if (position.kind === 'before' && step.id === position.id) result.push(inserted);
    let current = step;
    const branches = branchesOf(step.type);
    if (position.kind === 'branch' && step.id === position.parentId) {
      const list = step[position.branch] ?? [];
      current = {
        ...step,
        [position.branch]: position.at === 'start' ? [inserted, ...list] : [...list, inserted],
      };
    } else if (branches.length > 0) {
      current = { ...step };
      for (const branch of branches) {
        if (step[branch]) current[branch] = insertStep(step[branch]!, position, inserted);
      }
    }
    result.push(current);
    if (position.kind === 'after' && step.id === position.id) result.push(inserted);
  }
  return result;
}

function containsPosition(step: EditorStep, position: InsertPosition): boolean {
  if (position.kind === 'root') return false;
  const targetId = position.kind === 'branch' ? position.parentId : position.id;
  return Boolean(findStep([step], targetId));
}

/** 移动一步。不能移到它自己或自己的子步骤里 */
export function moveStep(steps: EditorStep[], id: string, position: InsertPosition): EditorStep[] {
  const moving = findStep(steps, id);
  if (!moving || containsPosition(moving, position)) return steps;
  return insertStep(removeStep(steps, id), position, moving);
}

/** 深拷贝并换新 id，返回新步骤和旧 id → 新 id 的映射 */
export function cloneWithNewIds(step: EditorStep, makeId: () => string = () => crypto.randomUUID()): EditorStep {
  const copy: EditorStep = { ...step, id: makeId(), config: structuredClone(step.config) };
  for (const branch of branchesOf(step.type)) {
    if (step[branch]) copy[branch] = step[branch]!.map((child) => cloneWithNewIds(child, makeId));
  }
  return copy;
}

export function duplicateStep(steps: EditorStep[], id: string): { steps: EditorStep[]; copyId: string | null } {
  const original = findStep(steps, id);
  if (!original) return { steps, copyId: null };
  const copy = cloneWithNewIds(original);
  return { steps: insertStep(steps, { kind: 'after', id }, copy), copyId: copy.id };
}

export function isInsideLoop(steps: EditorStep[], id: string, inside = false): boolean | null {
  for (const step of steps) {
    if (step.id === id) return inside;
    for (const branch of branchesOf(step.type)) {
      const found = step[branch] ? isInsideLoop(step[branch]!, id, inside || step.type === 'loop') : null;
      if (found !== null) return found;
    }
  }
  return null;
}

/** 步骤列表的一行：步骤本身，或条件/循环里的分支标题 */
export type StepRow =
  | { kind: 'step'; key: string; step: EditorStep; depth: number; number: string }
  | { kind: 'branch'; key: string; parentId: string; branch: RpaStepBranch; depth: number; empty: boolean };

export function flattenRows(steps: EditorStep[], depth = 0, prefix = ''): StepRow[] {
  const rows: StepRow[] = [];
  steps.forEach((step, index) => {
    const number = `${prefix}${index + 1}`;
    rows.push({ kind: 'step', key: step.id, step, depth, number });
    for (const branch of branchesOf(step.type)) {
      const children = step[branch] ?? [];
      rows.push({
        kind: 'branch',
        key: `${step.id}:${branch}`,
        parentId: step.id,
        branch,
        depth: depth + 1,
        empty: children.length === 0,
      });
      rows.push(...flattenRows(children, depth + 1, `${number}.`));
    }
  });
  return rows;
}

// ---------- 旧版图结构转步骤树（导入的旧文件）

export interface GraphNode extends EditorStep {
  nextStepId: string | null;
  parentLoopId: string | null;
  isStart: boolean;
  branchTargets: { true?: string | null; false?: string | null };
  position?: { x: number; y: number };
}

function reachable(byId: Map<string, GraphNode>, from: string | null | undefined): string[] {
  const seen: string[] = [];
  const stack = from ? [from] : [];
  while (stack.length) {
    const id = stack.shift()!;
    const node = byId.get(id);
    if (!node || seen.includes(id)) continue;
    seen.push(id);
    for (const target of [node.nextStepId, node.branchTargets.true, node.branchTargets.false]) {
      if (target) stack.push(target);
    }
  }
  return seen;
}

function plain(node: GraphNode): EditorStep {
  return { id: node.id, type: node.type, name: node.name, config: node.config, enabled: node.enabled };
}

/**
 * 把图结构走一遍转成树：条件的两个分支走到汇合点为止，循环体按子节点走。
 * 走不到的节点放到末尾并禁用，让用户自己决定留不留。
 */
export function graphToTree(nodes: GraphNode[]): { steps: EditorStep[]; orphaned: number } {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visited = new Set<string>();

  const walk = (startId: string | null | undefined, stopId: string | null, within: Set<string> | null): EditorStep[] => {
    const list: EditorStep[] = [];
    let id = startId ?? null;
    while (id && id !== stopId && !visited.has(id) && (!within || within.has(id))) {
      const node = byId.get(id);
      if (!node) break;
      visited.add(id);
      const step = plain(node);
      if (node.type === 'condition') {
        const fromTrue = reachable(byId, node.branchTargets.true);
        const merge = reachable(byId, node.branchTargets.false).find((item) => fromTrue.includes(item)) ?? null;
        step.then = walk(node.branchTargets.true, merge, within);
        step.else = walk(node.branchTargets.false, merge, within);
        list.push(step);
        id = merge ?? node.nextStepId;
        continue;
      }
      if (node.type === 'loop') {
        const children = nodes.filter((child) => child.parentLoopId === node.id);
        const childIds = new Set(children.map((child) => child.id));
        const incoming = new Set(
          children.flatMap((child) => [child.nextStepId, child.branchTargets.true, child.branchTargets.false])
        );
        const entry =
          children
            .filter((child) => !incoming.has(child.id))
            .sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0) || (a.position?.x ?? 0) - (b.position?.x ?? 0))[0] ??
          children[0];
        step.body = entry ? walk(entry.id, null, childIds) : [];
      }
      list.push(step);
      id = node.nextStepId;
    }
    return list;
  };

  const start = nodes.find((node) => node.isStart) ?? nodes[0];
  const steps = start ? walk(start.id, null, null) : [];
  const orphans = nodes.filter((node) => !visited.has(node.id));
  for (const node of orphans) {
    const step = { ...plain(node), enabled: false };
    if (node.type === 'condition') {
      step.then = [];
      step.else = [];
    }
    if (node.type === 'loop') step.body = [];
    steps.push(step);
  }
  return { steps, orphaned: orphans.length };
}
