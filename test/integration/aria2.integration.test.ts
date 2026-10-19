import { describe, expect, it } from 'vitest';

import { Aria2Client } from '../../src/aria2.js';
import { loadConfig } from '../../src/config.js';

const rpcUrl = process.env.ARIA2_RPC_URL;

/**
 * Opt-in integration test. It never contains a real endpoint: set
 * ARIA2_RPC_URL (and optionally ARIA2_RPC_SECRET) to run it locally.
 */
describe.skipIf(!rpcUrl)('integration: live aria2', () => {
  it('reports the aria2 version', async () => {
    const client = new Aria2Client(loadConfig());
    const version = await client.call<{ version: string }>('aria2.getVersion');

    expect(version.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('returns global statistics', async () => {
    const client = new Aria2Client(loadConfig());
    const stats = await client.call<Record<string, string>>('aria2.getGlobalStat');

    expect(stats).toHaveProperty('downloadSpeed');
    expect(stats).toHaveProperty('numActive');
  });
});
