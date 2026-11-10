import type { BrowserConditionCheck, BrowserExtractOptions } from './browser-adapter';
import type { RpaWorkflowSelector } from '../types';

// 在页面里执行的脚本。和协议无关：Chromium（CDP）和 Firefox（BiDi）的适配器执行的是同一份。

export function buildUploadTargetExpression(target: RpaWorkflowSelector): string {
  const targetValue = JSON.stringify(target.value);
  const resolveElement =
    target.by === 'xpath'
      ? `document.evaluate(${targetValue}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`
      : `document.querySelector(${targetValue})`;

  return `(() => {
    const element = ${resolveElement};
    if (!(element instanceof Element)) {
      return null;
    }

    const resolveFileInput = (node) => {
      if (node instanceof HTMLInputElement && node.type === 'file') {
        return node;
      }

      if (node instanceof HTMLLabelElement && node.htmlFor) {
        const linked = document.getElementById(node.htmlFor);
        if (linked instanceof HTMLInputElement && linked.type === 'file') {
          return linked;
        }
      }

      if (node instanceof Element) {
        const nested = node.querySelector('input[type="file"]');
        if (nested instanceof HTMLInputElement) {
          return nested;
        }

        const closestLabel = node.closest('label');
        if (closestLabel instanceof HTMLLabelElement) {
          if (closestLabel.htmlFor) {
            const linked = document.getElementById(closestLabel.htmlFor);
            if (linked instanceof HTMLInputElement && linked.type === 'file') {
              return linked;
            }
          }

          const labelNested = closestLabel.querySelector('input[type="file"]');
          if (labelNested instanceof HTMLInputElement) {
            return labelNested;
          }
        }
      }

      return null;
    };

    return resolveFileInput(element);
  })()`;
}

export function buildExtractExpression(options: BrowserExtractOptions): string {
  const targetValue = JSON.stringify(options.target.value);
  const resolveElement =
    options.target.by === 'xpath'
      ? `document.evaluate(${targetValue}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`
      : `document.querySelector(${targetValue})`;

  if (options.extractType === 'href') {
    return `(() => {
      const element = ${resolveElement};
      if (!(element instanceof Element)) {
        return '';
      }
      return element.getAttribute('href') ?? (element instanceof HTMLAnchorElement ? element.href : '');
    })()`;
  }

  if (options.extractType === 'value') {
    return `(() => {
      const element = ${resolveElement};
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
      ) {
        return element.value ?? '';
      }
      if (element instanceof Element) {
        return element.getAttribute('value') ?? '';
      }
      return '';
    })()`;
  }

  return `(() => {
    const element = ${resolveElement};
    if (element instanceof HTMLElement) {
      return (element.innerText ?? element.textContent ?? '').trim();
    }
    if (element instanceof Element) {
      return (element.textContent ?? '').trim();
    }
    return '';
  })()`;
}

export function buildExecuteScriptExpression(script: string): string {
  const scriptBody = JSON.stringify(script);
  return `(async () => {
    try {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const runner = new AsyncFunction(${scriptBody});
      const result = await runner();
      if (typeof result === 'string') {
        return { ok: true, value: result };
      }
      if (result == null) {
        return { ok: true, value: '' };
      }
      if (typeof result === 'object') {
        return { ok: true, value: JSON.stringify(result) };
      }
      return { ok: true, value: String(result) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error ?? 'SCRIPT_EXECUTION_FAILED') };
    }
  })()`;
}

export function buildConditionExpression(condition: BrowserConditionCheck): string {
  if (condition.type === 'text_present') {
    const textValue = JSON.stringify(condition.text);
    return `(() => document.body?.innerText?.includes(${textValue}) ?? false)()`;
  }

  if (condition.type === 'url_contains') {
    const fragmentValue = JSON.stringify(condition.value);
    return `(() => window.location.href.includes(${fragmentValue}))()`;
  }

  return buildWaitForExpression(condition.target);
}

export function buildWaitForExpression(target: RpaWorkflowSelector): string {
  const targetValue = JSON.stringify(target.value);
  const resolveElement =
    target.by === 'xpath'
      ? `document.evaluate(${targetValue}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`
      : `document.querySelector(${targetValue})`;

  return `(() => {
    const element = ${resolveElement};
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
  })()`;
}

export function buildScreenshotClipExpression(target: RpaWorkflowSelector): string {
  const targetValue = JSON.stringify(target.value);
  const resolveElement =
    target.by === 'xpath'
      ? `document.evaluate(${targetValue}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`
      : `document.querySelector(${targetValue})`;

  return `(() => {
    const element = ${resolveElement};
    if (!(element instanceof HTMLElement)) {
      return null;
    }

    element.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: Math.max(rect.width, 1),
      height: Math.max(rect.height, 1),
    };
  })()`;
}

