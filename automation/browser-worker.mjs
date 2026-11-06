// One-shot, read-only CDP adapter. Never launches or closes the browser itself.
export function validateEndpoint(value) {
  const url = new URL(value);
  if (
    url.protocol !== 'ws:' ||
    url.hostname !== '127.0.0.1' ||
    Number(url.port) < 29200 ||
    Number(url.port) > 29499 ||
    !url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/devtools\/browser\/[\w-]+$/.test(url.pathname)
  ) {
    throw new Error('INVALID_CDP_ENDPOINT');
  }
  return url.href;
}

export function authorizedUrl(value, origins) {
  try {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      origins.includes(url.origin)
    );
  } catch {
    return false;
  }
}

export function publicUrl(value) {
  const url = new URL(value);
  return `${url.origin}${url.pathname}`.slice(0, 2048);
}

export function summarizeNodes(nodes) {
  const byId = new Map(nodes.map((node) => [node.nodeId, node]));
  const editable = (node) =>
    ['textbox', 'searchbox', 'combobox', 'spinbutton'].includes(node.role?.value) ||
    node.properties?.some((property) => property.name === 'editable' && property.value?.value);
  const blocked = new Set();
  const queue = nodes
    .filter((node) =>
      node.properties?.some((property) => property.name === 'protected' && property.value?.value)
    )
    .map((node) => node.nodeId);
  for (const node of nodes.filter(editable)) queue.push(...(node.childIds ?? []));
  while (queue.length) {
    const id = queue.pop();
    if (blocked.has(id)) continue;
    blocked.add(id);
    queue.push(...(byId.get(id)?.childIds ?? []));
  }
  return nodes
    .filter((node) => !node.ignored && !blocked.has(node.nodeId))
    .slice(0, 400)
    .map((node) => ({
      id: String(node.nodeId).slice(0, 100),
      role: String(node.role?.value ?? '').slice(0, 100),
      name: editable(node) ? '[editable field]' : String(node.name?.value ?? '').slice(0, 300),
      children: (node.childIds ?? [])
        .filter((id) => !blocked.has(id))
        .slice(0, 20)
        .map((id) => String(id).slice(0, 100)),
    }));
}

export class CdpConnection {
  constructor(WebSocketClass = globalThis.WebSocket) {
    this.WebSocketClass = WebSocketClass;
    this.pending = new Map();
    this.nextId = 1;
    this.onEvent = () => {};
  }

  async connect(endpoint) {
    const socket = new this.WebSocketClass(validateEndpoint(endpoint));
    this.socket = socket;
    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        if (!message.id) {
          this.onEvent(message);
          return;
        }
        const request = this.pending.get(message.id);
        if (!request) return;
        this.pending.delete(message.id);
        clearTimeout(request.timer);
        if (message.error) request.reject(new Error('CDP_COMMAND_FAILED'));
        else request.resolve(message.result);
      } catch {
        /* Ignore malformed, non-protocol messages. */
      }
    });
    socket.addEventListener('close', () => {
      for (const request of this.pending.values()) {
        clearTimeout(request.timer);
        request.reject(new Error('CDP_CONNECTION_CLOSED'));
      }
      this.pending.clear();
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('CDP_CONNECTION_TIMEOUT'));
        socket.close();
      }, 5000);
      const fail = () => {
        clearTimeout(timer);
        reject(new Error('CDP_CONNECTION_FAILED'));
      };
      socket.addEventListener(
        'open',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
      socket.addEventListener('error', fail, { once: true });
      socket.addEventListener('close', fail, { once: true });
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('CDP_COMMAND_TIMEOUT'));
      }, 5000);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.socket.send(JSON.stringify({ id, method, params, sessionId }));
      } catch {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new Error('CDP_SEND_FAILED'));
      }
    });
  }

  close() {
    this.socket?.close();
  }
}

function assertFrames(tree, origins) {
  if (!authorizedUrl(tree.frame.url, origins)) throw new Error('FRAME_ORIGIN_NOT_AUTHORIZED');
  for (const child of tree.childFrames ?? []) assertFrames(child, origins);
}

export async function executeRead(request, connection = new CdpConnection()) {
  if (!['tabs', 'snapshot'].includes(request.action) || !Array.isArray(request.allowedOrigins)) {
    throw new Error('ACTION_NOT_ALLOWED');
  }
  try {
    await connection.connect(request.endpoint);
    const { targetInfos } = await connection.send('Target.getTargets');
    const pages = targetInfos.filter(
      (target) => target.type === 'page' && authorizedUrl(target.url, request.allowedOrigins)
    );
    if (request.action === 'tabs') {
      return {
        pages: pages.slice(0, 100).map((page) => ({
          pageId: page.targetId,
          title: page.title.slice(0, 256),
          url: publicUrl(page.url),
        })),
      };
    }
    const page = pages.find((target) => target.targetId === request.pageId);
    if (!page) throw new Error('PAGE_NOT_AUTHORIZED');
    const { sessionId } = await connection.send('Target.attachToTarget', {
      targetId: page.targetId,
      flatten: true,
    });
    let changed = false;
    connection.onEvent = (event) => {
      if (
        event.sessionId === sessionId &&
        ['Page.frameNavigated', 'Page.frameDetached'].includes(event.method)
      )
        changed = true;
    };
    await connection.send('Page.enable', {}, sessionId);
    assertFrames(
      (await connection.send('Page.getFrameTree', {}, sessionId)).frameTree,
      request.allowedOrigins
    );
    const { nodes } = await connection.send('Accessibility.getFullAXTree', { depth: 8 }, sessionId);
    const finalPage = (await connection.send('Target.getTargetInfo', { targetId: page.targetId }))
      .targetInfo;
    assertFrames(
      (await connection.send('Page.getFrameTree', {}, sessionId)).frameTree,
      request.allowedOrigins
    );
    if (
      changed ||
      !authorizedUrl(finalPage.url, request.allowedOrigins) ||
      finalPage.url !== page.url
    ) {
      throw new Error('PAGE_CHANGED_RETRY');
    }
    return {
      pageId: page.targetId,
      url: publicUrl(finalPage.url),
      nodes: summarizeNodes(nodes),
      truncated: nodes.length > 400,
    };
  } finally {
    connection.close(); // Detach only; never Browser.close or Target.closeTarget.
  }
}

export async function runWorker() {
  try {
    let input = '';
    for await (const chunk of process.stdin) {
      input += chunk;
      if (Buffer.byteLength(input) > 65536) throw new Error('REQUEST_TOO_LARGE');
    }
    const data = await executeRead(JSON.parse(input));
    process.stdout.write(JSON.stringify({ ok: true, data }));
  } catch (error) {
    const code = /^[A-Z_]+$/.test(error?.message ?? '') ? error.message : 'BROWSER_READ_FAILED';
    process.stdout.write(JSON.stringify({ ok: false, error: code }));
    process.exitCode = 1;
  }
}

if (process.argv.includes('--stdio')) await runWorker();
