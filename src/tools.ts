import { z } from 'zod';

import type { Aria2Client } from './aria2.js';

/** Fields requested from aria2 when describing a download. */
export const STATUS_KEYS = [
  'gid',
  'status',
  'totalLength',
  'completedLength',
  'uploadLength',
  'downloadSpeed',
  'uploadSpeed',
  'connections',
  'numSeeders',
  'seeder',
  'errorCode',
  'errorMessage',
  'dir',
  'files',
  'bittorrent',
  'followedBy',
  'following',
  'belongsTo',
] as const;

export interface ToolContext {
  client: Aria2Client;
}

export type ToolArgs = Record<string, unknown>;

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodRawShape;
  handler: (context: ToolContext, args: ToolArgs) => Promise<unknown>;
}

/**
 * Declares a tool while preserving argument inference at the definition site.
 * The MCP layer validates `args` against `inputSchema` before calling `handler`.
 */
function defineTool<Shape extends z.ZodRawShape>(definition: {
  name: string;
  title: string;
  description: string;
  inputSchema: Shape;
  handler: (context: ToolContext, args: z.infer<z.ZodObject<Shape>>) => Promise<unknown>;
}): ToolDefinition {
  return {
    name: definition.name,
    title: definition.title,
    description: definition.description,
    inputSchema: definition.inputSchema,
    handler: (context, args) =>
      definition.handler(context, args as z.infer<z.ZodObject<Shape>>),
  };
}

const gidSchema = z
  .string()
  .min(1)
  .describe('Download GID returned by aria2_add_uri or aria2_list');

export const toolDefinitions: readonly ToolDefinition[] = [
  defineTool({
    name: 'aria2_add_uri',
    title: 'Add URI download',
    description:
      'Queue one or more download URIs (HTTP, HTTPS, FTP, SFTP or magnet links) and return the new GID.',
    inputSchema: {
      uris: z.array(z.string().min(1)).min(1).describe('Download URIs to queue'),
      dir: z.string().min(1).optional().describe('Absolute target directory'),
      out: z.string().min(1).optional().describe('Output file name'),
      header: z
        .array(z.string().min(1))
        .optional()
        .describe('Extra HTTP headers, for example "Cookie: session=abc"'),
    },
    handler: async ({ client }, args) => {
      const options: Record<string, unknown> = {};
      if (args.dir !== undefined) {
        options.dir = args.dir;
      }
      if (args.out !== undefined) {
        options.out = args.out;
      }
      if (args.header !== undefined && args.header.length > 0) {
        options.header = args.header;
      }

      const params: unknown[] = [args.uris];
      if (Object.keys(options).length > 0) {
        params.push(options);
      }

      const gid = await client.call<string>('aria2.addUri', params);
      return { gid, status: 'queued' };
    },
  }),

  defineTool({
    name: 'aria2_list',
    title: 'List downloads',
    description:
      'List downloads by state. `all` returns active, waiting and stopped lists in one response.',
    inputSchema: {
      state: z
        .enum(['active', 'waiting', 'stopped', 'all'])
        .default('active')
        .describe('Which download queue to inspect'),
    },
    handler: async ({ client }, args) => {
      const state = args.state ?? 'active';
      const result: Record<string, unknown> = {};

      if (state === 'active' || state === 'all') {
        result.active = await client.call('aria2.tellActive', [STATUS_KEYS]);
      }
      if (state === 'waiting' || state === 'all') {
        result.waiting = await client.call('aria2.tellWaiting', [0, 1000, STATUS_KEYS]);
      }
      if (state === 'stopped' || state === 'all') {
        result.stopped = await client.call('aria2.tellStopped', [0, 1000, STATUS_KEYS]);
      }

      return result;
    },
  }),

  defineTool({
    name: 'aria2_status',
    title: 'Download status',
    description: 'Return the full status record of a single download.',
    inputSchema: { gid: gidSchema },
    handler: async ({ client }, args) =>
      client.call('aria2.tellStatus', [args.gid, STATUS_KEYS]),
  }),

  defineTool({
    name: 'aria2_pause',
    title: 'Pause download',
    description: 'Pause an active or waiting download.',
    inputSchema: { gid: gidSchema },
    handler: async ({ client }, args) => {
      const gid = await client.call<string>('aria2.pause', [args.gid]);
      return { gid, status: 'paused' };
    },
  }),

  defineTool({
    name: 'aria2_unpause',
    title: 'Resume download',
    description: 'Resume a paused download.',
    inputSchema: { gid: gidSchema },
    handler: async ({ client }, args) => {
      const gid = await client.call<string>('aria2.unpause', [args.gid]);
      return { gid, status: 'active' };
    },
  }),

  defineTool({
    name: 'aria2_remove',
    title: 'Remove download',
    description:
      'Remove a download and purge its result entry. Set `force` to interrupt checksum verification.',
    inputSchema: {
      gid: gidSchema,
      force: z
        .boolean()
        .default(false)
        .describe('Use aria2.forceRemove instead of aria2.remove'),
    },
    handler: async ({ client }, args) => {
      const method = args.force ? 'aria2.forceRemove' : 'aria2.remove';
      const result: Record<string, unknown> = {};

      try {
        result.removed = await client.call<string>(method, [args.gid]);
      } catch (error) {
        // The download may already be stopped; still try to purge the result.
        result.removed = null;
        result.note = error instanceof Error ? error.message : String(error);
      }

      try {
        await client.call('aria2.removeDownloadResult', [args.gid]);
        result.resultPurged = true;
      } catch {
        result.resultPurged = false;
      }

      return result;
    },
  }),

  defineTool({
    name: 'aria2_global_stat',
    title: 'Global statistics',
    description: 'Return aggregate download and upload speeds plus queue counters.',
    inputSchema: {},
    handler: async ({ client }) => client.call('aria2.getGlobalStat'),
  }),

  defineTool({
    name: 'aria2_get_version',
    title: 'aria2 version',
    description: 'Return the aria2 version and the features it was built with.',
    inputSchema: {},
    handler: async ({ client }) => client.call('aria2.getVersion'),
  }),
];

export const toolNames: readonly string[] = toolDefinitions.map((tool) => tool.name);