export function buildScrollExpression(options: {
  mode: 'to_element' | 'by_viewport' | 'to_edge';
  target?: RpaWorkflowSelector;
  direction?: 'down' | 'up';
  viewportCount?: number;
  edge?: 'top' | 'bottom';
  block?: 'start' | 'center' | 'end' | 'nearest';
}): string {
  if (options.mode === 'to_element') {
    const target = options.target;
    if (!target) {
      return 'false';
    }
    const targetValue = JSON.stringify(target.value);
    const block = JSON.stringify(options.block ?? 'center');
    const resolveElement =
      target.by === 'xpath'
        ? `document.evaluate(${targetValue}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`
        : `document.querySelector(${targetValue})`;

    return `(() => {
      const element = ${resolveElement};
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      element.scrollIntoView({ block: ${block}, inline: 'nearest', behavior: 'auto' });
      return true;
    })()`;
  }

  if (options.mode === 'by_viewport') {
    const viewportCount = Math.max(Number(options.viewportCount ?? 1) || 1, 1);
    const sign = options.direction === 'up' ? -1 : 1;
    return `(() => {
      window.scrollBy({ top: window.innerHeight * ${sign * viewportCount}, behavior: 'auto' });
      return true;
    })()`;
  }

  const topValue = options.edge === 'top' ? '0' : 'Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)';
  return `(() => {
    window.scrollTo({ top: ${topValue}, behavior: 'auto' });
    return true;
  })()`;
}

export function buildFillExpression(target: RpaWorkflowSelector, value: string): string {
  const targetValue = JSON.stringify(target.value);
  const inputValue = JSON.stringify(value);
  const resolveElement =
    target.by === 'xpath'
      ? `document.evaluate(${targetValue}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`
      : `document.querySelector(${targetValue})`;

  return `(() => {
    const element = ${resolveElement};
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    element.scrollIntoView({ block: 'center', inline: 'center' });
    element.focus();

    const applyValue = (input) => {
      const prototype = input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
      if (descriptor?.set) {
        descriptor.set.call(input, ${inputValue});
      } else {
        input.value = ${inputValue};
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return applyValue(element);
    }

    if (element.isContentEditable) {
      element.textContent = ${inputValue};
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    return false;
  })()`;
}

export function buildClickExpression(target: RpaWorkflowSelector): string {
  const targetValue = JSON.stringify(target.value);

  if (target.by === 'xpath') {
    return `(() => {
      const element = document.evaluate(${targetValue}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      element.scrollIntoView({ block: 'center', inline: 'center' });
      element.click();
      return true;
    })()`;
  }

  return `(() => {
    const element = document.querySelector(${targetValue});
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    element.scrollIntoView({ block: 'center', inline: 'center' });
    element.click();
    return true;
  })()`;
}

/** 让用户在页面上点一下来选元素：高亮鼠标下的元素，记录点到的元素的 XPath 等信息 */
export const INSTALL_CLICK_CAPTURE = `(() => {
  const key = '__mzRpaClickCapture';
  const existing = window[key];
  if (existing?.active) {
    existing.result = null;
    return true;
  }

  const buildXPath = (node) => {
    if (!(node instanceof Element)) return '';
    if (node.id) {
      return '//*[@id=' + JSON.stringify(node.id) + ']';
    }

    const parts = [];
    let current = node;
    while (current && current.nodeType === 1) {
      let index = 1;
      let sibling = current.previousElementSibling;
      while (sibling) {
        if (sibling.tagName === current.tagName) {
          index += 1;
        }
        sibling = sibling.previousElementSibling;
      }
      parts.unshift(current.tagName.toLowerCase() + '[' + index + ']');
      current = current.parentElement;
    }
    return '//' + parts.join('/');
  };

  const restoreInteractiveFeedback = (element) => {
    if (!(element instanceof HTMLElement)) {
      return;
    }

    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLButtonElement ||
      element instanceof HTMLAnchorElement ||
      element.isContentEditable
    ) {
      element.focus();
    }
  };

  const cleanup = (element) => {
    document.removeEventListener('click', state.onClick, true);
    if (state.highlighted instanceof HTMLElement) {
      state.highlighted.style.outline = state.previousOutline || '';
    }
    document.removeEventListener('mouseover', state.onHover, true);
    state.active = false;
    restoreInteractiveFeedback(element);
  };

  const state = {
    active: true,
    result: null,
    highlighted: null,
    previousOutline: '',
    onHover: (event) => {
      const element = event.target instanceof HTMLElement ? event.target : null;
      if (!element) return;
      if (state.highlighted instanceof HTMLElement) {
        state.highlighted.style.outline = state.previousOutline || '';
      }
      state.highlighted = element;
      state.previousOutline = element.style.outline || '';
      element.style.outline = '2px solid #0ea5e9';
    },
    onClick: (event) => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      state.result = {
        xpath: buildXPath(element),
        tag: element.tagName.toLowerCase(),
        text: (element.textContent || '').trim().slice(0, 200),
        id: element.id || '',
        className: typeof element.className === 'string' ? element.className : '',
        role: element.getAttribute('role') || '',
        name: element.getAttribute('name') || '',
        placeholder: element.getAttribute('placeholder') || '',
        ariaLabel: element.getAttribute('aria-label') || '',
      };
      cleanup(element);
    },
  };

  document.addEventListener('mouseover', state.onHover, true);
  document.addEventListener('click', state.onClick, true);
  window[key] = state;
  return true;
})()`;

export const READ_CLICK_CAPTURE = `(() => {
  const state = window.__mzRpaClickCapture;
  return state?.result ?? null;
})()`;

export const CLEAR_CLICK_CAPTURE = `(() => {
  const key = '__mzRpaClickCapture';
  const state = window[key];
  if (state?.highlighted instanceof HTMLElement) {
    state.highlighted.style.outline = state.previousOutline || '';
  }
  if (state?.onClick) {
    document.removeEventListener('click', state.onClick, true);
  }
  if (state?.onHover) {
    document.removeEventListener('mouseover', state.onHover, true);
  }
  delete window[key];
  return true;
})()`;
