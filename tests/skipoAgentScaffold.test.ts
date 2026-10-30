import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Skipo scaffold contracts', () => {
  it('ships the agent layer in the canonical structure generator', () => {
    const source = readFileSync(new URL('../generators/01_structure_generator.py', import.meta.url), 'utf8');
    expect(source).toContain('src/backend/agent/skipoAgent.ts');
    expect(source).toContain('suggest-service-promotion');
    expect(source).toContain('suggest-ui-promotion');
    expect(source).toContain('handoff-to-krusbl');
  });

  it('ships mandatory FOD in the application scaffold generator', () => {
    const source = readFileSync(new URL('../scripts/scaffold_app_structure.py', import.meta.url), 'utf8');
    expect(source).toContain('pages_root / "main" / "tabs" / "fod"');
    expect(source).toContain('@dinilmusick/gutts/api');
    expect(source).toContain('FodRuntime');
  });
});
