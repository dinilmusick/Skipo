import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

describe('Skipo deployment origin scaffold contract', () => {
  it('declares APP_URL in the canonical scaffold env contract', () => {
    const env = fs.readFileSync(path.join(root, 'scaffolds', 'vite', '.env.example'), 'utf8');
    expect(env).toContain('APP_URL');
  });

  it('does not hard-wire browser-only origin discovery into scaffold Luth clients', () => {
    const source = fs.readFileSync(path.join(root, 'scaffolds', 'vite', 'src/libraries/client/luthAuthClient.ts'), 'utf8');
    expect(source).not.toContain('origin: typeof window');
  });
});
