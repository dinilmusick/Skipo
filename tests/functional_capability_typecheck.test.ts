import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import ts from 'typescript';

const repository = path.resolve(__dirname, '..');
const targets = [
  'src/frontend/App.tsx',
  'src/frontend/components/gates/WorkspaceGate.tsx',
  'src/frontend/pages/menus/workspaces/page.tsx',
  'src/frontend/pages/main/page.tsx',
  'src/frontend/pages/settings/page.tsx',
  'src/frontend/pages/settings/tabs/accounts/page.tsx',
  'src/frontend/pages/home/page.tsx',
  'src/backend/storage/canonicalCapabilityRoutes.ts',
];

/**
 * Generated scaffold source is typechecked against ACTUALLY INSTALLED public
 * Kloks/Floks declaration files; no local provider test doubles are substituted.
 */
describe('Vite generated functional capability source', () => {
  const project = path.join(repository, 'scaffolds', 'vite');
  const sourceFiles = targets.map(file => path.join(project, file));
  it('typechecks canonical provider and application composition contracts', () => {
    const configFile = ts.readConfigFile(path.join(project, 'tsconfig.json'), ts.sys.readFile);
    if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, project);
    const program = ts.createProgram(sourceFiles, { ...parsed.options, noEmit: true, skipLibCheck: true });
    const touched = new Set(sourceFiles.map(file => path.normalize(file)));
    const diagnostics = ts.getPreEmitDiagnostics(program)
      .filter(diag => diag.file && touched.has(path.normalize(diag.file.fileName)))
      .map(diag => ts.flattenDiagnosticMessageText(diag.messageText, '\n')
        + ' (' + diag.file!.fileName + ':' + diag.file!.getLineAndCharacterOfPosition(diag.start || 0).line + ')');
    expect(diagnostics).toEqual([]);
  });

  it('bundles the complete generated client composition with a real TSX compiler', async () => {
    const output = await build({
      entryPoints: [path.join(project, 'src/frontend/App.tsx')],
      absWorkingDir: repository,
      bundle: true, write: false, logLevel: 'silent', format: 'esm',
      platform: 'browser', packages: 'external',
      jsx: 'automatic',
    });
    expect(output.outputFiles.some(file => file.text.includes('WorkspaceGate'))).toBe(true);
    expect(output.outputFiles.some(file => file.text.includes('LuthOidcGate'))).toBe(true);
  });
});
