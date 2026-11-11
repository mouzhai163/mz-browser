import type { BrowserConditionCheck, BrowserExtractOptions } from './browser-adapter';
import type { RpaWorkflowSelector } from '../types';

/**
 * 在页面里执行的脚本，Chromium（CDP）和 Firefox（BiDi）共用。
 * 除了用户自己的脚本步骤，都在隔离环境里执行：页面的 JS 看不到也改不了这些代码。
 * 跨 iframe 时各层的 HTMLElement 不是同一个构造函数，所以这里一律用 nodeType 判断，不用 instanceof。
 */

const PRELUDE = `
  const isEl = (n) => !!n && n.nodeType === 1;
  const deepQueryAll = (root, selector) => {
    const found = Array.from(root.querySelectorAll(selector));
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) found.push(...deepQueryAll(el.shadowRoot, selector));
    }
    return found;
  };
  const textOf = (el) => ((el.innerText ?? el.textContent) || '').replace(/\\s+/g, ' ').trim();
  const accessibleName = (el) =>
    (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('alt') || textOf(el) || el.value || '').trim();
  const ROLE_TAGS = {
    button: 'button,input[type=button],input[type=submit],input[type=reset]',
    link: 'a[href]',
    textbox: 'input:not([type]),input[type=text],input[type=email],input[type=search],input[type=tel],input[type=url],input[type=password],textarea',
    checkbox: 'input[type=checkbox]',
    radio: 'input[type=radio]',
    combobox: 'select',
    heading: 'h1,h2,h3,h4,h5,h6',
    img: 'img',
  };
  const findOne = (root, spec) => {
    const doc = root.ownerDocument || root;
    const value = spec.value;
    try {
      switch (spec.by) {
        case 'xpath':
          return doc.evaluate(value, root, null, 9, null).singleNodeValue;
        case 'text': {
          const all = deepQueryAll(root, 'body *').filter((el) => !['SCRIPT', 'STYLE'].includes(el.tagName));
          const exact = all.filter((el) => textOf(el) === value);
          const partial = exact.length ? exact : all.filter((el) => textOf(el).includes(value));
          return partial.sort((a, b) => textOf(a).length - textOf(b).length || (b.contains(a) ? 1 : -1))[0] || null;
        }
        case 'role': {
          const [role, ...nameParts] = value.split(':');
          const name = nameParts.join(':').trim();
          const selector = '[role="' + role + '"]' + (ROLE_TAGS[role] ? ',' + ROLE_TAGS[role] : '');
          return deepQueryAll(root, selector).find((el) => !name || accessibleName(el).includes(name)) || null;
        }
        case 'label': {
          for (const label of deepQueryAll(root, 'label')) {
            if (!textOf(label).includes(value)) continue;
            const control = label.htmlFor ? doc.getElementById(label.htmlFor) : label.querySelector('input,select,textarea');
            if (control) return control;
          }
          return deepQueryAll(root, '[aria-label]').find((el) => el.getAttribute('aria-label').includes(value)) || null;
        }
        case 'placeholder':
          return deepQueryAll(root, '[placeholder]').find((el) => el.getAttribute('placeholder').includes(value)) || null;
        case 'testid':
          return deepQueryAll(root, '[data-testid],[data-test-id],[data-test]').find((el) =>
            [el.getAttribute('data-testid'), el.getAttribute('data-test-id'), el.getAttribute('data-test')].includes(value)
          ) || null;
        default:
          return deepQueryAll(root, value)[0] || null;
      }
    } catch (error) {
      return null;
    }
  };
  // 按 frames 逐层进入同源 iframe，同时累加偏移，得到相对顶层视口的坐标
  const enterFrames = (frames) => {
    let doc = document;
    let ox = 0;
    let oy = 0;
    for (const xpath of frames || []) {
      const frame = doc.evaluate(xpath, doc, null, 9, null).singleNodeValue;
      if (!isEl(frame) || !frame.contentDocument) return null;
      const rect = frame.getBoundingClientRect();
      ox += rect.left + frame.clientLeft;
      oy += rect.top + frame.clientTop;
      doc = frame.contentDocument;
    }
    return { doc, ox, oy };
  };
  const resolve = (target) => {
    const scope = enterFrames(target.frames);
    if (!scope) return null;
    const specs = [{ by: target.by, value: target.value }, ...(target.candidates || [])];
    for (const spec of specs) {
      const el = findOne(scope.doc, spec);
      if (isEl(el)) return { el, ox: scope.ox, oy: scope.oy, doc: scope.doc };
    }
    return null;
  };
  // 取全部匹配项：CSS 和 XPath 能匹配多个，其他方式只定位一个
  const findAll = (root, spec) => {
    const doc = root.ownerDocument || root;
    try {
      if (spec.by === 'css') return deepQueryAll(root, spec.value);
      if (spec.by === 'xpath') {
        const snapshot = doc.evaluate(spec.value, root, null, 7, null);
        return Array.from({ length: snapshot.snapshotLength }, (_, index) => snapshot.snapshotItem(index));
      }
    } catch (error) {
      return [];
    }
    const one = findOne(root, spec);
    return one ? [one] : [];
  };
  const resolveAll = (target) => {
    const scope = enterFrames(target.frames);
    if (!scope) return [];
    for (const spec of [{ by: target.by, value: target.value }, ...(target.candidates || [])]) {
      const els = findAll(scope.doc, spec).filter(isEl);
      if (els.length) return els;
    }
    return [];
  };
`;

