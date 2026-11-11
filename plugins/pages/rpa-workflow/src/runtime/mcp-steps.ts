import { COMPONENTS } from '../lib/step-catalog';
import { branchesOf, type EditorStep } from '../lib/step-tree';

type Payload = Record<string, unknown>;

/** MCP 传来的步骤补全成编辑器的格式。类型必须是已知字符串，步骤 id 不能重复 */
export function normalizeSteps(raw: unknown[], nameOf: (type: string) => string): EditorStep[] {
  const seen = new Set<string>();

  const normalize = (item: unknown): EditorStep => {
    const input = (item ?? {}) as Payload;
    const type = input.type;
    if (typeof type !== 'string' || !COMPONENTS.some((component) => component.type === type)) {
      throw new Error(`Unknown step type: ${String(type)}`);
    }
    const id = typeof input.id === 'string' && input.id ? input.id : crypto.randomUUID();
    if (seen.has(id)) throw new Error(`Duplicate step id: ${id}`);
    seen.add(id);
    const step: EditorStep = {
      id,
      type,
      name: typeof input.name === 'string' && input.name ? input.name : nameOf(type),
      config: { ...((input.config as Payload | undefined) ?? {}) },
      enabled: input.enabled !== false,
    };
    for (const branch of branchesOf(type)) {
      step[branch] = Array.isArray(input[branch]) ? (input[branch] as unknown[]).map(normalize) : [];
    }
    return step;
  };

  return raw.map(normalize);
}
