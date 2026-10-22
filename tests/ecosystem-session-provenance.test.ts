import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Skipo ecosystem session provenance safety', () => {
  const script = fs.readFileSync(
    path.resolve(__dirname, '../scripts/ecosystem_sync.py'),
    'utf-8',
  );
  const createPr = script.slice(
    script.indexOf('def create_pr('),
    script.indexOf('\ndef end_session(', script.indexOf('def create_pr(')),
  );

  it('validates the originating immutable commit before any library push', () => {
    const validateAt = createPr.indexOf('valid immutable app commit SHA');
    const addAt = createPr.indexOf('run(["git", "add", "-A"], cwd=path)');
    const pushAt = createPr.indexOf('run(["git", "push", "-u", "origin", branch], cwd=path)');
    expect(validateAt).toBeGreaterThanOrEqual(0);
    expect(addAt).toBeGreaterThan(validateAt);
    expect(pushAt).toBeGreaterThan(addAt);
    expect(createPr).toContain('re.fullmatch(r"[0-9a-fA-F]{40}", app_commit)');
  });

  it('validates canonical target identity and Skipo session branch before pushing', () => {
    expect(createPr).toContain('library branch is not a Skipo session branch');
    expect(createPr).toContain('library repository does not match the canonical target');
    expect(createPr).toContain('branch.startswith("skipo/")');
    expect(createPr).toContain('state["libraries"][key].get("repository") != spec["repo"]');
  });
});
