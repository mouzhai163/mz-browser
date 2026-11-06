interface CdpPendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  cleanup: () => void;
}

interface CdpEventWaiter {
  method: string;
  sessionId?: string;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

interface CdpResponseEnvelope {
  id?: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
  method?: string;
  params?: unknown;
  sessionId?: string;
}

export class CdpClient {
  private socket: WebSocket | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, CdpPendingRequest>();
  private readonly eventWaiters = new Set<CdpEventWaiter>();
  private readonly requestTimeoutMs: number;
  private abortConnection: (() => void) | null = null;

  constructor(options?: { requestTimeoutMs?: number }) {
    this.requestTimeoutMs = options?.requestTimeoutMs ?? 30000;
    if (!Number.isFinite(this.requestTimeoutMs) || this.requestTimeoutMs <= 0) {
      throw new Error('CDP timeout must be a positive finite number');
    }
  }

  async connect(wsUrl: string): Promise<void> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }
    if (this.socket) {
      throw new Error('CDP_CONNECTION_IN_PROGRESS');
    }

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(wsUrl);
      this.socket = socket;
      let settled = false;
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        this.abortConnection = null;
        if (this.socket === socket) this.socket = null;
        reject(error);
        socket.close();
      };
      const timeoutId = setTimeout(
        () => fail(new Error('CDP_CONNECTION_TIMEOUT')),
        this.requestTimeoutMs
      );
      this.abortConnection = () => fail(new Error('CDP_CONNECTION_CLOSED'));

      socket.addEventListener(
        'open',
        () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          this.abortConnection = null;
          resolve();
        },
        { once: true }
      );
      socket.addEventListener('error', () => fail(new Error('Failed to connect to CDP endpoint')), {
        once: true,
      });
      socket.addEventListener('message', (event) => {
        if (this.socket === socket) this.handleMessage(event);
      });
      socket.addEventListener('close', () => {
        if (!settled) {
          fail(new Error('CDP_CONNECTION_CLOSED'));
        }
        // A delayed close event from an old socket must not tear down a new one.
        if (this.socket !== socket) return;
        this.socket = null;
        for (const [, pending] of this.pending) {
          pending.cleanup();
          pending.reject(new Error('CDP_CONNECTION_CLOSED'));
        }
        this.pending.clear();

        for (const waiter of this.eventWaiters) {
          clearTimeout(waiter.timeoutId);
          waiter.reject(new Error('CDP_CONNECTION_CLOSED'));
        }
        this.eventWaiters.clear();
      });
    });
  }

  async send<T>(
    method: string,
    params?: Record<string, unknown>,
    sessionId?: string,
    options?: { signal?: AbortSignal }
  ): Promise<T> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('CDP connection is not open');
    }

    if (options?.signal?.aborted) {
      throw new Error('CDP_REQUEST_ABORTED');
    }
    const socket = this.socket;

    const id = this.nextId++;
    const payload = {
      id,
      method,
      params,
      sessionId,
    };

    return new Promise<T>((resolve, reject) => {
      const signal = options?.signal;
      const cleanup = () => {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', abort);
      };
      const fail = (error: Error) => {
        this.pending.delete(id);
        cleanup();
        reject(error);
      };
      const abort = () => fail(new Error('CDP_REQUEST_ABORTED'));
      const timeoutId = setTimeout(
        () => fail(new Error(`CDP_REQUEST_TIMEOUT: ${method}`)),
        this.requestTimeoutMs
      );
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject, cleanup });
      signal?.addEventListener('abort', abort, { once: true });
      try {
        socket.send(JSON.stringify(payload));
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  async waitForEvent<T = unknown>(
    method: string,
    options?: { sessionId?: string; timeoutMs?: number; signal?: AbortSignal }
  ): Promise<T> {
    const timeoutMs = options?.timeoutMs ?? 10000;
    const signal = options?.signal;
    if (signal?.aborted) {
      throw new Error('CDP_REQUEST_ABORTED');
    }

    return new Promise<T>((resolve, reject) => {
      const onAbort = () => {
        this.eventWaiters.delete(waiter);
        clearTimeout(waiter.timeoutId);
        reject(new Error('CDP_REQUEST_ABORTED'));
      };
      const waiter: CdpEventWaiter = {
        method,
        sessionId: options?.sessionId,
        resolve: (value) => {
          signal?.removeEventListener('abort', onAbort);
          resolve(value as T);
        },
        reject: (reason) => {
          signal?.removeEventListener('abort', onAbort);
          reject(reason);
        },
        timeoutId: setTimeout(() => {
          this.eventWaiters.delete(waiter);
          signal?.removeEventListener('abort', onAbort);
          reject(new Error(`Timed out waiting for CDP event: ${method}`));
        }, timeoutMs),
      };

      signal?.addEventListener('abort', onAbort, { once: true });
      this.eventWaiters.add(waiter);
    });
  }

  close(): void {
    this.abortConnection?.();
    this.socket?.close();
    this.socket = null;
    for (const pending of this.pending.values()) {
      pending.cleanup();
      pending.reject(new Error('CDP_CONNECTION_CLOSED'));
    }
    this.pending.clear();
    for (const waiter of this.eventWaiters) {
      clearTimeout(waiter.timeoutId);
      waiter.reject(new Error('CDP_CONNECTION_CLOSED'));
    }
    this.eventWaiters.clear();
  }

  private handleMessage(event: MessageEvent<string>): void {
    let envelope: CdpResponseEnvelope;
    try {
      envelope = JSON.parse(event.data) as CdpResponseEnvelope;
    } catch {
      return;
    }

    if (typeof envelope.id !== 'number') {
      this.handleEvent(envelope);
      return;
    }

    const pending = this.pending.get(envelope.id);
    if (!pending) {
      return;
    }

    this.pending.delete(envelope.id);
    pending.cleanup();
    if (envelope.error) {
      pending.reject(new Error(envelope.error.message));
      return;
    }

    pending.resolve(envelope.result);
  }

  private handleEvent(envelope: CdpResponseEnvelope): void {
    if (typeof envelope.method !== 'string') {
      return;
    }

    for (const waiter of this.eventWaiters) {
      if (waiter.method !== envelope.method) {
        continue;
      }

      if (waiter.sessionId && waiter.sessionId !== envelope.sessionId) {
        continue;
      }

      this.eventWaiters.delete(waiter);
      clearTimeout(waiter.timeoutId);
      waiter.resolve(envelope.params);
      break;
    }
  }
}
