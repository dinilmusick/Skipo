import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Skipo package isolation', () => {
  it('does not rely on sibling framework repositories', () => {
    const builder = readFileSync(new URL('../scripts/skipo_builder.py', import.meta.url), 'utf8');
    const validator = readFileSync(new URL('../scripts/validate_frnl.py', import.meta.url), 'utf8');
    expect(builder).not.toContain('JS_ROOT = SKIPO_ROOT.parent');
    expect(builder).not.toContain('JS_ROOT / "Kloks"');
    expect(builder).not.toContain('JS_ROOT / "Floks"');
    expect(validator).not.toContain('../FrnlTS');
    expect(builder).toContain('kloks.manifest.json');
    expect(builder).toContain('floks.manifest.json');
  });
});

