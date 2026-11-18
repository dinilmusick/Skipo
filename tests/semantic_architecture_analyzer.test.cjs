'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');
const { analyzeProject } = require('../scripts/skipo_semantic_analyzer.cjs');
const fixtures = require('./semantic_architecture_fixtures.cjs');
function project(kind, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skipo-semantic-'));
  try {
    for (const [file, content] of Object.entries(fixtures[kind])) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive:true });
      fs.writeFileSync(path.join(root, file), content);
    }
    return fn(root);
  } finally { fs.rmSync(root, { recursive:true, force:true }); }
}
test('positive: canonical client imports, public barrel, aliases and extension are compliant', () => project('positive', root => {
  const report = analyzeProject(root);
  assert.equal(report.status, 'compliant', JSON.stringify(report.findings));
  assert.equal(report.summary.violations,0);
  assert.equal(report.summary.ambiguous,0);
  assert.ok(report.dependencies.some(e=>e.specifier==='@/libraries/format' && e.target==='src/libraries/format.ts'));
}));
test('negative: direct boundary, browser SDK, private exports, cross-package and duplicate auth', () => project('negative', root => {
  const report = analyzeProject(root);
  for (const rule of ['SEM101','SEM102','SEM103','SEM104','SEM105']) {
    assert.ok(report.findings.some(f=>f.ruleId===rule), rule + ': ' + JSON.stringify(report.findings));
  }
  assert.equal(report.status,'violations');
  assert.ok(report.findings.every(f=>f.line>0 && f.column>0 && f.evidence.length>0));
  assert.ok(report.findings.some(f=>f.ruleId==='SEM105' && f.suggestedReplacement.includes('kloks')));
}));
test('adversarial: alias re-export chain and renamed class detected without conflating extension', () => project('adversarial', root => {
  const report=analyzeProject(root);
  assert.ok(report.findings.some(f=>f.ruleId==='SEM109' && f.file==='src/frontend/page.tsx' && f.evidence.some(e=>e.value.includes('backend/private'))));
  assert.ok(report.findings.some(f=>f.ruleId==='SEM106' && f.file==='src/frontend/renamed.tsx'));
  assert.ok(report.findings.some(f=>f.ruleId==='SEM107' && f.file==='src/frontend/runtime.ts'));
  assert.ok(!report.findings.some(f=>f.file==='src/frontend/extension.tsx'));
}));
test('stable ordering and JSON output are reproducible and read-only', () => project('negative', root => {
  const before = fs.readFileSync(path.join(root,'src/frontend/view.tsx'),'utf8');
  assert.deepEqual(analyzeProject(root),analyzeProject(root));
  const cli = spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/skipo_semantic_analyzer.cjs'),'--root',root,'--json'],{encoding:'utf8'});
  assert.equal(cli.status,1,cli.stderr);
  assert.deepEqual(JSON.parse(cli.stdout),analyzeProject(root));
  assert.equal(fs.readFileSync(path.join(root,'src/frontend/view.tsx'),'utf8'),before);
}));
test('invalid and conflicting policies are blocked, not silently accepted', () => project('positive',root=>{
  const source = path.resolve(__dirname,'../architecture/semantic/owners.json');
  const conflict=JSON.parse(fs.readFileSync(source,'utf8'));
  conflict.browserAllowed.push('@ultrst-armada/kloks');
  const invalid=path.join(root,'invalid-policy.json');
  fs.writeFileSync(invalid,JSON.stringify(conflict));
  const result=analyzeProject(root,{policyPath:invalid});
  assert.equal(result.status,'blocked');
  assert.equal(result.findings[0].ruleId,'SEM000');
  const cli=spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/skipo_semantic_analyzer.cjs'),'--root',root,'--policy',invalid],{encoding:'utf8'});
  assert.equal(cli.status,2);
}));
test('AST ignores misleading comments and string literals', () => project('positive',root=>{
  fs.writeFileSync(path.join(root,'src/frontend/not-code.ts'),`const comment = "import { server } from '../backend/private'"; // require('better-auth')\nexport {comment};`);
  const report=analyzeProject(root);
  assert.equal(report.status,'compliant');
}));

test('installed package declaration paths never become application dependency planes', () => project('positive', root => {
  const vendor = path.join(root, 'node_modules/vendor-types');
  fs.mkdirSync(path.join(vendor, 'src/frontend'), { recursive: true });
  fs.writeFileSync(path.join(vendor, 'package.json'), JSON.stringify({
    name: 'vendor-types', version: '1.0.0', types: 'src/frontend/index.d.ts',
  }));
  fs.writeFileSync(path.join(vendor, 'src/frontend/index.d.ts'), 'export declare const fetchClient: () => void;\n');
  fs.mkdirSync(path.join(root,'src/backend'), { recursive: true });
  fs.writeFileSync(path.join(root,'src/backend/use.ts'), "import { fetchClient } from 'vendor-types'; export { fetchClient };\n");
  const report = analyzeProject(root);
  assert.equal(report.status, 'compliant', JSON.stringify(report.findings));
  assert.ok(report.dependencies.some(edge => edge.file === 'src/backend/use.ts' &&
    edge.specifier === 'vendor-types' && edge.target === null));
}));

test('canonical Kloks client import is browser-safe without allowing backend providers', () => project('positive', root => {
  const filename = path.join(root,'src/frontend/kloksClient.ts');
  fs.writeFileSync(filename, "import { WorkspaceAutosaveController } from '@ultrst-armada/kloks/client'; export { WorkspaceAutosaveController };\n");
  const report = analyzeProject(root);
  assert.equal(report.status, 'compliant', JSON.stringify(report.findings));
  assert.ok(!report.findings.some(f => f.ruleId === 'SEM102'));
  fs.writeFileSync(filename, "import { BackendFacade } from '@ultrst-armada/kloks/backend'; export { BackendFacade };\n");
  const blocked = analyzeProject(root);
  assert.ok(blocked.findings.some(f => f.ruleId === 'SEM102'));
}));
