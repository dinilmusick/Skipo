import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '..');

const FORBIDDEN_LEGACY_TERMS = [
  'FrnlSlot',
  'FrnlComposite',
  'occupantKind',
  'occupantId',
  'slotCollection',
  'registerSlot',
  'replaceSlotOccupant',
  'setEntityBounds',
  'VisualAsset',
  'visualAssetSchema',
];

describe('current FrnlTS architecture boundary', () => {
  it('contains no deleted Slots, Bounds, occupants, or visual-asset integration', () => {
    const roots = ['src', 'generators', 'mutators', 'scaffolds'];
    const files = execFileSync(
      'find',
      [...roots, '-type', 'f', '(', '-name', '*.ts', '-o', '-name', '*.tsx', '-o', '-name', '*.py', '-o', '-name', '*.js', '-o', '-name', '*.jsx', ')'],
      { cwd: repoRoot, encoding: 'utf8' },
    ).trim().split('\n').filter(Boolean);

    const violations: string[] = [];
    for (const relativePath of files) {
      const content = readFileSync(join(repoRoot, relativePath), 'utf8');
      for (const term of FORBIDDEN_LEGACY_TERMS) {
        if (content.includes(term)) {
          violations.push(`${relativePath}: ${term}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

describe('concept-library generator', () => {
  it('emits valid JSON and deterministic generated structure', () => {
    const target = mkdtempSync(join(tmpdir(), 'skipo-concept-generator-'));
    const generator = join(repoRoot, 'generators', '14_concept_library_generator.py');

    try {
      const args = [
        generator,
        target,
        '--name', 'audio_graph',
        '--params', JSON.stringify({ app_name: 'TestApp' }),
        '--json',
        '--force',
      ];

      const first = JSON.parse(execFileSync('python3', args, {
        cwd: repoRoot,
        encoding: 'utf8',
      }));

      expect(first.success).toBe(true);
      expect(first.generator_id).toBe('14_concept_library_generator');
      expect(first.file_count).toBe(4);

      const generatedPaths = first.files.map((file: { relative_path: string }) => file.relative_path);
      expect(generatedPaths).toEqual([
        'src/libraries/audio_graph_concepts/AudioGraphTypes.ts',
        'src/libraries/audio_graph_concepts/audioGraphTransform.ts',
        'src/libraries/audio_graph_concepts/audio_graph_concepts.ts',
        'src/libraries/TestAppConcepts.ts',
      ]);

      const generatedContents = generatedPaths.map((path: string) =>
        readFileSync(join(target, path), 'utf8'),
      );

      const second = JSON.parse(execFileSync('python3', args, {
        cwd: repoRoot,
        encoding: 'utf8',
      }));

      expect(second.success).toBe(true);
      expect(second.files.map((file: { relative_path: string }) => file.relative_path))
        .toEqual(generatedPaths);

      const regeneratedContents = generatedPaths.map((path: string) =>
        readFileSync(join(target, path), 'utf8'),
      );
      expect(regeneratedContents).toEqual(generatedContents);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  });
});
