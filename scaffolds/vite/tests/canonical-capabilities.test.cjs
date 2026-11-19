const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('workspace menu obtains persistent Kloks records through a verified app route', () => {
  const gate = read('src/frontend/components/gates/WorkspaceGate.tsx');
  const adapter = read('src/backend/storage/canonicalCapabilityRoutes.ts');
  assert.match(gate, /WorkspaceTilesMenu/);
  assert.match(gate, /requestJson\('\/api\/auth\/workspaces'\)/);
  assert.doesNotMatch(gate, /workspaces=\{\[\]\}/);
  assert.match(adapter, /WorkspaceServiceFacade\.execute\('listWorkspaces'/);
  assert.match(adapter, /WorkspaceServiceFacade\.execute\('createWorkspace'/);
});

test('storage backend delegates to canonical Kloks operations', () => {
  const adapter = read('src/backend/storage/canonicalCapabilityRoutes.ts');
  assert.match(adapter, /StorageServiceFacade\.execute/);
  assert.match(adapter, /BROWSER_STORAGE_OPERATIONS/);
  assert.match(adapter, /Verified Luth identity required/);
  assert.doesNotMatch(adapter, /from ['"](?:@aws-sdk|googleapis|@google-cloud)/);
});

test('application has real settings and workspace presentation', () => {
  for (const file of [
    'src/frontend/pages/settings/page.tsx',
    'src/frontend/pages/menus/workspaces/page.tsx',
    'src/frontend/pages/settings/tabs/accounts/page.tsx',
  ]) assert.ok(fs.statSync(path.join(root, file)).isFile(), file);
});

test('canonical auth page is generated from the capability registry', () => {
  const auth = read('src/frontend/pages/auth/page.tsx');
  assert.match(auth, /LuthOidcGate/, 'generated auth must render the canonical Floks OAuth gate');
  assert.doesNotMatch(auth, /function LocalAuthPage|createLocalAuth/);
});
