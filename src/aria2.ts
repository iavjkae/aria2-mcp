import type { Aria2Config } from './config.js';

/** An error returned by aria2, or a transport-level failure talking to it. */
export class Aria2Error extends Error {
  readonly code: number | undefined;

  constructor(message: string, code?: number) {
    super(message);
    this.name = 'Aria2Error';
    this.code = code;
  }
}

interface JsonRpcSuccess<T> {
  jsonrpc: '2.0';
  id: string;
  result: T;
}

interface JsonRpcFailure {
  jsonrpc: '2.0';
  id: string;
  error: { code: number; message: string; data?: unknown };
}

export type FetchLike = typeof fetch;

/**
 * Minimal aria2 JSON-RPC client.
 *
 * The secret, when present, is always sent as the first positional parameter
 * (`token:<secret>`), as required by the aria2 RPC specification.
 */
export class Aria2Client {
  #requestId = 0;

  constructor(
    private readonly config: Aria2Config,
    private readonly fetchImpl: FetchLike = globalThis.fetch,
  ) {}

  async call<T = unknown>(method: string, params: readonly unknown[] = []): Promise<T> {
    if (!method.trim()) {
      throw new Aria2Error('RPC method must not be empty');
    }

    const token = this.config.secret ? [`token:${this.config.secret}`] : [];
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: String(++this.#requestId),
      method,
      params: [...token, ...params],
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(this.config.rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body,
        signal: controller.signal,
      });
    } catch (error) {
      throw new Aria2Error(describeTransportFailure(error));
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new Aria2Error(`aria2 RPC responded with HTTP ${response.status}`);
    }

    let payload: JsonRpcSuccess<T> | JsonRpcFailure;
    try {
      payload = (await response.json()) as JsonRpcSuccess<T> | JsonRpcFailure;
    } catch {
      throw new Aria2Error('aria2 RPC returned a malformed JSON payload');
    }

    if ('error' in payload && payload.error) {
      throw new Aria2Error(payload.error.message, payload.error.code);
    }

    if (!('result' in payload)) {
      throw new Aria2Error('aria2 RPC response did not contain a result');
    }

    return payload.result;
  }
}

function describeTransportFailure(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return 'aria2 RPC request timed out';
    }
    return `cannot reach aria2 RPC endpoint: ${error.message}`;
  }
  return 'cannot reach aria2 RPC endpoint';
}
