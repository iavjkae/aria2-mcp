import { describe, expect, it } from 'vitest';

import { ConfigError, DEFAULT_TIMEOUT_MS, loadConfig, redactUrl } from '../src/config.js';

describe('loadConfig', () => {
  it('requires ARIA2_RPC_URL', () => {
    expect(() => loadConfig({})).toThrowError(ConfigError);
    expect(() => loadConfig({})).toThrowError(/ARIA2_RPC_URL is required/);
  });

  it('rejects a malformed URL', () => {
    expect(() => loadConfig({ ARIA2_RPC_URL: 'not a url' })).toThrowError(
      /valid absolute URL/,
    );
  });

  it('rejects unsupported protocols', () => {
    expect(() =>
      loadConfig({ ARIA2_RPC_URL: 'ws://localhost:6800/jsonrpc' }),
    ).toThrowError(/http or https/);
  });

  it('rejects credentials embedded in the URL', () => {
    expect(() =>
      loadConfig({ ARIA2_RPC_URL: 'http://user:pass@localhost:6800/jsonrpc' }),
    ).toThrowError(/must not contain credentials/);
  });

  it('applies defaults when only the URL is provided', () => {
    const config = loadConfig({ ARIA2_RPC_URL: 'http://localhost:6800/jsonrpc' });

    expect(config.rpcUrl).toBe('http://localhost:6800/jsonrpc');
    expect(config.secret).toBeUndefined();
    expect(config.timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
  });

  it('trims whitespace around the URL', () => {
    const config = loadConfig({ ARIA2_RPC_URL: '  https://example.test/jsonrpc  ' });

    expect(config.rpcUrl).toBe('https://example.test/jsonrpc');
  });

  it('normalises secrets with and without the token prefix', () => {
    expect(
      loadConfig({ ARIA2_RPC_URL: 'http://localhost/jsonrpc', ARIA2_RPC_SECRET: 'abc' })
        .secret,
    ).toBe('abc');

    expect(
      loadConfig({
        ARIA2_RPC_URL: 'http://localhost/jsonrpc',
        ARIA2_RPC_SECRET: 'token:abc',
      }).secret,
    ).toBe('abc');
  });

  it('treats a blank secret as absent', () => {
    expect(
      loadConfig({ ARIA2_RPC_URL: 'http://localhost/jsonrpc', ARIA2_RPC_SECRET: '   ' })
        .secret,
    ).toBeUndefined();
  });

  it('parses a custom timeout', () => {
    expect(
      loadConfig({
        ARIA2_RPC_URL: 'http://localhost/jsonrpc',
        ARIA2_TIMEOUT_MS: '1500',
      }).timeoutMs,
    ).toBe(1500);
  });

  it('rejects a non-positive timeout', () => {
    expect(() =>
      loadConfig({ ARIA2_RPC_URL: 'http://localhost/jsonrpc', ARIA2_TIMEOUT_MS: '0' }),
    ).toThrowError(/positive number/);

    expect(() =>
      loadConfig({ ARIA2_RPC_URL: 'http://localhost/jsonrpc', ARIA2_TIMEOUT_MS: 'abc' }),
    ).toThrowError(/positive number/);
  });
});

describe('redactUrl', () => {
  it('drops credentials and query strings', () => {
    expect(redactUrl('https://user:pass@example.test/jsonrpc?token=secret')).toBe(
      'https://example.test/jsonrpc?…',
    );
  });

  it('handles URLs without a query string', () => {
    expect(redactUrl('http://127.0.0.1:6800/jsonrpc')).toBe(
      'http://127.0.0.1:6800/jsonrpc',
    );
  });

  it('never throws on invalid input', () => {
    expect(redactUrl('not-a-url')).toBe('<invalid-url>');
  });
});
