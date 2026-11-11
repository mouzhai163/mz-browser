import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BaseBrowserAdapter } from '../base-browser-adapter';
import { createBrowserAdapter } from '../create-browser-adapter';
import type { RpaWorkflowSelector } from '../../types';

/**
 * 用真实内核验证浏览器操作。由 cr-tools/live-rpa.py 启动环境后设置 LIVE_RPA_WS 运行；平时自动跳过。
 */
const wsUrl = process.env.LIVE_RPA_WS ?? '';
const css = (value: string): RpaWorkflowSelector => ({ by: 'css', value });

const FIXTURE = `<!doctype html><meta charset=utf-8><title>fixture</title>
<style>body{margin:20px;font:16px sans-serif} .spacer{height:2400px}</style>
<input id=name placeholder="your name" value="old"><textarea id=area></textarea>
<button id=go data-testid=go-button>Go</button>
<button id=dbl>Double</button><button id=ctx>Ctx</button>
<select id=sel><option value=a>Apple</option><option value=b>Banana</option></select>
<input id=file type=file>
<a id=pop href=/popup target=_blank>popup</a>
<button id=alert>alert</button>
<a id=nav href=/second>next page</a>
<div id=cover-host style="position:relative;width:120px;height:30px"><button id=covered>Covered</button>
<div id=cover style="position:absolute;inset:0;background:#fff"></div></div>
<iframe id=frm src=/frame width=300 height=80></iframe>
<div id=host></div>
<svg id=icon width=24 height=24 onclick="log('svg')"><circle cx=12 cy=12 r=10></circle></svg>
<div id=result>extracted text</div>
<div id=scroller style="height:60px;width:200px;overflow:auto"><div style="height:50px"></div><button id=clipped style="height:40px">Clipped</button><div style="height:300px"></div></div>
<div style="width:20px;height:20px;overflow:hidden"><button id=floating style="position:fixed;right:8px;top:8px;width:60px;height:24px">Float</button></div>
<ul id=rows><li class="row a1"><a href=/one><b class=title>one</b></a></li><li class="row"><a href=/two><b class=title>two</b></a></li><li class=row><a href=/three><b class=title>three</b></a></li><li class=row><b class=title></b></li></ul>
<div id=slot></div>
<div class=spacer></div><button id=far>Far</button>
<script>
window.__log = {clicks:[], moves:0, keys:[], wheels:0, input:0, change:0, svg:0, dbl:0, ctx:0, fileChange:0};
const log=(n)=>{ if(n==='svg') __log.svg++; };
document.addEventListener('mousemove',()=>__log.moves++,true);
document.addEventListener('wheel',()=>__log.wheels++,true);
document.addEventListener('keydown',e=>__log.keys.push({key:e.key,trusted:e.isTrusted}),true);
document.addEventListener('click',e=>__log.clicks.push({id:e.target.id,trusted:e.isTrusted,x:e.clientX,y:e.clientY}),true);
document.addEventListener('dblclick',()=>__log.dbl++,true);
document.addEventListener('contextmenu',e=>{__log.ctx++;e.preventDefault()},true);
file.addEventListener('change',()=>__log.fileChange++);
document.getElementById('alert').onclick=()=>{alert('hello');__log.alertDone=true};
setTimeout(()=>{const b=document.createElement('button');b.id='late';b.textContent='Late';slot.append(b)},1500);
setTimeout(()=>cover.remove(),1200);
const sh=host.attachShadow({mode:'open'});sh.innerHTML='<button id=inshadow>Shadow</button>';
sh.getElementById('inshadow').onclick=e=>__log.shadow=e.isTrusted;
window.__cdp=false;
const probe=new Error();Object.defineProperty(probe,'stack',{get(){window.__cdp=true;return ''}});
setInterval(()=>console.debug(probe),200);
</script>`;

const FRAME = `<!doctype html><meta charset=utf-8><button id=inner onclick="parent.__log.frame=event.isTrusted">Inner</button>`;
const SECOND = `<!doctype html><meta charset=utf-8><title>second</title><h1 id=h>second page</h1>`;
const POPUP = `<!doctype html><meta charset=utf-8><title>popup</title><h1 id=p>popup page</h1>`;