const wrap = (body: string) => `(() => {${PRELUDE}${body}})()`;
const json = (value: unknown) => JSON.stringify(value);

export interface LocateResult {
  found: boolean;
  visible?: boolean;
  obscured?: boolean;
  inView?: boolean;
  disabled?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  viewportWidth?: number;
  viewportHeight?: number;
}

/** 元素的位置和状态（坐标相对顶层视口） */
export function buildLocateExpression(target: RpaWorkflowSelector): string {
  return wrap(`
    const hit = resolve(${json(target)});
    if (!hit) return { found: false };
    const { el, ox, oy, doc } = hit;
    const view = doc.defaultView;
    const style = view.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const visible = style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
    const x = rect.left + ox;
    const y = rect.top + oy;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = x + rect.width / 2;
    const cy = y + rect.height / 2;
    const inView = cx >= 0 && cy >= 0 && cx <= vw && cy <= vh;
    let obscured = false;
    if (visible && inView) {
      let top = doc.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      while (top && top.shadowRoot) {
        const inner = top.shadowRoot.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        if (!inner || inner === top) break;
        top = inner;
      }
      const related = (a, b) => {
        for (let n = a; n; n = n.parentNode || n.host) if (n === b) return true;
        return false;
      };
      obscured = !top || !(related(top, el) || related(el, top));
      // 中心点被滚动容器裁切时，那个位置上是容器外的内容（常常是祖先元素），点下去点不到它。
      // 命中了元素自己就不可能被裁切（比如 fixed 定位的浮层不受祖先的 overflow 影响）
      const hitsElement = top && related(top, el);
      for (let parent = hitsElement ? null : el.parentElement; parent && parent !== doc.body && parent !== doc.documentElement; parent = parent.parentElement) {
        const parentStyle = view.getComputedStyle(parent);
        if (parentStyle.overflowX === 'visible' && parentStyle.overflowY === 'visible') continue;
        const clip = parent.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        if (centerX < clip.left || centerX > clip.right || centerY < clip.top || centerY > clip.bottom) {
          obscured = true;
          break;
        }
      }
    }
    return { found: true, visible, inView, obscured, disabled: !!el.disabled, x, y, width: rect.width, height: rect.height, viewportWidth: vw, viewportHeight: vh };
  `);
}

export function buildScrollIntoViewExpression(
  target: RpaWorkflowSelector,
  block: 'start' | 'center' | 'end' | 'nearest' = 'center'
): string {
  return wrap(`
    const hit = resolve(${json(target)});
    if (!hit) return false;
    hit.el.scrollIntoView({ block: ${json(block)}, inline: 'nearest', behavior: 'auto' });
    return true;
  `);
}

