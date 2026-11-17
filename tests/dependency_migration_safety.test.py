"""Adversarial dependency upgrade fixtures for Skipo's standalone contract API."""
import base64
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from skipo_dependency_integrity import digest
from skipo_dependency_migrations import (
    execute_dependency_migrations, plan_dependency_migrations,
    recover_dependency_migrations, verify_dependency_migrations,
)

NAME = '@ultrst-armada/kloks'

def migration(mid, old, new, **extra):
    return {'id': mid, 'fromVersion': old, 'toVersion': new, **extra}

def fixture(tmp_path, migrations=None, old='1.0.0', target='3.0.0', names=None):
    names = names or {NAME: target}
    deps = {name: '^' + version for name, version in names.items()}
    (tmp_path / 'package.json').write_text(json.dumps({'dependencies': deps}))
    (tmp_path / 'package-lock.json').write_text(json.dumps({'lockfileVersion': 3,
        'packages': {'': {'dependencies': deps}, **{
            f'node_modules/{name}': {'version': version} for name, version in names.items()}}}))
    state = tmp_path / '.skipo'
    state.mkdir()
    (state / 'dependencies.json').write_text(json.dumps({NAME: '^' + old, '_resolved': {NAME: old}}))
    (state / 'migration-state.json').write_text(json.dumps({'schemaVersion': 1, 'applied': [], 'pending': []}))
    for name, version in names.items():
        provider = tmp_path / 'node_modules' / name
        provider.mkdir(parents=True)
        (provider / 'package.json').write_text(json.dumps({'name': name, 'version': version,
            'skipo': {'migrationContract': 'skipo.migrations.json'}}))
        (provider / 'skipo.migrations.json').write_text(json.dumps({'schemaVersion': 1,
            'package': name, 'migrations': migrations if name == NAME else [], 'compatibility': {}}))
    src = tmp_path / 'src'
    src.mkdir()
    (src / 'provider.ts').write_text('OldProvider')
    (src / 'independent.ts').write_text('app-owned unrelated content')
    return tmp_path

def staged_migrations():
    return [
        migration('to-2', '1.0.0', '2.0.0',
                  transformations=[{'type': 'replace_text', 'paths': ['src/provider.ts'],
                                    'find': 'OldProvider', 'replace': 'MiddleProvider'}],
                  verification=[{'type': 'text_present', 'paths': ['src/provider.ts'], 'text': 'MiddleProvider'}]),
        migration('to-3', '2.0.0', '3.0.0',
                  transformations=[{'type': 'replace_text', 'paths': ['src/provider.ts'],
                                    'find': 'MiddleProvider', 'replace': 'CanonicalProvider'}],
                  verification=[{'type': 'text_present', 'paths': ['src/provider.ts'], 'text': 'CanonicalProvider'}]),
    ]

def test_successive_versions_are_ordered_verified_and_idempotent(tmp_path):
    root = fixture(tmp_path, staged_migrations())
    plan = plan_dependency_migrations(root)
    assert plan['ok'], plan['errors']
    assert [m['contractId'] for m in plan['migrations']] == ['to-2', 'to-3']
    result = execute_dependency_migrations(root, plan)
    assert result['ok'] and result['verified'], result['errors']
    assert (root / 'src/provider.ts').read_text() == 'CanonicalProvider'
    assert (root / 'src/independent.ts').read_text() == 'app-owned unrelated content'
    assert verify_dependency_migrations(root)['ok']
    assert execute_dependency_migrations(root, plan)['actions'] == []
    assert not plan_dependency_migrations(root)['migrations']

def test_missing_contract_and_missing_version_edge_are_blocked(tmp_path):
    root = fixture(tmp_path, [migration('to-3', '2.0.0', '3.0.0')])
    assert 'Missing migration path' in str(plan_dependency_migrations(root)['errors'])
    (root / f'node_modules/{NAME}/skipo.migrations.json').unlink()
    assert 'No migration contract shipped' in str(plan_dependency_migrations(root)['errors'])

def test_ambiguous_graph_is_blocked(tmp_path):
    root = fixture(tmp_path, [migration('via-2', '1.0.0', '2.0.0'),
                              migration('via-2-5', '1.0.0', '2.5.0'),
                              migration('end-2', '2.0.0', '3.0.0'),
                              migration('end-2-5', '2.5.0', '3.0.0')])
    assert 'Ambiguous migration path' in str(plan_dependency_migrations(root)['errors'])