describe.skipIf(!wsUrl)('real browser', () => {
  let server: http.Server;
  let base = '';
  let adapter: BaseBrowserAdapter;
  const pages = () => (adapter as unknown as { listPages(): Promise<{ id: string; url: string }[]> }).listPages();
  const log = async () => JSON.parse(await adapter.executeScript('return JSON.stringify(window.__log)'));
  const main = () => adapter.goto(`${base}/`, { newTab: false });

  beforeAll(async () => {
    server = http.createServer((request, response) => {
      const body = request.url === '/frame' ? FRAME : request.url === '/second' ? SECOND : request.url === '/popup' ? POPUP : FIXTURE;
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(body);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    adapter = createBrowserAdapter(wsUrl) as BaseBrowserAdapter;
    await adapter.connect({ envUuid: 'live', browserWsUrl: wsUrl }, { speed: 'fast' });
    await adapter.goto(`${base}/`, { newTab: true });
  }, 60000);

  afterAll(async () => {
    adapter?.close();
    server?.close();
  });

  it('types with trusted key events, including Chinese, replacing old text', async () => {
    await adapter.fill(css('#name'), 'Hi 中文!');
    expect(await adapter.extract({ target: css('#name'), extractType: 'value' })).toBe('Hi 中文!');
    const { keys } = await log();
    expect(keys.filter((key: { key: string }) => key.key === 'H')).toHaveLength(1);
    expect(keys.every((key: { trusted: boolean }) => key.trusted)).toBe(true);
  }, 30000);

  it('clicks with a trusted event at real coordinates after moving the mouse', async () => {
    const before = await log();
    await adapter.click(css('#go'));
    const after = await log();
    const click = after.clicks.at(-1);
    expect(click).toMatchObject({ id: 'go', trusted: true });
    expect(click.x).toBeGreaterThan(0);
    expect(after.moves).toBeGreaterThan(before.moves + 2);
  }, 30000);

  it('double and right click', async () => {
    await adapter.click(css('#dbl'), { clickCount: 2 });
    await adapter.click(css('#ctx'), { button: 'right' });
    const after = await log();
    expect(after.dbl).toBe(1);
    expect(after.ctx).toBe(1);
  }, 30000);

  it('waits for an element that appears later', async () => {
    await main();
    await adapter.click(css('#late'), { timeoutMs: 8000 });
    expect((await log()).clicks.at(-1)).toMatchObject({ id: 'late', trusted: true });
  }, 30000);

  it('waits until a covering element goes away', async () => {
    await main();
    await adapter.click(css('#covered'), { timeoutMs: 8000 });
    expect((await log()).clicks.at(-1)).toMatchObject({ id: 'covered' });
  }, 30000);

  it('fails cleanly when an element never appears', async () => {
    await expect(adapter.click(css('#nope'), { timeoutMs: 600 })).rejects.toMatchObject({ code: 'ELEMENT_NOT_FOUND' });
  }, 30000);

  it('selects by text, testid and placeholder', async () => {
    await adapter.click({ by: 'text', value: 'Double' });
    await adapter.click({ by: 'testid', value: 'go-button' });
    await adapter.fill({ by: 'placeholder', value: 'your name' }, 'x');
    const { clicks } = await log();
    expect(clicks.map((click: { id: string }) => click.id)).toEqual(expect.arrayContaining(['dbl', 'go']));
  }, 30000);

  it('selects a dropdown option', async () => {
    await adapter.selectOption(css('#sel'), { by: 'label', value: 'Banana' });
    expect(await adapter.extract({ target: css('#sel'), extractType: 'value' })).toBe('b');
  }, 30000);

  it('extracts text and waits for it', async () => {
    expect(await adapter.extract({ target: css('#result'), extractType: 'text' })).toBe('extracted text');
    await expect(adapter.extract({ target: css('#nope'), extractType: 'text', timeoutMs: 400 })).rejects.toMatchObject({
      code: 'ELEMENT_NOT_FOUND',
    });
  }, 30000);

  it('scrolls to a far element with the wheel', async () => {
    await main();
    await adapter.click(css('#far'));
    const after = await log();
    expect(after.wheels).toBeGreaterThan(0);
    expect(after.clicks.at(-1)).toMatchObject({ id: 'far', trusted: true });
  }, 40000);

  it('clicks inside a same-origin iframe', async () => {
    await main();
    await adapter.click({ by: 'css', value: '#inner', frames: ['//*[@id="frm"]'] });
    expect((await log()).frame).toBe(true);
  }, 30000);

  it('clicks inside an open shadow root', async () => {
    await adapter.click(css('#inshadow'));
    expect((await log()).shadow).toBe(true);
  }, 30000);

  it('clicks an SVG element', async () => {
    await adapter.click(css('#icon'));
    expect((await log()).svg).toBe(1);
  }, 30000);

  it('uploads a file and fires change exactly once', async () => {
    const file = path.join(os.tmpdir(), `mz-rpa-${Date.now()}.txt`);
    fs.writeFileSync(file, 'hello');
    await adapter.uploadFile(css('#file'), file);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect((await log()).fileChange).toBe(1);
    fs.unlinkSync(file);
  }, 30000);

  it('a JS alert does not block the run', async () => {
    await adapter.click(css('#alert'));
    expect((await log()).alertDone).toBe(true);
  }, 40000);

  it('waits for navigation after a click', async () => {
    await main();
    await adapter.click(css('#nav'));
    expect(await adapter.extract({ target: css('#h'), extractType: 'text' })).toBe('second page');
    await adapter.goBack();
    expect(await adapter.extract({ target: css('#result'), extractType: 'text' })).toBe('extracted text');
  }, 40000);

  it('follows a tab opened by a click', async () => {
    await main();
    await adapter.click(css('#pop'));
    expect(await adapter.extract({ target: css('#p'), extractType: 'text' })).toBe('popup page');
  }, 40000);

  it('reuses the tab when the same step runs again, then cleans up', async () => {
    await adapter.goto(`${base}/second`, { newTab: true, reuseKey: 'step-1' });
    const count = (await pages()).length;
    await adapter.goto(`${base}/second`, { newTab: true, reuseKey: 'step-1' });
    await adapter.goto(`${base}/second`, { newTab: true, reuseKey: 'step-1' });
    expect((await pages()).length).toBe(count);
    await adapter.goto(`${base}/`, { newTab: true });
    await adapter.finishRun();
    const left = await pages();
    expect(left.filter((page) => page.url.startsWith(base))).toHaveLength(1);
  }, 60000);

  it('switches and closes tabs by position', async () => {
    await adapter.goto(`${base}/second`, { newTab: true });
    const list = await pages();
    await adapter.selectTab(list.length);
    await adapter.closeTab(list.length);
    expect((await pages()).length).toBe(list.length - 1);
  }, 40000);

  it('clicks an element clipped by a scrolling container', async () => {
    await main();
    await adapter.click(css('#clipped'), { timeoutMs: 8000 });
    const clicks = (await log()).clicks as { id: string; trusted: boolean }[];
    expect(clicks.at(-1)).toMatchObject({ id: 'clipped', trusted: true });
  }, 30000);

  it('clicks a fixed element inside a clipping container', async () => {
    await main();
    await adapter.click(css('#floating'), { timeoutMs: 8000 });
    const clicks = (await log()).clicks as { id: string; trusted: boolean }[];
    expect(clicks.at(-1)).toMatchObject({ id: 'floating', trusted: true });
  }, 30000);

  it('extracts every match', async () => {
    await main();
    const all = (value: string, extractType: 'text' | 'href', by: 'css' | 'xpath' = 'css') =>
      adapter.extract({ target: { by, value }, extractType, all: true, timeoutMs: 3000 }).then((text) => JSON.parse(text));
    expect(await all('#rows .title', 'text')).toEqual(['one', 'two', 'three']);
    expect(await all('//ul[@id="rows"]//b', 'text', 'xpath')).toEqual(['one', 'two', 'three']);
    expect((await all('#rows a .title', 'href')).map((url: string) => new URL(url).pathname)).toEqual(['/one', '/two', '/three']);
    await expect(
      adapter.extract({ target: css('#rows .missing'), extractType: 'text', all: true, timeoutMs: 400 })
    ).rejects.toMatchObject({ code: 'ELEMENT_NOT_FOUND' });
  }, 30000);

  it('offers a selector for similar elements when picking from a list', async () => {
    await adapter.goto(`${base}/`, { newTab: true });
    const clicker = createBrowserAdapter(wsUrl) as BaseBrowserAdapter;
    await clicker.connect({ envUuid: 'live', browserWsUrl: wsUrl }, { speed: 'fast' });
    (clicker as unknown as { currentPage: string | null }).currentPage = (
      adapter as unknown as { currentPage: string | null }
    ).currentPage;
    const picking = adapter.pickElement(20000);
    await new Promise((resolve) => setTimeout(resolve, 800));
    await clicker.click(css('#rows li:nth-child(2) .title')).catch(() => undefined);
    clicker.close();
    const captured = await picking;
    expect(captured.similar).toEqual({ value: '#rows b.title', count: 4 });
  }, 60000);

  it('picks an element by a real click and returns stable selectors', async () => {
    await adapter.goto(`${base}/`, { newTab: true });
    const clicker = createBrowserAdapter(wsUrl) as BaseBrowserAdapter;
    await clicker.connect({ envUuid: 'live', browserWsUrl: wsUrl }, { speed: 'fast' });
    (clicker as unknown as { currentPage: string | null }).currentPage = (
      adapter as unknown as { currentPage: string | null }
    ).currentPage;
    const picking = adapter.pickElement(20000);
    await new Promise((resolve) => setTimeout(resolve, 800));
    await clicker.click(css('#go')).catch(() => undefined);
    clicker.close();
    const captured = await picking;
    expect(captured.primary).toMatchObject({ by: 'css', value: '#go' });
    expect(captured.candidates.some((item) => item.by === 'testid')).toBe(true);
  }, 60000);

  it('leaves nothing visible to the page', async () => {
    const seen = await adapter.executeScript(
      'return JSON.stringify({picker: typeof window.__picker, marker: document.querySelectorAll("[data-mz-upload-marker]").length})'
    );
    expect(JSON.parse(seen)).toEqual({ picker: 'undefined', marker: 0 });
  }, 30000);

  it('is not detected through Runtime.enable', async () => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(await adapter.executeScript('return String(window.__cdp)')).toBe('false');
  }, 30000);
});
