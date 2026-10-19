import { describe, expect, it, vi } from 'vitest';

import type { Aria2Client } from '../src/aria2.js';
import { toolDefinitions, type ToolDefinition } from '../src/tools.js';

function tool(name: string): ToolDefinition {
  const found = toolDefinitions.find((definition) => definition.name === name);
  if (!found) {
    throw new Error(`Unknown tool in test: ${name}`);
  }
  return found;
}

function fakeClient(responses: Record<string, unknown> = {}) {
  const calls: Array<{ method: string; params: readonly unknown[] }> = [];
  const call = vi.fn(async (method: string, params: readonly unknown[] = []) => {
    calls.push({ method, params });
    return method in responses ? responses[method] : 'ok';
  });
  return { client: { call } as unknown as Aria2Client, calls, call };
}

describe('tool definitions', () => {
  it('exposes unique, non-empty names', () => {
    const names = toolDefinitions.map((definition) => definition.name);

    expect(names).toHaveLength(new Set(names).size);
    for (const name of names) {
      expect(name).toMatch(/^aria2_[a-z_]+$/);
    }
  });

  it('documents every tool', () => {
    for (const definition of toolDefinitions) {
      expect(definition.title.length).toBeGreaterThan(0);
      expect(definition.description.length).toBeGreaterThan(0);
    }
  });
});

describe('aria2_add_uri', () => {
  it('sends only the URI list when no options are given', async () => {
    const { client, calls } = fakeClient({ 'aria2.addUri': 'gid-1' });

    const result = await tool('aria2_add_uri').handler(
      { client },
      { uris: ['https://example.test/a.bin'] },
    );

    expect(result).toEqual({ gid: 'gid-1', status: 'queued' });
    expect(calls[0]).toEqual({
      method: 'aria2.addUri',
      params: [['https://example.test/a.bin']],
    });
  });

  it('appends an options object when options are provided', async () => {
    const { client, calls } = fakeClient({ 'aria2.addUri': 'gid-2' });

    await tool('aria2_add_uri').handler(
      { client },
      {
        uris: ['magnet:?xt=urn:btih:abc'],
        dir: '/downloads',
        out: 'file.bin',
        header: ['Cookie: a=b'],
      },
    );

    expect(calls[0]?.params).toEqual([
      ['magnet:?xt=urn:btih:abc'],
      { dir: '/downloads', out: 'file.bin', header: ['Cookie: a=b'] },
    ]);
  });
});

describe('aria2_list', () => {
  it('defaults to the active queue', async () => {
    const { client, calls } = fakeClient({ 'aria2.tellActive': [] });

    await tool('aria2_list').handler({ client }, {});

    expect(calls.map((call) => call.method)).toEqual(['aria2.tellActive']);
  });

  it('queries all three queues when state is "all"', async () => {
    const { client, calls } = fakeClient();

    await tool('aria2_list').handler({ client }, { state: 'all' });

    expect(calls.map((call) => call.method)).toEqual([
      'aria2.tellActive',
      'aria2.tellWaiting',
      'aria2.tellStopped',
    ]);
  });

  it('queries only the requested queue', async () => {
    const { client, calls } = fakeClient({ 'aria2.tellStopped': [] });

    const result = await tool('aria2_list').handler({ client }, { state: 'stopped' });

    expect(result).toEqual({ stopped: [] });
    expect(calls).toHaveLength(1);
  });
});

describe('aria2_status', () => {
  it('requests the status keys for the given gid', async () => {
    const { client, calls } = fakeClient({ 'aria2.tellStatus': { gid: 'g1' } });

    await tool('aria2_status').handler({ client }, { gid: 'g1' });

    expect(calls[0]?.method).toBe('aria2.tellStatus');
    expect(calls[0]?.params[0]).toBe('g1');
    expect(calls[0]?.params[1]).toContain('downloadSpeed');
  });
});

describe('aria2_pause / aria2_unpause', () => {
  it('pauses a download', async () => {
    const { client, calls } = fakeClient({ 'aria2.pause': 'g1' });

    await expect(tool('aria2_pause').handler({ client }, { gid: 'g1' })).resolves.toEqual(
      { gid: 'g1', status: 'paused' },
    );
    expect(calls[0]).toEqual({ method: 'aria2.pause', params: ['g1'] });
  });

  it('resumes a download', async () => {
    const { client, calls } = fakeClient({ 'aria2.unpause': 'g1' });

    await expect(
      tool('aria2_unpause').handler({ client }, { gid: 'g1' }),
    ).resolves.toEqual({ gid: 'g1', status: 'active' });
    expect(calls[0]).toEqual({ method: 'aria2.unpause', params: ['g1'] });
  });
});

describe('aria2_remove', () => {
  it('removes an active download and purges its result', async () => {
    const { client, calls } = fakeClient({
      'aria2.remove': 'g1',
      'aria2.removeDownloadResult': 'OK',
    });

    const result = await tool('aria2_remove').handler({ client }, { gid: 'g1' });

    expect(result).toEqual({ removed: 'g1', resultPurged: true });
    expect(calls.map((call) => call.method)).toEqual([
      'aria2.remove',
      'aria2.removeDownloadResult',
    ]);
  });

  it('uses forceRemove when force is set', async () => {
    const { client, calls } = fakeClient({ 'aria2.forceRemove': 'g1' });

    await tool('aria2_remove').handler({ client }, { gid: 'g1', force: true });

    expect(calls[0]?.method).toBe('aria2.forceRemove');
  });

  it('still purges the result when the download is already stopped', async () => {
    const client = {
      call: vi.fn(async (method: string) => {
        if (method === 'aria2.remove') {
          throw new Error('Cannot remove stopped download');
        }
        return 'OK';
      }),
    } as unknown as Aria2Client;

    const result = await tool('aria2_remove').handler({ client }, { gid: 'g1' });

    expect(result).toMatchObject({ removed: null, resultPurged: true });
  });
});

describe('stateless tools', () => {
  it('fetches global statistics', async () => {
    const { client, calls } = fakeClient({ 'aria2.getGlobalStat': { numActive: '0' } });

    await expect(tool('aria2_global_stat').handler({ client }, {})).resolves.toEqual({
      numActive: '0',
    });
    expect(calls[0]?.method).toBe('aria2.getGlobalStat');
  });

  it('fetches the aria2 version', async () => {
    const { client, calls } = fakeClient({ 'aria2.getVersion': { version: '1.36.0' } });

    await expect(tool('aria2_get_version').handler({ client }, {})).resolves.toEqual({
      version: '1.36.0',
    });
    expect(calls[0]?.method).toBe('aria2.getVersion');
  });
});
