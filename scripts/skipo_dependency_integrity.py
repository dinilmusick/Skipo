"""Fail-closed manifest, installed-package and lockfile checks for provider upgrades."""
from __future__ import annotations
import hashlib
import json
import re
from pathlib import Path

NAME = re.compile(r"^(?:@[a-z0-9][\w.-]*/)?[a-z0-9][\w.-]*$")
VERSION = re.compile(r"^v?(\d+)\.(\d+)(?:\.(\d+))?$")

def exact(value: str) -> str:
    match = VERSION.fullmatch(str(value))
    if not match:
        raise ValueError(f"Invalid exact dependency version: {value!r}")
    return '.'.join(str(int(part or 0)) for part in match.groups())

def digest(content: bytes | None) -> str | None:
    return hashlib.sha256(content).hexdigest() if content is not None else None

def read_json(path: Path) -> dict:
    data = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(data, dict):
        raise ValueError(f"Expected JSON object: {path}")
    return data

def safe_file(root: Path, relative: str) -> Path:
    from pathlib import PurePosixPath
    if not isinstance(relative, str) or not relative or '\\' in relative or '\x00' in relative:
        raise ValueError(f"Unsafe migration path: {relative!r}")
    p = PurePosixPath(relative)
    if p.is_absolute() or any(x in ('', '.', '..') for x in p.parts):
        raise ValueError(f"Unsafe migration path: {relative}")
    path = root
    for part in p.parts:
        path = path / part
        if path.is_symlink():
            raise ValueError(f"Migration path traverses symlink: {relative}")
    if path.exists() and not path.is_file():
        raise ValueError(f"Not a regular file: {relative}")
    return path

def declared_dependencies(root: Path) -> dict[str, str]:
    data = read_json(safe_file(root, 'package.json'))
    result = {}
    for section in ('dependencies', 'devDependencies', 'optionalDependencies'):
        deps = data.get(section, {})
        if not isinstance(deps, dict):
            raise ValueError(f"Invalid {section} in package.json")
        for name, spec in deps.items():
            if not NAME.fullmatch(name) or not isinstance(spec, str):
                raise ValueError(f"Invalid package declaration: {name}")
            if name in result and result[name] != spec:
                raise ValueError(f"Conflicting declarations for {name}")
            result[name] = spec
    return result

def compatible(spec: str, installed: str) -> bool:
    from skipo_dependency_contracts import satisfies
    if not re.fullmatch(r"(?:\^|~|>=|<=|>|<)?v?\d+\.\d+(?:\.\d+)?(?:\s*,\s*(?:>=|<=|>|<)v?\d+\.\d+(?:\.\d+)?)*", spec):
        raise ValueError(f"Unsupported or ambiguous package specifier {spec!r}")
    return satisfies(installed, spec)

def lock_versions(root: Path, names: dict[str, str]) -> tuple[str, dict[str, str]]:
    npm, pnpm = safe_file(root, 'package-lock.json'), safe_file(root, 'pnpm-lock.yaml')
    yarn = safe_file(root, 'yarn.lock')
    present = [p for p in (npm, pnpm, yarn) if p.is_file()]
    if len(present) != 1:
        raise ValueError('Expected exactly one supported lockfile (package-lock.json or pnpm-lock.yaml)')
    if yarn.is_file():
        raise ValueError('Yarn lockfiles are not yet supported for verified migrations')
    if npm.is_file():
        lock = read_json(npm)
        if lock.get('lockfileVersion') not in (2, 3) or not isinstance(lock.get('packages'), dict):
            raise ValueError('Unsupported npm lockfile version or format')
        root_pkg = lock['packages'].get('', {})
        for section in ('dependencies', 'devDependencies', 'optionalDependencies'):
            declaration = read_json(safe_file(root, 'package.json')).get(section, {})
            if root_pkg.get(section, {}) != declaration:
                raise ValueError(f"npm lockfile root {section} differs from package.json")
        versions = {}
        for name in names:
            value = lock['packages'].get(f'node_modules/{name}', {}).get('version')
            if not value:
                raise ValueError(f"Missing npm lockfile entry for {name}")
            versions[name] = exact(value)
        return 'package-lock.json', versions
    try:
        import yaml
    except ImportError as exc:
        raise ValueError('pnpm verification requires PyYAML; no unchecked fallback allowed') from exc
    lock = yaml.safe_load(pnpm.read_text(encoding='utf-8'))
    if not isinstance(lock, dict) or not str(lock.get('lockfileVersion', '')).startswith(('6.', '9.')):
        raise ValueError('Unsupported pnpm lockfile format')
    importer = lock.get('importers', {}).get('.', {})
    versions = {}
    for name, spec in names.items():
        sections = [importer.get(k, {}) for k in ('dependencies', 'devDependencies', 'optionalDependencies')]
        matches = [section[name] for section in sections if isinstance(section, dict) and name in section]
        if not matches or any(x != matches[0] for x in matches):
            raise ValueError(f"Missing or conflicting pnpm importer entry for {name}")
        entry = matches[0]
        if not isinstance(entry, dict) or entry.get('specifier') != spec:
            raise ValueError(f"pnpm importer specifier differs for {name}")
        resolved = str(entry.get('version', '')).split('(')[0]
        versions[name] = exact(resolved)
    return 'pnpm-lock.yaml', versions

def inspect_install(root: Path, packages: list[str]) -> dict:
    names = declared_dependencies(root)
    lock_name, locked = lock_versions(root, names)
    checked = {}
    for name in sorted(set(packages)):
        if name not in names:
            raise ValueError(f"Migration provider not declared in package.json: {name}")
        manifest = read_json(safe_file(root, f'node_modules/{name}/package.json'))
        if manifest.get('name') != name:
            raise ValueError(f"Installed package identity mismatch: {name}")
        actual = exact(manifest.get('version'))
        if locked[name] != actual or not compatible(names[name], actual):
            raise ValueError(f"Manifest/installed/lockfile mismatch for {name}: {names[name]}, {actual}, {locked[name]}")
        checked[name] = actual
    return {'lockfile': lock_name, 'verifiedVersions': checked}

def input_hashes(root: Path, migrations: list[dict], paths: dict, lock_name: str | None) -> dict[str, str | None]:
    from skipo_dependency_contracts import files_for_pattern
    targets = {'package.json', '.skipo/dependencies.json', '.skipo/migration-state.json'}
    if lock_name:
        targets.add(lock_name)
    for name in paths:
        targets.add(f'node_modules/{name}/package.json')
        targets.add(f'node_modules/{name}/skipo.migrations.json')
        manifest = safe_file(root, f'node_modules/{name}/package.json')
        if manifest.is_file():
            config = read_json(manifest).get('skipo', {})
            contract = config.get('migrationContract') if isinstance(config, dict) else None
            if isinstance(contract, str):
                targets.add(f'node_modules/{name}/{contract}')
    for migration in migrations:
        for operation in (migration.get('preconditions', []) + migration.get('transformations', []) +
                          migration.get('repair', []) + migration.get('verification', [])):
            if 'path' in operation:
                targets.add(operation['path'])
            for pattern in operation.get('paths', []):
                for path in files_for_pattern(root, pattern):
                    targets.add(path.relative_to(root).as_posix())
    return {name: digest(safe_file(root, name).read_bytes() if safe_file(root, name).is_file() else None)
            for name in sorted(targets)}

def plan_id(paths: dict, migrations: list[dict], hashes: dict) -> str:
    data = json.dumps({'paths': paths, 'migrations': migrations, 'inputs': hashes}, sort_keys=True, separators=(',', ':'))
    return digest(data.encode())
