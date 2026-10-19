# aria2-mcp

A Model Context Protocol (MCP) server for the [aria2](https://aria2.github.io/) download
manager. It exposes aria2's JSON-RPC API as a small, focused set of MCP tools so an agent
can queue, inspect, pause, resume and remove downloads.

[![CI](https://img.shields.io/github/actions/workflow/status/iavjkae/aria2-mcp/ci.yml?branch=main&label=ci)](https://github.com/iavjkae/aria2-mcp/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

## Features

- Speaks the MCP stdio transport, so it works with any MCP-compatible client.
- Talks to aria2 over its JSON-RPC interface, including `--rpc-secret` authentication.
- Strict input validation and structured error reporting.
- No runtime dependencies beyond the official MCP SDK.
- Fully typed, linted, formatted and unit tested.

## Requirements

- Node.js 20 or newer.
- A reachable aria2 RPC endpoint. Start aria2 with RPC enabled:

```bash
aria2c --enable-rpc --rpc-listen-port=6800 --rpc-secret=your_secret
```

## Installation

Use it straight from GitHub without cloning:

```bash
npx -y github:iavjkae/aria2-mcp
```

Or install it globally:

```bash
npm install -g github:iavjkae/aria2-mcp
aria2-mcp
```

## Configuration

Configuration is read from the environment. The server never ships with a default
endpoint and never writes credentials to disk.

| Variable           | Required | Default | Description                                                                   |
| ------------------ | -------- | ------- | ----------------------------------------------------------------------------- |
| `ARIA2_RPC_URL`    | yes      | —       | Full JSON-RPC endpoint, e.g. `http://127.0.0.1:6800/jsonrpc`                  |
| `ARIA2_RPC_SECRET` | no       | —       | Value passed to `--rpc-secret`; `secret` and `token:secret` are both accepted |
| `ARIA2_TIMEOUT_MS` | no       | `30000` | Per-request timeout in milliseconds                                           |

`ARIA2_RPC_URL` must use `http` or `https` and must not embed credentials; a value like
`http://user:pass@127.0.0.1/jsonrpc` is rejected on purpose.

### MCP client configuration

```json
{
  "mcpServers": {
    "aria2": {
      "command": "npx",
      "args": ["-y", "github:iavjkae/aria2-mcp"],
      "env": {
        "ARIA2_RPC_URL": "http://127.0.0.1:6800/jsonrpc",
        "ARIA2_RPC_SECRET": "your_secret"
      }
    }
  }
}
```

## Tools

| Tool                | Description                                   |
| ------------------- | --------------------------------------------- |
| `aria2_add_uri`     | Queue one or more URIs and return the new GID |
| `aria2_list`        | List active, waiting or stopped downloads     |
| `aria2_status`      | Return the full status record for a GID       |
| `aria2_pause`       | Pause a download                              |
| `aria2_unpause`     | Resume a paused download                      |
| `aria2_remove`      | Remove a download and purge its result        |
| `aria2_global_stat` | Aggregate speeds and queue counters           |
| `aria2_get_version` | aria2 version and compiled features           |

Detailed schemas live in [`docs/tools.md`](./docs/tools.md).

## Security

- Credentials come from the environment only; nothing is committed or logged.
- The RPC secret is sent as the standard `token:<secret>` parameter and is never echoed
  back in tool output or error messages.
- URLs containing embedded credentials are rejected at startup.
- `test/no-secrets.test.ts` fails the build if an endpoint or secret is ever committed.

## Development

```bash
npm install
npm run lint        # ESLint (type-aware)
npm run format      # Prettier
npm run typecheck   # tsc --noEmit
npm run test        # Vitest
npm run test:coverage
npm run build       # emits dist/
```

An opt-in integration test runs against a real instance:

```bash
ARIA2_RPC_URL=http://127.0.0.1:6800/jsonrpc npm test
```

## License

[MIT](./LICENSE)