def test_wrong_lockfile_and_missing_installed_package_are_blocked(tmp_path):
    root = fixture(tmp_path, staged_migrations())
    lock = json.loads((root / 'package-lock.json').read_text())
    lock['packages'][f'node_modules/{NAME}']['version'] = '2.0.0'
    (root / 'package-lock.json').write_text(json.dumps(lock))
    assert 'mismatch' in str(plan_dependency_migrations(root)['errors'])
    (root / 'package-lock.json').unlink()
    assert 'exactly one supported lockfile' in str(plan_dependency_migrations(root)['errors'])

def test_scripts_and_protected_package_paths_are_rejected(tmp_path):
    root = fixture(tmp_path, [migration('to-3', '1.0.0', '3.0.0',
                        transformations=[{'type': 'run_shell', 'command': 'exit 0'}])])
    assert not plan_dependency_migrations(root)['ok']
    contract_file = root / f'node_modules/{NAME}/skipo.migrations.json'
    data = json.loads(contract_file.read_text())
    data['migrations'][0]['transformations'] = [
        {'type': 'set_json', 'path': 'package.json', 'key': 'dependencies.hijack', 'value': 'x'}]
    contract_file.write_text(json.dumps(data))
    assert 'protected path' in str(plan_dependency_migrations(root)['errors'])

def test_injected_partial_failure_restores_every_file_and_state(tmp_path):
    root = fixture(tmp_path, staged_migrations())
    plan = plan_dependency_migrations(root)
    original = {str(path.relative_to(root)): path.read_bytes() for path in
                (root / 'src/provider.ts', root / '.skipo/dependencies.json',
                 root / '.skipo/migration-state.json')}
    for failure in ('after_write:0', 'after_write:2', 'before_verify'):
        result = execute_dependency_migrations(root, plan, fail_at=failure)
        assert not result['ok'], failure
        assert result['rollback']['ok'], result
        for relative, content in original.items():
            assert (root / relative).read_bytes() == content
        assert not (root / '.skipo/dependency-migration-journal.json').exists()

def test_stale_sealed_plan_is_not_executed(tmp_path):
    root = fixture(tmp_path, staged_migrations())
    plan = plan_dependency_migrations(root)
    (root / 'src/provider.ts').write_text('user edit after plan')
    result = execute_dependency_migrations(root, plan)
    assert not result['ok'] and 'Stale migration plan' in str(result['errors'])
    assert (root / 'src/provider.ts').read_text() == 'user edit after plan'

def test_crash_recovery_refuses_external_edits(tmp_path):
    root = fixture(tmp_path, staged_migrations())
    target = root / 'src/provider.ts'
    original, post = b'OldProvider', b'CanonicalProvider'
    target.write_bytes(post)
    journal = {'schemaVersion': 1, 'planId': 'test', 'files': {
        'src/provider.ts': {'before': base64.b64encode(original).decode(),
            'beforeHash': digest(original), 'afterHash': digest(post),
            'after': base64.b64encode(post).decode()}}}
    path = root / '.skipo/dependency-migration-journal.json'
    path.write_text(json.dumps(journal))
    target.write_text('third-party edit')
    result = recover_dependency_migrations(root)
    assert not result['ok'] and path.exists()
    assert target.read_text() == 'third-party edit'
    target.write_bytes(post)
    assert recover_dependency_migrations(root)['ok']
    assert target.read_bytes() == original and not path.exists()

def test_dependency_range_conflict_blocks_upgrade(tmp_path):
    other = '@ultrst-armada/frnlts'
    root = fixture(tmp_path, [migration('to-3', '1.0.0', '3.0.0',
                     requiresDependencies={other: '^2.0.0'})], names={NAME: '3.0.0', other: '1.0.0'})
    assert 'violates required range' in str(plan_dependency_migrations(root)['errors'])

def test_symlinked_provider_source_blocks_before_mutation(tmp_path):
    root = fixture(tmp_path, staged_migrations())
    outside = tmp_path.parent / (tmp_path.name + '-external')
    outside.write_text('OldProvider')
    (root / 'src/provider.ts').unlink()
    (root / 'src/provider.ts').symlink_to(outside)
    result = plan_dependency_migrations(root)
    assert not result['ok'] and 'symlink' in str(result['errors'])
    assert outside.read_text() == 'OldProvider'


