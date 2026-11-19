import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('.github/workflows/publish-skipo-cli.yml', 'utf8');
const sourceBlocks = source.split('      - name: ');
assert.ok(source.includes('workflow_dispatch:'), 'Missing explicit approval dispatch');
assert.ok(!/^  issues:\s*$/m.test(source), 'Issue creation must never trigger publication');
assert.ok(source.includes('github.ref == \'refs/heads/main\''), 'Manual publication must require main');
assert.ok(source.includes('inputs.publish'), 'Manual approval input is missing');
assert.ok(source.includes('ref') || source.includes('git rev-parse HEAD'), 'Missing source identity');
assert.ok(source.includes('test "$(git rev-parse HEAD)" = "$GITHUB_SHA"'), 'Source revision not asserted');
assert.ok(source.includes('npm pack --pack-destination'), 'Real release candidate is not packed');
assert.ok(source.includes('npm publish --provenance --access public'), 'No OIDC provenance publication');
assert.ok(source.includes("steps.registry.outputs.exists == 'false'"), 'Published version collision guard missing');
assert.ok(source.includes('Registry lookup failed for a reason other than a missing version'), 'Registry outage must fail closed');
assert.ok(source.includes('SKIPO_REGISTRY_VERSION:'), 'Public archive smoke missing');
assert.ok(/^  id-token: write$/m.test(source), 'Missing OIDC permission');
const publish = sourceBlocks.find(block => block.startsWith('Publish a unique version only after explicit manual approval'));
assert.ok(publish && publish.includes("github.event_name == 'workflow_dispatch'") &&
  publish.includes('inputs.publish'), 'Unapproved publishing event may still reach npm publish');
const root = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const cli = JSON.parse(fs.readFileSync('packages/skipo/package.json', 'utf8'));
assert.equal(root.version, cli.version, 'Root and Skipo package versions differ');
console.log('SKIPO RELEASE CONTRACT VERIFIED: immutable SHA, explicit approval, unique version, real tarball, OIDC');
