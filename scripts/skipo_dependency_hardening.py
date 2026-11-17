"""Strict contract validation, unique migration graph resolution and path ownership."""
from __future__ import annotations
import json
import re
from pathlib import Path, PurePosixPath
from skipo_dependency_integrity import exact, safe_file, compatible

def harden(namespace: dict) -> None:
    """Upgrade published dependency-contract API without altering CLI entry points."""
    original_validate = namespace['validate_contract']
    original_operations = namespace['validate_operations']

    def strict_version(value: str) -> tuple[int, int, int]:
        normalized = exact(str(value).lstrip('^~'))
        return tuple(int(x) for x in normalized.split('.'))

    def operation_path(relative: str, pattern: bool = False) -> None:
        if not isinstance(relative, str) or not relative or '\\' in relative or '\x00' in relative:
            raise ValueError(f"Unsafe migration operation path: {relative!r}")
        path = PurePosixPath(relative)
        if path.is_absolute() or '..' in path.parts or not path.parts:
            raise ValueError(f"Unsafe migration operation path: {relative}")
        if path.parts[0] in ('.git', '.skipo', 'node_modules') or relative in (
            'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'):
            raise ValueError(f"Provider migrations cannot own protected path: {relative}")
        if not pattern and any('*' in p or '?' in p or '[' in p for p in path.parts):
            raise ValueError(f"Glob forbidden in exact migration path: {relative}")

    def validate_operations(migration: dict) -> None:
        original_operations(migration)
        for group in ('preconditions', 'transformations', 'repair', 'verification'):
            operations = migration.get(group, [])
            if not isinstance(operations, list):
                raise ValueError(f"Invalid {group} for {migration['id']}")
            for op in operations:
                if not isinstance(op, dict):
                    raise ValueError(f"Malformed {group} operation in {migration['id']}")
                allowed = {'text_present', 'text_absent', 'json_equals'} if group in ('preconditions', 'verification') else {'replace_text', 'set_json'}
                if op.get('type') not in allowed:
                    raise ValueError(f"Operation not allowed in {group}: {op.get('type')}")
                if 'paths' in op:
                    if not isinstance(op['paths'], list) or not op['paths']:
                        raise ValueError('paths must be a nonempty array')
                    for p in op['paths']:
                        operation_path(p, pattern=True)
                if 'path' in op:
                    operation_path(op['path'])
                if op['type'] == 'replace_text':
                    if not isinstance(op['find'], str) or not op['find'] or not isinstance(op['replace'], str):
                        raise ValueError('replace_text requires nonempty find and string replace')
                    expected = op.get('expectedMatches', 1)
                    if type(expected) is not int or expected < 0:
                        raise ValueError('Invalid expectedMatches')
                if op['type'] in ('json_equals', 'set_json'):
                    if not isinstance(op.get('key'), str) or any(not part or part in ('.', '..') for part in op['key'].split('.')):
                        raise ValueError('Invalid JSON key path')

    def validate_contract(contract: dict, package: str, skipo_version: str = '1.1.0') -> None:
        if not isinstance(contract, dict):
            raise ValueError('Migration contract must be a JSON object')
        original_validate(contract, package, skipo_version)
        edges = set()
        for migration in contract['migrations']:
            validate_operations(migration)
            edge = (strict_version(migration['fromVersion']), strict_version(migration['toVersion']))
            if edge in edges:
                raise ValueError(f"Duplicate migration edge for {package}: {edge}")
            edges.add(edge)
            if '::' in migration['id']:
                raise ValueError('Migration IDs cannot contain package namespace delimiter')
            requirements = migration.get('requiresDependencies', {})
            if not isinstance(requirements, dict):
                raise ValueError(f"Invalid dependency requirements in {migration['id']}")
            for name, requirement in requirements.items():
                if not isinstance(name, str) or not isinstance(requirement, str):
                    raise ValueError('Invalid dependency compatibility constraint')
                compatible(requirement, '1.0.0')  # validate range syntax, not satisfaction
        compatibility = contract.get('compatibility', {})
        deps = compatibility.get('dependencies', {})
        if not isinstance(deps, dict):
            raise ValueError('Invalid contract dependency compatibility constraints')
        for name, spec in deps.items():
            if not isinstance(name, str) or not isinstance(spec, str):
                raise ValueError('Invalid contract dependency requirement')
            compatible(spec, '1.0.0')

    def resolve_path(contract: dict, start: str, target: str) -> list[dict]:
        source, destination = strict_version(start), strict_version(target)
        if source == destination:
            return []
        if source > destination:
            raise ValueError(f"Downgrades unsupported: {start} -> {target}")
        edges: dict[tuple[int, int, int], list[dict]] = {}
        for migration in contract['migrations']:
            edges.setdefault(strict_version(migration['fromVersion']), []).append(migration)
        for items in edges.values():
            items.sort(key=lambda m: (strict_version(m['toVersion']), m['id']))
        memo: dict[tuple[int, int, int], list[list[dict]]] = {}
        def paths(at: tuple[int, int, int]) -> list[list[dict]]:
            if at == destination:
                return [[]]
            if at in memo:
                return memo[at]
            matches = []
            for edge in edges.get(at, []):
                following = strict_version(edge['toVersion'])
                if following > destination:
                    continue
                for suffix in paths(following):
                    matches.append([edge, *suffix])
                    if len(matches) > 1:
                        break
                if len(matches) > 1:
                    break
            memo[at] = matches
            return matches
        found = paths(source)
        if not found:
            raise ValueError(f"Missing migration path {contract['package']} {start} -> {target}")
        if len(found) != 1:
            raise ValueError(f"Ambiguous migration path {contract['package']} {start} -> {target}")
        return found[0]

    def discover_contract(root: Path, package: str) -> dict | None:
        manifest_path = safe_file(root, f'node_modules/{package}/package.json')
        if not manifest_path.is_file():
            return None
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        if manifest.get('name') != package:
            raise ValueError(f"Installed package identity mismatch: {package}")
        metadata = manifest.get('skipo', {})
        if not isinstance(metadata, dict):
            raise ValueError(f"Invalid Skipo package metadata: {package}")
        relative = metadata.get('migrationContract') or metadata.get('migrations') or 'skipo.migrations.json'
        if not isinstance(relative, str):
            raise ValueError('Migration contract location must be a package-relative file')
        operation_path(relative)
        contract_file = safe_file(root, f'node_modules/{package}/{relative}')
        return json.loads(contract_file.read_text(encoding='utf-8')) if contract_file.is_file() else None

    def files_for_pattern(root: Path, pattern: str) -> list[Path]:
        operation_path(pattern, pattern=True)
        found = []
        for p in sorted(root.glob(pattern)):
            relative = p.relative_to(root).as_posix()
            if p.is_dir() and not p.is_symlink():
                continue
            checked = safe_file(root, relative)
            if checked.is_file():
                found.append(checked)
        return found

    namespace.update(version=strict_version, validate_operations=validate_operations,
                     validate_contract=validate_contract, resolve_path=resolve_path,
                     discover_contract=discover_contract, files_for_pattern=files_for_pattern)
