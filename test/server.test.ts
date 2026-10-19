import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import type { Aria2Client } from '../src/aria2.js';
import { createServer, executeTool } from '../src/server.js';
import { toolDefinitions } from '../src/tools.js';

const context = { client: {} as Aria2Client };

/** Narrows the MCP content union down to the text block used in these tests. */
function firstText(outcome: { content: unknown[] }): string {
  const block = outcome.content[0] as { text?: string } | undefined;
  return block?.text ?? '';
}

const successTool = {
  name: 'demo_success',
  title: 'Demo',
  description: 'Returns a value',
  inputSchema: {},
  handler: async () => ({ answer: 42 }),
};

const stringTool = {
  name: 'demo_string',
  title: 'Demo',
  description: 'Returns a string',
  inputSchema: {},
  handler: async () => 'plain text',
};

const failureTool = {
  name: 'demo_failure',
  title: 'Demo',
  description: 'Throws',
  inputSchema: {},
  handler: async () => {
    throw new Error('boom');
  },
};

describe('executeTool', () => {
  it('serialises object results as pretty JSON', async () => {
    const outcome = await executeTool(successTool, context);

    expect(outcome.isError).toBeUndefined();
    expect(firstText(outcome)).toBe('{\n  "answer": 42\n}');
  });

  it('passes string results through untouched', async () => {
    const outcome = await executeTool(stringTool, context);

    expect(firstText(outcome)).toBe('plain text');
  });

  it('converts thrown errors into MCP error content instead of rejecting', async () => {
    const outcome = await executeTool(failureTool, context);

    expect(outcome.isError).toBe(true);
    expect(firstText(outcome)).toBe('Error: boom');
  });

  it('handles non-Error throwables', async () => {
    const outcome = await executeTool(
      {
        ...failureTool,
        handler: async () => {
          throw 'nope';
        },
      },
      context,
    );

    expect(firstText(outcome)).toBe('Error: nope');
  });
});

describe('MCP tool surface', () => {
  it('registers every declared tool', () => {
    const names = toolDefinitions.map((definition) => definition.name);

    expect(names).toEqual([
      'aria2_add_uri',
      'aria2_list',
      'aria2_status',
      'aria2_pause',
      'aria2_unpause',
      'aria2_remove',
      'aria2_global_stat',
      'aria2_get_version',
    ]);
  });

  it('serves tools over a real MCP transport', async () => {
    const stubClient = {
      call: async (method: string) => ({ method, version: '1.36.0' }),
    } as unknown as Aria2Client;

    const server = createServer({ client: stubClient });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: 'aria2-mcp-test', version: '1.0.0' });

    await server.connect(serverTransport);
    await mcpClient.connect(clientTransport);

    try {
      const listed = await mcpClient.listTools();
      expect(listed.tools.map((entry) => entry.name)).toEqual(
        toolDefinitions.map((definition) => definition.name),
      );
      expect(listed.tools.every((entry) => Boolean(entry.description))).toBe(true);

      const response = await mcpClient.callTool({
        name: 'aria2_get_version',
        arguments: {},
      });

      expect(response.isError).toBeFalsy();
      expect(response.content).toEqual([
        {
          type: 'text',
          text: '{\n  "method": "aria2.getVersion",\n  "version": "1.36.0"\n}',
        },
      ]);
    } finally {
      await mcpClient.close();
      await server.close();
    }
  });
});
