import { describe, expect, it, vi } from 'vitest';

import { Aria2Client, Aria2Error, type FetchLike } from '../src/aria2.js';
import type { Aria2Config } from '../src/config.js';

const config: Aria2Config = {
  rpcUrl: 'http://aria2.test/jsonrpc',
  secret: 's3cret',
  timeoutMs: 5000,
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function clientWith(fetchImpl: FetchLike, overrides: Partial<Aria2Config> = {}) {
  return new Aria2Client({ ...config, ...overrides }, fetchImpl);
}

describe('Aria2Client', () => {
  it('sends the token as the first positional parameter', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ jsonrpc: '2.0', id: '1', result: 'ok' }),
    );

    await clientWith(fetchImpl as unknown as FetchLike).call('aria2.getVersion');

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://aria2.test/jsonrpc');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toMatchObject({
      jsonrpc: '2.0',
      method: 'aria2.getVersion',
      params: ['token:s3cret'],
    });
  });

  it('omits the token when no secret is configured', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ jsonrpc: '2.0', id: '1', result: 'ok' }),
    );

    await clientWith(fetchImpl as unknown as FetchLike, { secret: undefined }).call(
      'aria2.getVersion',
    );

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).params).toEqual([]);
  });

  it('appends caller parameters after the token', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ jsonrpc: '2.0', id: '1', result: ['gid'] }),
    );

    await clientWith(fetchImpl as unknown as FetchLike).call('aria2.addUri', [
      ['https://example.test/file.bin'],
      { dir: '/downloads' },
    ]);

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).params).toEqual([
      'token:s3cret',
      ['https://example.test/file.bin'],
      { dir: '/downloads' },
    ]);
  });

  it('increments the request id per call', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ jsonrpc: '2.0', id: '1', result: 'ok' }),
    );
    const client = clientWith(fetchImpl as unknown as FetchLike);

    await client.call('aria2.getVersion');
    await client.call('aria2.getVersion');

    const bodies = fetchImpl.mock.calls.map((call) =>
      JSON.parse(String((call as unknown as [string, RequestInit])[1].body)),
    );
    expect(bodies[0].id).toBe('1');
    expect(bodies[1].id).toBe('2');
  });

  it('returns the RPC result', async () => {
    const fetchImpl = async () =>
      jsonResponse({ jsonrpc: '2.0', id: '1', result: { version: '1.36.0' } });

    const result = await clientWith(fetchImpl).call<{ version: string }>(
      'aria2.getVersion',
    );
    expect(result).toEqual({ version: '1.36.0' });
  });

  it('maps JSON-RPC errors to Aria2Error', async () => {
    const fetchImpl = async () =>
      jsonResponse({
        jsonrpc: '2.0',
        id: '1',
        error: { code: 1, message: 'Unauthorized' },
      });

    await expect(clientWith(fetchImpl).call('aria2.getVersion')).rejects.toThrowError(
      new Aria2Error('Unauthorized', 1),
    );
  });

  it('maps HTTP failures to Aria2Error', async () => {
    const fetchImpl = async () => new Response('nope', { status: 502 });

    await expect(clientWith(fetchImpl).call('aria2.getVersion')).rejects.toThrowError(
      /HTTP 502/,
    );
  });

  it('rejects malformed JSON payloads', async () => {
    const fetchImpl = async () => new Response('<html></html>', { status: 200 });

    await expect(clientWith(fetchImpl).call('aria2.getVersion')).rejects.toThrowError(
      /malformed JSON/,
    );
  });

  it('rejects payloads without a result', async () => {
    const fetchImpl = async () => jsonResponse({ jsonrpc: '2.0', id: '1' });

    await expect(clientWith(fetchImpl).call('aria2.getVersion')).rejects.toThrowError(
      /did not contain a result/,
    );
  });

  it('reports transport failures without leaking the endpoint secret', async () => {
    const fetchImpl = async () => {
      throw new Error('connect ECONNREFUSED');
    };

    await expect(clientWith(fetchImpl).call('aria2.getVersion')).rejects.toThrowError(
      /cannot reach aria2 RPC endpoint: connect ECONNREFUSED/,
    );
  });

  it('aborts requests that exceed the timeout', async () => {
    const fetchImpl: FetchLike = (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });

    await expect(
      clientWith(fetchImpl, { timeoutMs: 10 }).call('aria2.getVersion'),
    ).rejects.toThrowError(/timed out/);
  });

  it('rejects an empty method name', async () => {
    const fetchImpl = vi.fn();

    await expect(
      clientWith(fetchImpl as unknown as FetchLike).call('  '),
    ).rejects.toThrowError(/must not be empty/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
