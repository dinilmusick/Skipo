"""Fail-closed manifest, installed-package and lockfile checks for provider upgrades."""
from __future__ import annotations
import hashlib
import json
import re
from pathlib import Path

NAME = re.compile(r"^(?:@[a-z0-9][\w.-]*/)?[a-z0-9][\w.-]*$")
VERSION = re.compile(r"^v?(\d+)\.(\d+)(?:\.(\d+))?$")
OWNERSHIP_FILE = '.skipo/dependency-ownership.json'

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
    package_mode = p.parts[0] == 'node_modules'
    module_root = root.resolve() / 'node_modules'
    for part in p.parts:
        path = path / part
        if path.is_symlink():
            if not package_mode or (root / 'node_modules').is_symlink():
                raise ValueError(f"Migration path traverses symlink: {relative}")
            try:
                resolved = path.resolve()
            except (OSError, RuntimeError) as exc:
                raise ValueError(f"Broken package installation symlink: {relative}") from exc
            if resolved != module_root and module_root not in resolved.parents:
                raise ValueError(f"Package installation symlink escapes node_modules: {relative}")
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
    if not re.fullmatch(r"(?:\^|~|>=|<=|>|<)?v?\d+\.\d+(?:\.\d+)?(?:\s*,\s*(?:>=|<=|>|<)v?\d+\.\d+(?:\.\d+)?)*", spec):
        raise ValueError(f"Unsupported or ambiguous package specifier {spec!r}")
    actual = tuple(map(int, exact(installed).split('.')))
    for clause in spec.split(','):
        clause = clause.strip()
        match = re.fullmatch(r'(>=|<=|>|<|\^|~)?(v?\d+\.\d+(?:\.\d+)?)', clause)
        if not match:
            raise ValueError(f"Invalid dependency requirement: {clause}")
        op, raw = match.groups()
        expected = tuple(map(int, exact(raw).split('.')))
        if op == '^':
            major, minor, patch = expected
            upper = ((major + 1, 0, 0) if major else
                     (0, minor + 1, 0) if minor else (0, 0, patch + 1))
            valid = expected <= actual < upper
        elif op == '~':
            valid = expected <= actual < (expected[0], expected[1] + 1, 0)
        else:
            valid = {'>=': actual >= expected, '<=': actual <= expected,
                     '>': actual > expected, '<': actual < expected,
                     None: actual == expected}[op]
        if not valid:
            return False
    return True

def lock_versions(root: Path, names: dict[str, str]) -> tuple[str, dict[str, str]]:
    lockfiles = ('package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml',
                 'yarn.lock', 'bun.lock', 'bun.lockb')
    present = [path for name in lockfiles if (path := safe_file(root, name)).is_file()]
    if len(present) != 1:
        raise ValueError('Expected exactly one supported lockfile for verified migrations')
    lockfile = present[0]
    if lockfile.name in ('yarn.lock', 'bun.lock', 'bun.lockb'):
        raise ValueError(f'Unsupported lockfile for verified migrations: {lockfile.name}')
    if lockfile.name in ('package-lock.json', 'npm-shrinkwrap.json'):
        npm = lockfile
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
        return npm.name, versions
    # Parse only the pnpm importer subset we need with stdlib. Unknown YAML
    # constructs fail closed instead of introducing an undeclared CLI dependency.
    entries, importer, section, provider, in_importers = {}, None, None, None, False
    lock_version = None
    for line in lockfile.read_text(encoding='utf-8').splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        if '\t' in line or re.search(r'(?<!\S)[&*][A-Za-z_]', line):
            raise ValueError('Unsupported pnpm YAML feature; lockfile requires normalized importer entries')
        match = re.fullmatch(r'( *)([^:]+):(?:[ ]*(.*))?', line)
        if not match:
            if in_importers and line.startswith(' '):
                raise ValueError('Unsupported pnpm importer YAML syntax')
            continue
        depth, raw_key, value = len(match.group(1)), match.group(2), match.group(3)
        key = raw_key.strip().strip('"').strip("'")
        value = (value or '').strip().strip('"').strip("'")
        if depth == 0:
            in_importers = key == 'importers'
            if key == 'lockfileVersion':
                lock_version = value
        elif in_importers and depth == 2:
            importer, section, provider = key, None, None
        elif in_importers and importer == '.' and depth == 4:
            section, provider = key, None
        elif in_importers and importer == '.' and depth == 6 and section in (
                'dependencies', 'devDependencies', 'optionalDependencies'):
            provider = key
            if provider in entries:
                raise ValueError(f'Duplicate pnpm importer declaration: {provider}')
            entries[provider] = {}
        elif in_importers and importer == '.' and depth == 8 and provider in entries:
            if key in entries[provider]:
                raise ValueError(f'Duplicate pnpm importer property: {provider}.{key}')
            entries[provider][key] = value
    if not lock_version or not lock_version.startswith(('6.', '9.')):
        raise ValueError('Unsupported pnpm lockfile format')
    versions = {}
    for name, spec in names.items():
        entry = entries.get(name)
        if not isinstance(entry, dict) or entry.get('specifier') != spec:
            raise ValueError(f'Missing or inconsistent pnpm importer entry for {name}')
        versions[name] = exact(entry.get('version', '').split('(')[0])
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
    if migrations:
        targets.add(OWNERSHIP_FILE)
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

def plan_id(paths: dict, migrations: list[dict], hashes: dict, context: dict | None = None) -> str:
    data = json.dumps({'paths': paths, 'migrations': migrations, 'inputs': hashes,
                       'context': context or {}}, sort_keys=True, separators=(',', ':'))
    return digest(data.encode())
