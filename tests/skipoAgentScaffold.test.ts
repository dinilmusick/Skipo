import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Skipo agent scaffold', () => {
  it('ships the agent layer in the canonical structure generator', () => {
    const source = readFileSync(new URL('../generators/01_structure_generator.py', import.meta.url), 'utf8');
    expect(source).toContain('src/backend/agent/skipoAgent.ts');
    expect(source).toContain('suggest-service-promotion');
    expect(source).toContain('suggest-ui-promotion');
    expect(source).toContain('handoff-to-krusbl');
  });
});
