import { describe, expect, it } from 'vitest';
import type { RpaWorkflowStep } from '../../types';
import { validateSteps } from '../validate-workflow';

const step = (id: string, type: string, extra: Partial<RpaWorkflowStep> = {}): RpaWorkflowStep => ({
  id,
  type,
  name: id,
  enabled: true,
  ...extra,
});
const target = { by: 'css' as const, value: '#a' };

describe('validateSteps', () => {
  it('accepts a complete workflow', () => {
    expect(
      validateSteps([step('a', 'goto', { url: 'https://a.test' }), step('b', 'fill', { target, value: 'x' })])
    ).toEqual([]);
  });

  it('reports missing fields on the right step', () => {
    expect(
      validateSteps([
        step('a', 'goto', { url: '' }),
        step('b', 'click'),
        step('c', 'fill', { target, value: '  ' }),
      ])
    ).toEqual([
      { stepId: 'a', code: 'URL_REQUIRED' },
      { stepId: 'b', code: 'TARGET_REQUIRED' },
      { stepId: 'c', code: 'TEXT_REQUIRED' },
    ]);
  });

  it('rejects a bad URL but allows a variable', () => {
    expect(validateSteps([step('a', 'goto', { url: 'not a url' })])).toEqual([{ stepId: 'a', code: 'URL_INVALID' }]);
    expect(validateSteps([step('a', 'goto', { url: '{{site}}' })])).toEqual([]);
  });

  it('checks nested steps and ignores disabled ones', () => {
    expect(
      validateSteps([
        step('l', 'loop', { body: [step('c', 'click')] }),
        step('off', 'click', { enabled: false }),
      ])
    ).toEqual([{ stepId: 'c', code: 'TARGET_REQUIRED' }]);
  });

  it('allows break only inside a loop', () => {
    expect(validateSteps([step('b', 'break_loop')])).toEqual([{ stepId: 'b', code: 'BREAK_OUTSIDE_LOOP' }]);
    expect(
      validateSteps([
        step('l', 'loop', {
          body: [step('c', 'condition', { target, then: [step('b', 'break_loop')] })],
        }),
      ])
    ).toEqual([]);
  });
});
