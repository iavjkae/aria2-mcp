import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { ToolContext, ToolDefinition } from './tools.js';
import { toolDefinitions } from './tools.js';
import { SERVER_NAME, VERSION } from './version.js';

export type ToolCallOutcome = CallToolResult;

function serialise(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

/**
 * Executes a tool by name. Exported separately from the MCP wiring so it can
 * be unit tested without standing up a transport.
 */
export async function executeTool(
  definition: ToolDefinition,
  context: ToolContext,
  args: Record<string, unknown> = {},
): Promise<ToolCallOutcome> {
  try {
    const data = await definition.handler(context, args);
    return { content: [{ type: 'text', text: serialise(data) }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
  }
}

/** Builds the MCP server and registers every aria2 tool. */
export function createServer(context: ToolContext): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: VERSION });

  for (const tool of toolDefinitions) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      async (args: Record<string, unknown>) => executeTool(tool, context, args),
    );
  }

  return server;
}