export const SCROLL_STATE_EXPRESSION = `(() => ({
  y: window.scrollY,
  max: Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0) - window.innerHeight,
  height: window.innerHeight,
  width: window.innerWidth,
}))()`;

export const READY_STATE_EXPRESSION = `(() => ({ state: document.readyState, url: location.href }))()`;
export const VISIBILITY_EXPRESSION = `document.visibilityState`;
export const VIEWPORT_EXPRESSION = `(() => ({ width: window.innerWidth, height: window.innerHeight }))()`;

/** 输入框的状态：能否输入、是否已聚焦、当前值 */
export function buildFieldStateExpression(target: RpaWorkflowSelector): string {
  return wrap(`
    const hit = resolve(${json(target)});
    if (!hit) return { found: false };
    const { el, doc } = hit;
    const tag = el.tagName;
    const editable = tag === 'TEXTAREA' || tag === 'INPUT' || el.isContentEditable;
    const value = tag === 'TEXTAREA' || tag === 'INPUT' ? el.value : el.textContent;
    return { found: true, editable, focused: doc.activeElement === el, value: value ?? '', readOnly: !!el.readOnly };
  `);
}

export function buildFocusExpression(target: RpaWorkflowSelector): string {
  return wrap(`
    const hit = resolve(${json(target)});
    if (!hit) return false;
    hit.el.focus();
    return true;
  `);
}

/** 打字打不进去的控件（日期、颜色等）的兜底：直接写值 */
export function buildSetValueExpression(target: RpaWorkflowSelector, value: string): string {
  return wrap(`
    const hit = resolve(${json(target)});
    if (!hit) return false;
    const { el, doc } = hit;
    const view = doc.defaultView;
    const proto = el.tagName === 'TEXTAREA' ? view.HTMLTextAreaElement.prototype : view.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${json(value)});
    el.dispatchEvent(new view.Event('input', { bubbles: true }));
    el.dispatchEvent(new view.Event('change', { bubbles: true }));
    return true;
  `);
}

export function buildSelectOptionExpression(
  target: RpaWorkflowSelector,
  option: { by: 'value' | 'label'; value: string }
): string {
  return wrap(`
    const hit = resolve(${json(target)});
    if (!hit) return 'not_found';
    const { el, doc } = hit;
    if (el.tagName !== 'SELECT') return 'not_select';
    const wanted = ${json(option.value)};
    const match = Array.from(el.options).find((item) =>
      ${json(option.by)} === 'value' ? item.value === wanted : item.label.trim() === wanted || item.text.trim() === wanted
    );
    if (!match) return 'no_option';
    const view = doc.defaultView;
    el.focus();
    el.value = match.value;
    el.dispatchEvent(new view.Event('input', { bubbles: true }));
    el.dispatchEvent(new view.Event('change', { bubbles: true }));
    return 'ok';
  `);
}

/** 返回文件上传框元素本身（给协议的设置文件命令用） */
export function buildUploadTargetExpression(target: RpaWorkflowSelector): string {
  return wrap(`
    const hit = resolve(${json(target)});
    if (!hit) return null;
    const { el, doc } = hit;
    const isFile = (n) => isEl(n) && n.tagName === 'INPUT' && n.type === 'file';
    if (isFile(el)) return el;
    const label = el.tagName === 'LABEL' ? el : el.closest('label');
    if (label) {
      const linked = label.htmlFor ? doc.getElementById(label.htmlFor) : label.querySelector('input[type="file"]');
      if (isFile(linked)) return linked;
    }
    return el.querySelector('input[type="file"]');
  `);
}

export function buildExtractExpression(options: BrowserExtractOptions): string {
  return wrap(`
    const type = ${json(options.extractType)};
    const read = (el) => {
      switch (type) {
        case 'href': {
          // 点到链接里面的标题时，取外层链接的地址
          const link = el.href !== undefined ? el : el.closest('a');
          return (link ? link.href : el.getAttribute('href')) ?? '';
        }
        case 'value':
          return el.value ?? el.getAttribute('value') ?? '';
        case 'html':
          return el.outerHTML;
        case 'attribute':
          return el.getAttribute(${json(options.attribute ?? '')}) ?? '';
        default:
          return textOf(el);
      }
    };
    if (${json(options.all === true)}) {
      const values = resolveAll(${json(options.target)}).map(read).filter((value) => type !== 'text' || value);
      return values.length ? values : null;
    }
    const hit = resolve(${json(options.target)});
    return hit ? read(hit.el) : null;
  `);
}

