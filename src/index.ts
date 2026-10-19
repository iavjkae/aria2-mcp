#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { Aria2Client } from './aria2.js';
import { ConfigError, loadConfig, redactUrl } from './config.js';
import { createServer } from './server.js';

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      // stderr only: stdout is reserved for the MCP protocol stream.
      console.error(`aria2-mcp: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  const client = new Aria2Client(config);
  const server = createServer({ client });
  const transport = new StdioServerTransport();

  await server.connect(transport);

  const auth = config.secret ? 'token auth' : 'no auth';
  console.error(`aria2-mcp: connected to ${redactUrl(config.rpcUrl)} (${auth})`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`aria2-mcp: fatal error: ${message}`);
  process.exit(1);
});
