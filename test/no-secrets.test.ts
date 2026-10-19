import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  '.vitest',
]);

const IGNORED_FILES = new Set(['package-lock.json']);

const SCANNED_EXTENSIONS = new Set([
  '.ts',
  '.js',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.example',
  '.toml',
]);

/**
 * Fragments are concatenated at runtime so that this file does not itself
 * contain the values it forbids.
 */
const FORBIDDEN_TOKENS = ['zsver' + '.com', 'xiao' + 'sen'];

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.git')) {
      continue;
    }
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        files.push(...(await listFiles(join(directory, entry.name))));
      }
      continue;
    }
    if (IGNORED_FILES.has(entry.name)) {
      continue;
    }
    const extension = extname(entry.name) || entry.name;
    if (SCANNED_EXTENSIONS.has(extension) || entry.name.startsWith('.env')) {
      files.push(join(directory, entry.name));
    }
  }

  return files;
}

describe('repository hygiene', () => {
  it('contains no real endpoint, secret or committed .env file', async () => {
    const files = await listFiles(repositoryRoot);
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];

    for (const file of files) {
      const relativePath = relative(repositoryRoot, file).replaceAll('\\', '/');
      if (relativePath === 'test/no-secrets.test.ts') {
        continue;
      }
      if (relativePath === '.env') {
        offenders.push(`${relativePath}: committed environment file`);
        continue;
      }

      const content = await readFile(file, 'utf8');
      for (const token of FORBIDDEN_TOKENS) {
        if (content.includes(token)) {
          offenders.push(`${relativePath}: contains forbidden value`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('only references documentation example hosts', async () => {
    const files = await listFiles(repositoryRoot);
    const allowedHosts = [
      '127.0.0.1',
      'localhost',
      'example.test',
      'example.com',
      'aria2.test',
      'github.com',
      'nodejs.org',
      'modelcontextprotocol.io',
      'npmjs.com',
      'img.shields.io',
      'opensource.org',
      'githubusercontent.com',
      'aria2.github.io',
    ];

    const suspicious: string[] = [];

    for (const file of files) {
      const relativePath = relative(repositoryRoot, file).replaceAll('\\', '/');
      if (
        !['.ts', '.js', '.md', '.json', '.yml', '.yaml', '.example'].includes(
          extname(file),
        )
      ) {
        continue;
      }

      const content = await readFile(file, 'utf8');
      const urls = content.match(/https?:\/\/[^\s"'`)\]<>]+/g) ?? [];

      for (const candidate of urls) {
        let host: string;
        try {
          host = new URL(candidate).hostname;
        } catch {
          continue; // Template placeholders are not parseable URLs.
        }
        if (host && !allowedHosts.includes(host)) {
          suspicious.push(`${relativePath}: ${host}`);
        }
      }
    }

    expect(suspicious).toEqual([]);
  });
});
