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

  it('generates one Fetch application with separate provider adapters', () => {
    const scaffold = readFileSync(new URL('../scripts/scaffold_app_structure.py', import.meta.url), 'utf8');
    const provider = readFileSync(new URL('../scripts/generate_provider_packaging.py', import.meta.url), 'utf8');
    expect(scaffold).toContain('generate_provider_packaging');
    expect(provider).toContain('SCAFFOLD_APP_SOURCE');
    expect(provider).toContain('src/providers/cloudflare.ts');
    expect(provider).toContain('src/providers/vercel.ts');
    expect(provider).toContain('src/providers/node.ts');
    expect(provider).toContain('node dist/providers/node/server.js');
    expect(provider).not.toMatch(/Aiko|FOD|FodRuntime|createAikoRuntime/);
    expect(provider).not.toMatch(/AudioHardwareServiceFacade|MidiServiceFacade/);
    expect(provider).toContain('FetchBackend');
    expect(scaffold).not.toContain('@ultrst-armada/kloks/services');
    expect(scaffold).not.toContain('@ultrst-armada/kloks/backend/krnl-services');
  });
});