/** 用户的脚本步骤：在页面自己的环境里执行，可以用页面的变量 */
export function buildExecuteScriptExpression(script: string): string {
  return `(async () => {
    try {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const result = await new AsyncFunction(${json(script)})();
      if (typeof result === 'string') return { ok: true, value: result };
      if (result == null) return { ok: true, value: '' };
      return { ok: true, value: typeof result === 'object' ? JSON.stringify(result) : String(result) };
    } catch (error) {
      return { ok: false, error: error && error.message ? error.message : String(error) };
    }
  })()`;
}

export function buildConditionExpression(condition: BrowserConditionCheck): string {
  if (condition.type === 'text_present') {
    return `(() => (document.body ? document.body.innerText.includes(${json(condition.text)}) : false))()`;
  }
  if (condition.type === 'url_contains') {
    return `location.href.includes(${json(condition.value)})`;
  }
  return wrap(`
    const hit = resolve(${json(condition.target)});
    if (!hit) return false;
    const style = hit.doc.defaultView.getComputedStyle(hit.el);
    const rect = hit.el.getBoundingClientRect();
    return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
  `);
}

export function buildScreenshotClipExpression(target: RpaWorkflowSelector): string {
  return wrap(`
    const hit = resolve(${json(target)});
    if (!hit) return null;
    hit.el.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = hit.el.getBoundingClientRect();
    return {
      x: rect.left + hit.ox + window.scrollX,
      y: rect.top + hit.oy + window.scrollY,
      width: Math.max(rect.width, 1),
      height: Math.max(rect.height, 1),
    };
  `);
}

/**
 * 拾取元素：高亮鼠标下的元素，用户点一下就记录。同时监听同源 iframe。
 * 生成多个候选选择器，优先用稳定的（id、testid、name、aria-label），XPath 兜底。
 */