def test_pnpm_importer_lockfile_verifies_installed_package(tmp_path):
    root = fixture(tmp_path, [migration('to-3', '1.0.0', '3.0.0')])
    (root / 'package-lock.json').unlink()
    (root / 'pnpm-lock.yaml').write_text("""lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      '@ultrst-armada/kloks':
        specifier: ^3.0.0
        version: 3.0.0
packages:
  '@ultrst-armada/kloks@3.0.0':
    resolution:
      integrity: sha512-abc
snapshots:
  '@ultrst-armada/kloks@3.0.0': {}
""")
    assert plan_dependency_migrations(root)['ok']
    (root / 'pnpm-lock.yaml').write_text((root / 'pnpm-lock.yaml').read_text().replace('version: 3.0.0', 'version: 2.0.0'))
    assert not plan_dependency_migrations(root)['ok']


def test_precise_caret_semver_compatibility():
    from skipo_dependency_contracts import satisfies
    assert satisfies('0.0.1', '^0.0.1')
    assert not satisfies('0.0.2', '^0.0.1')
    assert satisfies('2.9.0', '^2.1.0')
    assert not satisfies('3.0.0', '^2.1.0')


def test_json_repair_and_explicit_preconditions(tmp_path):
    root = fixture(tmp_path, [migration('to-3', '1.0.0', '3.0.0',
        preconditions=[{'type': 'text_present', 'paths': ['src/provider.ts'], 'text': 'OldProvider'}],
        transformations=[{'type': 'set_json', 'path': 'config.json', 'key': 'provider.mode',
                          'value': 'canonical', 'expectedOld': 'legacy'}],
        verification=[{'type': 'json_equals', 'path': 'config.json', 'key': 'provider.mode',
                       'value': 'canonical'}])])
    config = root / 'config.json'
    config.write_text(json.dumps({'provider': {'mode': 'legacy'}}))
    plan = plan_dependency_migrations(root)
    assert plan['ok'], plan['errors']
    assert execute_dependency_migrations(root, plan)['ok']
    assert json.loads(config.read_text())['provider']['mode'] == 'canonical'
    assert verify_dependency_migrations(root)['ok']


def test_unmet_precondition_leaves_app_unchanged(tmp_path):
    root = fixture(tmp_path, [migration('to-3', '1.0.0', '3.0.0',
        preconditions=[{'type': 'text_present', 'paths': ['src/provider.ts'], 'text': 'NeverPresent'}],
        transformations=[{'type': 'replace_text', 'paths': ['src/provider.ts'],
                          'find': 'OldProvider', 'replace': 'NewProvider'}])])
    plan = plan_dependency_migrations(root)
    assert plan['ok']
    result = execute_dependency_migrations(root, plan)
    assert not result['ok'] and 'Required canonical pattern missing' in str(result['errors'])
    assert (root / 'src/provider.ts').read_text() == 'OldProvider'


def test_pnpm_installation_symlink_is_allowed_inside_package_tree(tmp_path):
    import shutil
    root = fixture(tmp_path, staged_migrations())
    folder = root / 'node_modules' / NAME
    installed = root / 'node_modules/.pnpm/kloks@3.0.0/node_modules' / NAME
    installed.parent.mkdir(parents=True)
    shutil.move(str(folder), str(installed))
    folder.symlink_to(installed, target_is_directory=True)
    plan = plan_dependency_migrations(root)
    assert plan['ok'], plan['errors']
    assert execute_dependency_migrations(root, plan)['ok']
    assert verify_dependency_migrations(root)['ok']


def test_package_contract_symlink_to_other_provider_is_rejected(tmp_path):
    root = fixture(tmp_path, staged_migrations())
    file = root / 'node_modules' / NAME / 'skipo.migrations.json'
    other = root / 'node_modules' / 'other-package'
    other.mkdir()
    (other / 'skipo.migrations.json').write_bytes(file.read_bytes())
    file.unlink()
    file.symlink_to(other / 'skipo.migrations.json')
    plan = plan_dependency_migrations(root)
    assert not plan['ok'] and 'escapes installed package' in str(plan['errors'])
