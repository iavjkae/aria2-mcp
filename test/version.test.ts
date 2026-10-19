import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SERVER_NAME, VERSION } from '../src/version.js';

const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url));

describe('version metadata', () => {
  it('keeps VERSION in sync with package.json', async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
      version: string;
      name: string;
    };

    expect(VERSION).toBe(packageJson.version);
    expect(SERVER_NAME).toBe(packageJson.name);
  });
});
