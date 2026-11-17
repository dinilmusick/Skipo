"""Durable, fail-closed dependency migration preflight and rollback engine."""
from __future__ import annotations
import base64
import json
import os
import tempfile
from pathlib import Path
from skipo_dependency_integrity import digest, input_hashes, plan_id, safe_file

JOURNAL = '.skipo/dependency-migration-journal.json'

def _atomic(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(prefix='.skipo-tmp-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)

def _json(data: dict) -> bytes:
    return (json.dumps(data, indent=2, sort_keys=True) + '\n').encode('utf-8')

def recover_dependency_migrations(root: Path) -> dict:
    """Recover interrupted transaction, refusing to overwrite unrelated edits."""
    path = safe_file(root, JOURNAL)
    if not path.is_file():
        return {'ok': True, 'recovered': False, 'conflicts': []}
    try:
        journal = json.loads(path.read_text(encoding='utf-8'))
        if journal.get('schemaVersion') != 1 or not isinstance(journal.get('files'), dict):
            raise ValueError('Invalid migration journal')
        conflicts = []
        for relative, entry in sorted(journal['files'].items()):
            target = safe_file(root, relative)
            actual = digest(target.read_bytes() if target.is_file() else None)
            if actual not in (entry['beforeHash'], entry['afterHash']):
                conflicts.append(f"Externally modified during recovery: {relative}")
        if conflicts:
            return {'ok': False, 'recovered': False, 'conflicts': conflicts}
        restored = []
        for relative, entry in sorted(journal['files'].items()):
            target = safe_file(root, relative)
            original = entry['before']
            if original is None:
                if target.exists():
                    target.unlink()
                    restored.append(relative)
            else:
                content = base64.b64decode(original, validate=True)
                if digest(content) != entry['beforeHash']:
                    raise ValueError(f"Corrupt migration backup: {relative}")
                if digest(target.read_bytes() if target.is_file() else None) != entry['beforeHash']:
                    _atomic(target, content)
                    restored.append(relative)
        path.unlink()
        return {'ok': True, 'recovered': True, 'restored': restored, 'conflicts': []}
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        return {'ok': False, 'recovered': False, 'conflicts': [str(exc)]}

def _preflight(root: Path, plan: dict, apply_operation, verify_operation) -> tuple[dict, list[dict]]:
    """Materialize only explicit input paths into a scratch root, never app-owned unknowns."""
    with tempfile.TemporaryDirectory(prefix='skipo-migration-') as dirname:
        stage = Path(dirname)
        for relative in plan['inputHashes']:
            original = safe_file(root, relative)
            if original.is_file():
                copy = safe_file(stage, relative)
                copy.parent.mkdir(parents=True, exist_ok=True)
                copy.write_bytes(original.read_bytes())
        actions = []
        for migration in plan['migrations']:
            for operation in migration.get('preconditions', []):
                verify_operation(stage, operation)
            for operation in migration.get('transformations', []) + migration.get('repair', []):
                actions.append({'migration': migration['id'], **apply_operation(stage, operation, True)})
            for operation in migration.get('verification', []):
                verify_operation(stage, operation)
        files = {}
        writable = set()
        from skipo_dependency_contracts import files_for_pattern
        for migration in plan['migrations']:
            for operation in migration.get('transformations', []) + migration.get('repair', []):
                if 'path' in operation:
                    writable.add(operation['path'])
                for pattern in operation.get('paths', []):
                    writable.update(p.relative_to(root).as_posix() for p in files_for_pattern(root, pattern))
        writable.update(('.skipo/dependencies.json', '.skipo/migration-state.json'))
        for relative in sorted(writable):
            target = safe_file(root, relative)
            staged = safe_file(stage, relative)
            before = target.read_bytes() if target.is_file() else None
            after = staged.read_bytes() if staged.is_file() else None
            if relative == '.skipo/dependencies.json':
                dependencies = json.loads(before) if before is not None else {}
                dependencies.setdefault('_resolved', {})
                for name, item in plan['paths'].items():
                    dependencies[name] = item.get('specifier') or dependencies.get(name) or item['to']
                    dependencies['_resolved'][name] = item['to']
                after = _json(dependencies)
            if relative == '.skipo/migration-state.json':
                state = json.loads(before) if before is not None else {'schemaVersion': 1, 'applied': [], 'pending': []}
                applied = set(state.get('dependencyApplied', []))
                applied.update(m['id'] for m in plan['migrations'])
                state.update({'schemaVersion': max(1, state.get('schemaVersion', 1)),
                              'dependencyApplied': sorted(applied), 'pending': [],
                              'lastDependencyPlan': plan['planId']})
                after = _json(state)
            if before != after:
                if before is not None and len(before) > 8 * 1024 * 1024:
                    raise ValueError(f"Refusing oversized migration backup: {relative}")
                files[relative] = {'before': base64.b64encode(before).decode() if before is not None else None,
                                   'beforeHash': digest(before), 'afterHash': digest(after),
                                   'after': base64.b64encode(after).decode() if after is not None else None}
        return files, actions

def execute_verified(root: Path, plan: dict, apply_operation, verify_operation, verify_all,
                     fail_at: str | None = None) -> dict:
    """Staged preflight, durable journal, atomic per-file writes and independent verification."""
    root = Path(root).resolve()
    if not plan.get('ok'):
        return {**plan, 'applied': False}
    recovery = recover_dependency_migrations(root)
    if not recovery['ok']:
        return {**plan, 'ok': False, 'applied': False, 'errors': recovery['conflicts'], 'recovery': recovery}
    try:
        state_path = safe_file(root, '.skipo/migration-state.json')
        state = json.loads(state_path.read_text(encoding='utf-8')) if state_path.is_file() else {}
        if state.get('lastDependencyPlan') == plan.get('planId') and plan.get('planId'):
            checked = verify_all(root)
            return {**plan, 'ok': checked['ok'], 'errors': checked['errors'], 'applied': checked['ok'],
                    'actions': [], 'idempotent': True, 'recovery': recovery}
        if not isinstance(plan.get('inputHashes'), dict) or not isinstance(plan.get('planId'), str):
            raise ValueError('Unsealed plan: rerun plan_dependency_migrations before execution')
        if plan_id(plan['paths'], plan['migrations'], plan['inputHashes'],
                   {key: plan[key] for key in ('skipoVersion', 'integrity', 'requiredDependencies')}) != plan['planId']:
            raise ValueError('Migration plan contents altered after preflight')
        current = input_hashes(root, plan['migrations'], plan['paths'], plan.get('integrity', {}).get('lockfile'))
        if current != plan['inputHashes']:
            raise ValueError('Stale migration plan; input files changed since planning')
        from skipo_dependency_integrity import inspect_install
        packages = sorted(set(plan['paths']) | set(plan.get('requiredDependencies', {})))
        if packages and inspect_install(root, packages) != plan['integrity']:
            raise ValueError('Dependency manifest, installed version or lockfile drift')
        if not plan['paths'] and not plan['migrations']:
            checked = verify_all(root)
            return {**plan, 'ok': checked['ok'], 'errors': checked['errors'],
                    'actions': [], 'applied': checked['ok'], 'verified': checked['ok'],
                    'idempotent': True, 'recovery': recovery}
        files, actions = _preflight(root, plan, apply_operation, verify_operation)
        if fail_at == 'after_preflight':
            raise ValueError('Injected failure after preflight')
        if not files:
            checked = verify_all(root)
            return {**plan, 'ok': checked['ok'], 'errors': checked['errors'], 'applied': checked['ok'],
                    'actions': [], 'recovery': recovery}
        journal_path = safe_file(root, JOURNAL)
        _atomic(journal_path, _json({'schemaVersion': 1, 'planId': plan['planId'], 'files': files}))
        try:
            for index, (relative, record) in enumerate(sorted(files.items())):
                target = safe_file(root, relative)
                after = base64.b64decode(record['after']) if record['after'] is not None else None
                if after is None:
                    if target.exists():
                        target.unlink()
                else:
                    _atomic(target, after)
                if fail_at == f'after_write:{index}':
                    raise ValueError(f'Injected failure after write {index}')
            if fail_at == 'before_verify':
                raise ValueError('Injected failure before independent verification')
            checked = verify_all(root)
            if not checked['ok']:
                raise ValueError('Independent postcondition verification failed: ' + '; '.join(checked['errors']))
            journal_path.unlink()
        except Exception as error:
            rollback = recover_dependency_migrations(root)
            return {**plan, 'ok': False, 'applied': False, 'errors': [str(error)],
                    'actions': [], 'rollback': rollback, 'recovery': recovery}
        return {**plan, 'ok': True, 'applied': True, 'errors': [], 'actions': actions,
                'changedFiles': sorted(files), 'verified': True, 'recovery': recovery}
    except (ValueError, OSError, KeyError, TypeError, json.JSONDecodeError) as exc:
        return {**plan, 'ok': False, 'applied': False, 'errors': [str(exc)],
                'actions': [], 'recovery': recovery}