export const INSTALL_PICKER = wrap(`
  const KEY = '__picker';
  if (window[KEY] && window[KEY].active) { window[KEY].result = null; return true; }

  const xpathOf = (node) => {
    const parts = [];
    for (let current = node; isEl(current); current = current.parentElement) {
      if (current.id && current.namespaceURI === 'http://www.w3.org/1999/xhtml') {
        parts.unshift('//*[@id=' + JSON.stringify(current.id) + ']');
        return parts.join('/');
      }
      let index = 1;
      for (let s = current.previousElementSibling; s; s = s.previousElementSibling) {
        if (s.tagName === current.tagName) index += 1;
      }
      const html = current.namespaceURI === 'http://www.w3.org/1999/xhtml';
      parts.unshift((html ? current.tagName.toLowerCase() : '*[name()=' + JSON.stringify(current.tagName) + ']') + '[' + index + ']');
    }
    return '/' + parts.join('/');
  };
  const cssEscape = (value) => (window.CSS && CSS.escape ? CSS.escape(value) : value);
  const attr = (value) => JSON.stringify(value);
  const candidatesFor = (el, doc) => {
    const list = [];
    const add = (by, value) => { if (value) list.push({ by, value }); };
    if (el.id && !/\\d{4,}/.test(el.id)) add('css', '#' + cssEscape(el.id));
    for (const name of ['data-testid', 'data-test-id', 'data-test']) {
      if (el.getAttribute(name)) add('testid', el.getAttribute(name));
    }
    const tag = el.tagName.toLowerCase();
    if (el.getAttribute('name')) add('css', tag + '[name=' + attr(el.getAttribute('name')) + ']');
    if (el.getAttribute('aria-label')) add('css', tag + '[aria-label=' + attr(el.getAttribute('aria-label')) + ']');
    if (el.getAttribute('placeholder')) add('placeholder', el.getAttribute('placeholder'));
    const text = textOf(el);
    if (text && text.length <= 40 && ['a', 'button', 'label', 'span', 'li', 'h1', 'h2', 'h3'].includes(tag)) add('text', text);
    add('xpath', xpathOf(el));
    // 只留能唯一定位到这个元素的，XPath 兜底总保留
    return list.filter((spec) => spec.by === 'xpath' || findOne(doc, spec) === el);
  };
  // 同类元素的选择器（列表里的每一行）：从最近的稳定 id 祖先往外试，要能匹配多个且包含点中的元素
  const similarFor = (el, doc) => {
    const tag = el.tagName.toLowerCase();
    const classes = Array.from(el.classList)
      .filter((name) => !/\\d{3,}|hover|active|selected|focus/i.test(name))
      .map((name) => '.' + cssEscape(name));
    const tails = classes.length ? [tag + classes.join(''), ...classes.map((name) => tag + name)] : [tag];
    const anchors = [];
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      if (parent.id && !/\\d{4,}/.test(parent.id)) anchors.push('#' + cssEscape(parent.id) + ' ');
    }
    anchors.push('');
    for (const anchor of anchors) {
      for (const tail of tails) {
        if (!anchor && !classes.length) continue;
        const matched = deepQueryAll(doc, anchor + tail);
        if (matched.length > 1 && matched.includes(el)) return { value: anchor + tail, count: matched.length };
      }
    }
    return null;
  };
  // 点在 SVG 图标里时，选外面可点的元素（图标内部的路径没有稳定的选择器）
  const normalize = (el) => {
    if (el.namespaceURI === 'http://www.w3.org/1999/xhtml') return el;
    return el.closest('a,button,[role=button]') || el.closest('svg') || el;
  };
  const framePath = (doc) => {
    const path = [];
    for (let d = doc; d.defaultView && d.defaultView.frameElement; d = d.defaultView.frameElement.ownerDocument) {
      path.unshift(xpathOf(d.defaultView.frameElement));
    }
    return path;
  };
  const docs = [];
  const collect = (doc) => {
    docs.push(doc);
    for (const frame of doc.querySelectorAll('iframe,frame')) {
      try { if (frame.contentDocument) collect(frame.contentDocument); } catch (error) { /* 跨域 */ }
    }
  };
  collect(document);

  const state = {
    active: true,
    result: null,
    highlighted: null,
    outline: '',
    unhighlight() {
      if (state.highlighted) state.highlighted.style.outline = state.outline;
      state.highlighted = null;
    },
    onHover(event) {
      const el = event.composedPath()[0];
      if (!isEl(el) || !el.style) return;
      state.unhighlight();
      state.highlighted = el;
      state.outline = el.style.outline;
      el.style.outline = '2px solid #0ea5e9';
    },
    onClick(event) {
      const raw = event.composedPath()[0];
      if (!isEl(raw)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const el = normalize(raw);
      const doc = el.ownerDocument;
      state.result = {
        candidates: candidatesFor(el, doc),
        similar: similarFor(el, doc),
        frames: framePath(doc),
        tag: el.tagName.toLowerCase(),
        text: textOf(el).slice(0, 200),
        id: el.id || '',
        className: typeof el.className === 'string' ? el.className : '',
        role: el.getAttribute('role') || '',
        name: el.getAttribute('name') || '',
        placeholder: el.getAttribute('placeholder') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
      };
      state.stop();
    },
    stop() {
      state.unhighlight();
      for (const doc of docs) {
        doc.removeEventListener('mouseover', state.onHover, true);
        doc.removeEventListener('click', state.onClick, true);
      }
      state.active = false;
    },
  };
  for (const doc of docs) {
    doc.addEventListener('mouseover', state.onHover, true);
    doc.addEventListener('click', state.onClick, true);
  }
  window[KEY] = state;
  return true;
`);

export const READ_PICKER = `(() => (window.__picker ? window.__picker.result : null))()`;

export const CLEAR_PICKER = `(() => {
  if (window.__picker) { window.__picker.stop(); delete window.__picker; }
  return true;
})()`;
