/** Error thrown when the runtime configuration is missing or malformed. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export interface Aria2Config {
  /** Full JSON-RPC endpoint, e.g. `http://localhost:6800/jsonrpc`. */
  rpcUrl: string;
  /** RPC secret without the `token:` prefix, or `undefined` when auth is disabled. */
  secret: string | undefined;
  /** Per-request timeout in milliseconds. */
  timeoutMs: number;
}

export const DEFAULT_TIMEOUT_MS = 30_000;

const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Reads configuration from the environment.
 *
 * Only `ARIA2_RPC_URL` is required. `ARIA2_RPC_SECRET` is optional and is
 * normalised so that both `secret` and `token:secret` are accepted.
 * `ARIA2_TIMEOUT_MS` overrides the request timeout.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Aria2Config {
  const rawUrl = env.ARIA2_RPC_URL?.trim();
  if (!rawUrl) {
    throw new ConfigError(
      'ARIA2_RPC_URL is required, for example http://127.0.0.1:6800/jsonrpc',
    );
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ConfigError('ARIA2_RPC_URL must be a valid absolute URL');
  }

  if (!SUPPORTED_PROTOCOLS.has(url.protocol)) {
    throw new ConfigError(
      `ARIA2_RPC_URL must use http or https, received "${url.protocol}"`,
    );
  }

  // Credentials embedded in the URL are dropped on purpose: they would leak
  // into logs and error messages.
  if (url.username || url.password) {
    throw new ConfigError(
      'ARIA2_RPC_URL must not contain credentials; use ARIA2_RPC_SECRET instead',
    );
  }

  const secret = normaliseSecret(env.ARIA2_RPC_SECRET);
  const timeoutMs = parseTimeout(env.ARIA2_TIMEOUT_MS);

  return { rpcUrl: url.toString(), secret, timeoutMs };
}

function normaliseSecret(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.startsWith('token:') ? trimmed.slice('token:'.length) : trimmed;
}

function parseTimeout(raw: string | undefined): number {
  if (raw === undefined || !raw.trim()) {
    return DEFAULT_TIMEOUT_MS;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new ConfigError('ARIA2_TIMEOUT_MS must be a positive number');
  }

  return Math.floor(value);
}

/** Removes the query string and userinfo so a URL can be logged safely. */
export function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    const query = url.search ? '?…' : '';
    return `${url.origin}${url.pathname}${query}`;
  } catch {
    return '<invalid-url>';
  }
}
