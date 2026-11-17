"""Fail-closed, independently callable migration planner and transactional executor.

No provider-supplied code is ever evaluated. Application-owned files require an
explicit, application-local ownership grant before a package can mutate them.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import tempfile
from collections import defaultdict
from pathlib import Path, PurePosixPath
from typing import Any

VERSION_RE = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
PACKAGE_RE = re.compile(r"^(?:@[a-z0-9][a-z0-9._-]*/)?[a-z0-9][a-z0-9._-]*$")
MUTATORS = {"replace_text": {"find", "replace", "paths"}, "set_json": {"path", "key", "value"}}
ASSERTIONS = {"text_absent": {"text", "paths"}, "text_present": {"text", "paths"}, "json_equals": {"path", "key", "value"}}
JOURNAL = ".skipo/dependency-migration-journal.json"
STATE = ".skipo/migration-state.json"
TRACKING = ".skipo/dependencies.json"
GRANTS = ".skipo/dependency-ownership.json"
LOCKS = ("package-lock.json", "npm-shrinkwrap.json")


class MigrationError(ValueError):
    """Deterministic validation, conflict, or repair failure."""


def exact_version(value: Any) -> tuple[int, int, int]:
    if not isinstance(value, str) or not VERSION_RE.fullmatch(value):
        raise MigrationError(f"Invalid exact package version: {value!r}")
    return tuple(map(int, value.split("-", 1)[0].split("+", 1)[0].split(".")))


def _range(actual: str, requirement: str) -> bool:
    current = exact_version(actual)
    if not isinstance(requirement, str) or not requirement.strip():
        raise MigrationError(f"Invalid package requirement: {requirement!r}")
    for part in (x.strip() for x in requirement.split(",")):
        match = re.fullmatch(r"(\^|~|>=|<=|>|<|=)?(\d+\.\d+\.\d+)", part)
        if not match:
            raise MigrationError(f"Ambiguous/unsupported package requirement: {part!r}")
        op, value = match.groups()
        baseline = exact_version(value)
        if op in (None, "=") and current != baseline: return False
        if op == ">" and current <= baseline: return False
        if op == ">=" and current < baseline: return False
        if op == "<" and current >= baseline: return False
        if op == "<=" and current > baseline: return False
        if op == "~" and not (current >= baseline and current[:2] == baseline[:2]): return False
        if op == "^":
            upper = ((baseline[0] + 1, 0, 0) if baseline[0] else
                     (0, baseline[1] + 1, 0) if baseline[1] else
                     (0, 0, baseline[2] + 1))
            if not baseline <= current < upper: return False
    return True


def _relative(name: Any, *, glob: bool = False) -> str:
    if not isinstance(name, str) or not name or "\\" in name or "\x00" in name:
        raise MigrationError(f"Unsafe path: {name!r}")
    path = PurePosixPath(name)
    if path.is_absolute() or name.startswith("./") or path.as_posix() != name or any(p in ("", ".", "..") for p in path.parts):
        raise MigrationError(f"Unsafe path: {name!r}")
    if name.startswith(("node_modules/", ".git/", ".skipo/")):
        raise MigrationError(f"Protected migration path: {name}")
    if ":" in path.parts[0] or name.startswith("~"):
        raise MigrationError(f"Unsafe platform path: {name}")
    if not glob and any(char in name for char in "*?[]"):
        raise MigrationError(f"Expected literal owned file path: {name}")
    return name


def _inside(root: Path, rel: str) -> Path:
    path = root / rel
    if root.is_symlink() or any(p.is_symlink() for p in (path, *path.parents) if p != root.parent):
        raise MigrationError(f"Symlink in migration path: {rel}")
    if path.resolve(strict=False) != root.resolve() and root.resolve() not in path.resolve(strict=False).parents:
        raise MigrationError(f"Path escapes app root: {rel}")
    return path


def _read_json(path: Path, default: Any = None) -> Any:
    if not path.is_file():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, ValueError) as exc:
        raise MigrationError(f"Invalid JSON at {path}: {exc}") from exc


def _digest(payload: Any) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()


def validate_contract(contract: dict[str, Any], package: str, skipo_version: str = "1.1.0") -> None:
    if not isinstance(contract, dict) or contract.get("schemaVersion") != 1 or contract.get("package") != package:
        raise MigrationError(f"Invalid contract identity/schema: {package}")
    if not isinstance(contract.get("migrations"), list):
        raise MigrationError(f"Missing migrations array: {package}")
    compatibility = contract.get("compatibility", {})
    if not isinstance(compatibility, dict): raise MigrationError("Invalid compatibility declaration")
    for spec in (compatibility.get("skipo"), compatibility.get("requiresSkipo")):
        if spec and not _range(skipo_version, spec): raise MigrationError(f"Incompatible Skipo version: {spec}")
    if "dependencies" in compatibility and not isinstance(compatibility["dependencies"], dict):
        raise MigrationError("Invalid package compatibility constraints")
    ids, edges = set(), set()
    for mig in contract["migrations"]:
        if not isinstance(mig, dict) or not isinstance(mig.get("id"), str) or not mig["id"]:
            raise MigrationError("Invalid migration id")
        if mig["id"] in ids: raise MigrationError(f"Duplicate migration id: {mig['id']}")
        ids.add(mig["id"])
        src, dst = mig.get("fromVersion"), mig.get("toVersion")
        if exact_version(dst) <= exact_version(src): raise MigrationError(f"Non-forward migration: {mig['id']}")
        if (src, dst) in edges: raise MigrationError(f"Duplicate migration edge: {src}->{dst}")
        edges.add((src, dst))
        if not isinstance(mig.get("dependsOn", []), list) or any(not isinstance(d, str) or not d for d in mig.get("dependsOn", [])):
            raise MigrationError(f"Invalid migration dependencies: {mig['id']}")
        for key in ("deprecatedPatterns", "canonicalReplacements"):
            if key in mig and not isinstance(mig[key], list): raise MigrationError(f"Invalid {key}: {mig['id']}")
        for entry in mig.get("deprecatedPatterns", []):
            if isinstance(entry, str):
                if not entry: raise MigrationError("Empty deprecated pattern")
            elif isinstance(entry, dict) and isinstance(entry.get("text"), str) and entry["text"]:
                for pattern in entry.get("paths", ["src/**/*"]): _relative(pattern, glob=True)
            else: raise MigrationError("Invalid deprecated pattern")
        for entry in mig.get("canonicalReplacements", []):
            if not isinstance(entry, dict) or not entry.get("find") or not isinstance(entry.get("replace"), str) or entry["find"] == entry["replace"]:
                raise MigrationError("Non-declarative or invalid canonical replacement")
            if not isinstance(entry.get("paths", ["src/**/*"]), list): raise MigrationError("Invalid replacement paths")
            for pattern in entry.get("paths", ["src/**/*"]): _relative(pattern, glob=True)
        for field in ("requiresPackages",):
            if field in mig and (not isinstance(mig[field], dict) or any(not isinstance(v, str) for v in mig[field].values())):
                raise MigrationError(f"Invalid {field}: {mig['id']}")
        if mig.get("requiresSkipo") and not _range(skipo_version, mig["requiresSkipo"]):
            raise MigrationError(f"Incompatible Skipo requirement: {mig['id']}")
        if not isinstance(mig.get("ownedPaths", []), list): raise MigrationError("Invalid ownedPaths")
        for name in mig.get("ownedPaths", []): _relative(name)
        for group, allowed in (("preconditions", ASSERTIONS), ("transformations", MUTATORS),
                               ("repair", MUTATORS), ("verification", ASSERTIONS)):
            ops = mig.get(group, [])
            if not isinstance(ops, list): raise MigrationError(f"Invalid {group}: {mig['id']}")
            for op in ops:
                if not isinstance(op, dict) or op.get("type") not in allowed or not allowed[op["type"]].issubset(op):
                    raise MigrationError(f"Unsupported {group} operation: {mig['id']}")
                names = op.get("paths", []) if "paths" in op else [op["path"]]
                if not isinstance(names, list) or not names: raise MigrationError("Empty operation paths")
                for name in names: _relative(name, glob=True)
                accepted = set(allowed[op["type"]]) | {"type"}
                if op["type"] == "replace_text": accepted |= {"expectedMatches"}
                if op["type"] == "set_json": accepted |= {"expectedOld"}
                if set(op) - accepted: raise MigrationError(f"Unrecognized migration operation fields: {sorted(set(op)-accepted)}")
                if op["type"] == "replace_text":
                    if not all(isinstance(op[k], str) for k in ("find", "replace")) or not op["find"] or op["find"] == op["replace"]:
                        raise MigrationError("Invalid replacement")
                    if not isinstance(op.get("expectedMatches", 1), int) or op.get("expectedMatches", 1) < 0:
                        raise MigrationError("Invalid expectedMatches")
                if op["type"] in ("text_present", "text_absent") and (not isinstance(op["text"], str) or not op["text"]):
                    raise MigrationError("Invalid assertion text")
                if op["type"] in ("set_json", "json_equals") and (not isinstance(op["key"], str) or not re.fullmatch(r"[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*", op["key"])):
                    raise MigrationError("Invalid JSON key")
        # Never grant code execution from package metadata.
        if any(k in mig for k in ("script", "command", "shell", "run", "hooks", "code")):
            raise MigrationError(f"Executable migration instructions are forbidden: {mig['id']}")


def resolve_path(contract: dict[str, Any], start: str, target: str) -> list[dict[str, Any]]:
    s, t = exact_version(start), exact_version(target)
    if s == t: return []
    if s > t: raise MigrationError(f"Downgrade unsupported: {start}->{target}")
    edges = defaultdict(list)
    for m in contract["migrations"]: edges[exact_version(m["fromVersion"])].append(m)
    routes: list[list[dict[str, Any]]] = []
    def walk(current: tuple[int, int, int], path: list[dict[str, Any]]) -> None:
        if len(routes) > 1: return
        if current == t:
            routes.append(path)
            return
        for m in sorted(edges[current], key=lambda x: (exact_version(x["toVersion"]), x["id"])):
            nxt = exact_version(m["toVersion"])
            if current < nxt <= t: walk(nxt, path + [m])
    walk(s, [])
    if not routes: raise MigrationError(f"Missing migration edge/path {contract['package']} {start}->{target}")
    if len(routes) != 1: raise MigrationError(f"Ambiguous migration path {contract['package']} {start}->{target}")
    return routes[0]


def _inventory(root: Path) -> tuple[dict[str, dict[str, str]], dict[str, Any]]:
    root = Path(root).resolve()
    manifest = _read_json(root / "package.json")
    if not isinstance(manifest, dict): raise MigrationError("Missing/invalid package.json")
    declared: dict[str, str] = {}
    for section in ("dependencies", "devDependencies", "optionalDependencies"):
        entries = manifest.get(section, {})
        if not isinstance(entries, dict): raise MigrationError(f"Invalid {section}")
        for name, spec in entries.items():
            if name in declared and declared[name] != spec: raise MigrationError(f"Conflicting manifest declaration: {name}")
            declared[name] = spec
    lock_names = [name for name in LOCKS if (root / name).exists()]
    if len(lock_names) != 1: raise MigrationError("Expected exactly one npm lockfile (package-lock.json or npm-shrinkwrap.json)")
    lock = _read_json(root / lock_names[0])
    if not isinstance(lock, dict) or not isinstance(lock.get("packages"), dict):
        raise MigrationError("Unsupported lockfile: requires npm lockfileVersion 2/3")
    root_lock = lock["packages"].get("", {})
    versions: dict[str, dict[str, str]] = {}
    for name, spec in sorted(declared.items()):
        if not PACKAGE_RE.fullmatch(name): raise MigrationError(f"Invalid package name: {name}")
        if not isinstance(spec, str): raise MigrationError(f"Invalid dependency specifier: {name}")
        entry = lock["packages"].get(f"node_modules/{name}")
        occurrences = [root_lock.get(section, {}).get(name) for section in
                       ("dependencies", "devDependencies", "optionalDependencies") if name in root_lock.get(section, {})]
        if not occurrences or any(value != spec for value in occurrences) or not isinstance(entry, dict):
            raise MigrationError(f"Manifest/lockfile mismatch: {name}")
        v = entry.get("version")
        exact_version(v)
        if not _range(v, spec): raise MigrationError(f"Manifest range conflicts with lockfile: {name} {spec} != {v}")
        installed_path = root / "node_modules" / name / "package.json"
        installed = _read_json(installed_path)
        if not isinstance(installed, dict) or installed.get("version") != v or installed.get("name") != name:
            raise MigrationError(f"Installed package/lockfile mismatch: {name} lock={v}")
        versions[name] = {"version": v, "specifier": spec}
    return versions, manifest


def _contract(root: Path, name: str, skipo: str) -> dict[str, Any] | None:
    pkg = root / "node_modules" / name
    manifest = _read_json(pkg / "package.json")
    declaration = manifest.get("skipo", {}) if isinstance(manifest, dict) else {}
    if not isinstance(declaration, dict): raise MigrationError(f"Invalid package Skipo metadata: {name}")
    declared = declaration.get("migrationContract", declaration.get("migrations", "skipo.migrations.json"))
    if not isinstance(declared, str): raise MigrationError(f"Invalid migrationContract path: {name}")
    # Only package-shipped contracts are authoritative; no app-provided overrides.
    relative = _relative(declared)
    target = pkg / relative
    if any(p.is_symlink() for p in (pkg, target, *target.parents) if p != root.parent):
        raise MigrationError(f"Symlinked package contract: {name}")
    if not target.is_file(): return None
    contract = _read_json(target)
    validate_contract(contract, name, skipo)
    return contract


def _grant(root: Path) -> dict[str, str]:
    granted = _read_json(root / GRANTS, {})
    if not isinstance(granted, dict) or not isinstance(granted.get("owners", {}), dict):
        raise MigrationError("Invalid dependency ownership grants")
    result = granted.get("owners", {})
    for p, owner in result.items():
        _relative(p)
        if not isinstance(owner, str) or not PACKAGE_RE.fullmatch(owner): raise MigrationError("Invalid ownership grant")
    return result


def _matches(root: Path, pattern: str) -> list[str]:
    _relative(pattern, glob=True)
    names = []
    for file in sorted(root.glob(pattern)):
        rel = file.relative_to(root).as_posix()
        if file.is_symlink(): raise MigrationError(f"Symlinked migration target: {rel}")
        if file.is_file():
            _relative(rel)
            _inside(root, rel)
            names.append(rel)
    return names


def _targets(root: Path, operation: dict[str, Any]) -> list[str]:
    if "paths" in operation:
        return sorted(set(p for pattern in operation["paths"] for p in _matches(root, pattern)))
    name = _relative(operation["path"])
    _inside(root, name)
    return [name]


def _snapshot(root: Path, plans: list[dict[str, Any]]) -> dict[str, str | None]:
    names = set()
    for m in plans:
        for op in m.get("preconditions", []) + m.get("transformations", []) + m.get("repair", []) + m.get("verification", []):
            names.update(_targets(root, op))
    snapshot = {}
    for name in sorted(names):
        path = _inside(root, name)
        snapshot[name] = base64.b64encode(path.read_bytes()).decode("ascii") if path.exists() else None
    return snapshot


def _assertion(memory: dict[str, bytes | None], root: Path, op: dict[str, Any]) -> None:
    targets = _targets(root, op)
    if op["type"] == "json_equals":
        raw = memory.get(targets[0])
        if raw is None: raise MigrationError(f"Missing assertion file: {targets[0]}")
        data: Any = json.loads(raw.decode("utf-8"))
        for part in op["key"].split("."): data = data[part]
        if data != op["value"]: raise MigrationError(f"JSON assertion failed: {targets[0]}:{op['key']}")
        return
    present = [p for p in targets if memory.get(p) is not None and op["text"] in memory[p].decode("utf-8")]
    if op["type"] == "text_present" and not present: raise MigrationError(f"Required text absent: {op['text']}")
    if op["type"] == "text_absent" and present: raise MigrationError(f"Forbidden text present: {', '.join(present)}")


def _transform(memory: dict[str, bytes | None], root: Path, op: dict[str, Any]) -> None:
    targets = _targets(root, op)
    if op["type"] == "replace_text":
        changed, already = 0, False
        for name in targets:
            raw = memory.get(name)
            if raw is None: continue
            text = raw.decode("utf-8")
            changed += text.count(op["find"])
            already = already or op["replace"] in text
            memory[name] = text.replace(op["find"], op["replace"]).encode("utf-8")
        if changed < op.get("expectedMatches", 1) and not (changed == 0 and already):
            raise MigrationError(f"Unmet replacement match count: {op['find']}")
        return
    name = targets[0]
    raw = memory.get(name)
    data = json.loads(raw.decode("utf-8")) if raw is not None else {}
    if not isinstance(data, dict): raise MigrationError(f"Non-object JSON: {name}")
    cursor = data
    for part in op["key"].split(".")[:-1]:
        value = cursor.setdefault(part, {})
        if not isinstance(value, dict): raise MigrationError(f"JSON ownership collision: {name}")
        cursor = value
    key = op["key"].split(".")[-1]
    old = cursor.get(key)
    if "expectedOld" in op and old != op["expectedOld"] and old != op["value"]:
        raise MigrationError(f"Unexpected old JSON value: {name}:{op['key']}")
    cursor[key] = op["value"]
    memory[name] = (json.dumps(data, sort_keys=True, indent=2) + "\n").encode()


def _sort(migrations: list[dict[str, Any]], already: set[str]) -> list[dict[str, Any]]:
    byid = {m["id"]: m for m in migrations}
    if len(byid) != len(migrations): raise MigrationError("Duplicate global migration identity")
    remaining = set(byid)
    ordered = []
    while remaining:
        ready = sorted(k for k in remaining if set(byid[k].get("dependsOn", [])) <= (already | (set(byid) - remaining)))
        if not ready:
            unresolved = {k: sorted(set(byid[k].get("dependsOn", [])) - already - set(byid)) for k in remaining}
            raise MigrationError(f"Unresolved or cyclic migration dependencies: {unresolved}")
        key = ready[0]
        ordered.append(byid[key])
        remaining.remove(key)
    return ordered


def _plans(root: Path, skipo_version: str) -> dict[str, Any]:
    versions, _ = _inventory(root)
    old_data = _read_json(root / TRACKING, {})
    if not isinstance(old_data, dict): raise MigrationError("Invalid dependency baseline")
    resolved = old_data.get("_resolved", {})
    if not isinstance(resolved, dict): raise MigrationError("Invalid resolved baseline")
    state = _read_json(root / STATE, {})
    if not isinstance(state, dict): raise MigrationError("Invalid migration state")
    applied = set(state.get("dependencyApplied", []))
    grants = _grant(root)
    selections: list[dict[str, Any]] = []
    paths: dict[str, Any] = {}
    for name, installed in sorted(versions.items()):
        current = installed["version"]
        old = resolved.get(name)
        if old is None:
            old = old_data.get(name)
            if isinstance(old, dict): old = old.get("version")
        contract = _contract(root, name, skipo_version)
        if contract:
            for dep, requirement in contract.get("compatibility", {}).get("dependencies", {}).items():
                if dep not in versions or not _range(versions[dep]["version"], requirement):
                    raise MigrationError(f"Incompatible provider dependency: {name} requires {dep} {requirement}")
        if old is None:
            paths[name] = {"from": None, "to": current, "specifier": installed["specifier"], "migrations": [], "baseline": True}
            continue
        exact_version(old)
        if old == current:
            paths[name] = {"from": old, "to": current, "specifier": installed["specifier"], "migrations": []}
            continue
        if contract is None: raise MigrationError(f"Missing package-shipped migration contract: {name} {old}->{current}")
        chain = resolve_path(contract, old, current)
        paths[name] = {"from": old, "to": current, "specifier": installed["specifier"], "migrations": [m["id"] for m in chain]}
        prev = None
        for mig in chain:
            for required_name, requirement in mig.get("requiresPackages", {}).items():
                if required_name not in versions or not _range(versions[required_name]["version"], requirement):
                    raise MigrationError(f"Incompatible migration dependency: {name}/{mig['id']} requires {required_name} {requirement}")
            entry = {**mig, "package": name, "contractId": mig["id"], "id": f"{name}::{mig['id']}"}
            replacements = [{"type": "replace_text", "find": r["find"], "replace": r["replace"],
                             "paths": r.get("paths", ["src/**/*"]), "expectedMatches": 0}
                            for r in mig.get("canonicalReplacements", [])]
            entry["transformations"] = list(mig.get("transformations", [])) + replacements
            handled = {op.get("find") for op in entry["transformations"] + entry.get("repair", []) if op["type"] == "replace_text"}
            for pattern in mig.get("deprecatedPatterns", []):
                spec = {"text": pattern, "paths": ["src/**/*"]} if isinstance(pattern, str) else pattern
                if spec["text"] not in handled:
                    for file_pattern in spec.get("paths", ["src/**/*"]):
                        if any(spec["text"] in (root / target).read_text(encoding="utf-8") for target in _matches(root, file_pattern)):
                            raise MigrationError(f"Deprecated pattern without deterministic replacement: {name}/{mig['id']}: {spec['text']}")
            deps = [d if "::" in d else f"{name}::{d}" for d in mig.get("dependsOn", [])]
            if prev: deps.append(prev)
            entry["dependsOn"] = sorted(set(deps))
            prev = entry["id"]
            for op in mig.get("transformations", []) + mig.get("repair", []):
                for target in _targets(root, op):
                    if grants.get(target) != name or target not in mig.get("ownedPaths", []):
                        raise MigrationError(f"Unowned migration target: {name} -> {target}")
            selections.append(entry)
    ordered = _sort(selections, applied)
    # State and manifest are included in plan fingerprint; affected files are pinned separately.
    snap = _snapshot(root, ordered)
    signature = _digest({"versions": versions, "baseline": old_data, "state": state, "grants": grants, "files": snap,
                         "migrations": ordered})
    return {"ok": True, "operation": "dependency-migration-plan", "paths": paths, "migrations": ordered,
            "errors": [], "applied": False, "fingerprint": signature, "stateHash": _digest(state), "snapshot": snap}


def _failure(exc: Exception, operation: str) -> dict[str, Any]:
    return {"ok": False, "operation": operation, "paths": {}, "migrations": [], "errors": [str(exc)], "applied": False}


def plan_dependency_migrations(root: Path, skipo_version: str = "1.1.0") -> dict[str, Any]:
    try:
        if (Path(root) / JOURNAL).exists():
            raise MigrationError("Interrupted dependency journal; recover before planning")
        return _plans(Path(root).resolve(), skipo_version)
    except (MigrationError, OSError, KeyError, TypeError, UnicodeError, ValueError) as exc:
        return _failure(exc, "dependency-migration-plan")


def _atomic(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(prefix=".skipo-migration-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as writer:
            writer.write(payload)
            writer.flush()
            os.fsync(writer.fileno())
        os.replace(temp, path)
    finally:
        if os.path.exists(temp): os.unlink(temp)


def recover_dependency_migrations(root: Path) -> dict[str, Any]:
    root = Path(root).resolve()
    path = root / JOURNAL
    if not path.exists(): return {"ok": True, "recovered": False, "errors": []}
    try:
        journal = _read_json(path)
        if journal.get("schemaVersion") != 1 or not isinstance(journal.get("before"), dict):
            raise MigrationError("Invalid recovery journal")
        before = journal["before"]
        for name in sorted(before):
            if name not in (STATE, TRACKING) and name.startswith(".skipo/"):
                raise MigrationError(f"Protected recovery path: {name}")
            if name not in (STATE, TRACKING): _relative(name)
            file = _inside(root, name)
            data = before[name]
            if data is None:
                if file.exists(): file.unlink()
            else:
                _atomic(file, base64.b64decode(data, validate=True))
        path.unlink()
        return {"ok": True, "recovered": True, "errors": []}
    except (OSError, ValueError, KeyError, TypeError) as exc:
        return {"ok": False, "recovered": False, "errors": [f"Unrecoverable migration journal: {exc}"]}


def execute_dependency_migrations(root: Path, plan: dict[str, Any], skipo_version: str = "1.1.0", *,
                                  fail_after_writes: int | None = None) -> dict[str, Any]:
    root = Path(root).resolve()
    if not plan.get("ok"): return {**plan, "applied": False}
    recovery = recover_dependency_migrations(root)
    if not recovery["ok"]: return {**_failure(MigrationError(recovery["errors"][0]), "dependency-migration-execute"), "recovery": recovery}
    fresh = plan_dependency_migrations(root, skipo_version)
    if not fresh["ok"] or plan.get("fingerprint") != fresh.get("fingerprint"):
        return _failure(MigrationError("Stale or invalid dependency migration plan; replan required"), "dependency-migration-execute")
    try:
        memory = {name: base64.b64decode(encoded) if encoded is not None else None for name, encoded in fresh["snapshot"].items()}
        grants = _grant(root)
        # All preconditions, transformations, and postconditions are checked against staged memory BEFORE any mutation.
        for mig in fresh["migrations"]:
            for op in mig.get("preconditions", []): _assertion(memory, root, op)
            for op in mig.get("transformations", []) + mig.get("repair", []):
                for name in _targets(root, op):
                    if grants.get(name) != mig["package"] or name not in mig.get("ownedPaths", []):
                        raise MigrationError(f"Ownership changed: {name}")
                _transform(memory, root, op)
            for op in mig.get("verification", []): _assertion(memory, root, op)
        state = _read_json(root / STATE, {})
        dependencies = _read_json(root / TRACKING, {})
        state["dependencyApplied"] = sorted(set(state.get("dependencyApplied", [])) | {m["id"] for m in fresh["migrations"]})
        state["schemaVersion"] = max(1, state.get("schemaVersion", 1))
        state["pending"] = []
        resolved = dependencies.setdefault("_resolved", {})
        for name, item in fresh["paths"].items():
            resolved[name] = item["to"]
            dependencies[name] = item["specifier"]
        outputs = dict(memory)
        outputs[STATE] = (json.dumps(state, sort_keys=True, indent=2) + "\n").encode()
        outputs[TRACKING] = (json.dumps(dependencies, sort_keys=True, indent=2) + "\n").encode()
        before = dict(fresh["snapshot"])
        for name in (STATE, TRACKING):
            file = root / name
            before[name] = base64.b64encode(file.read_bytes()).decode() if file.exists() else None
        changed = {p: data for p, data in outputs.items() if before.get(p) != (base64.b64encode(data).decode() if data is not None else None)}
        if not changed:
            verified = verify_dependency_migrations(root, skipo_version)
            return {**fresh, "applied": verified["ok"], "ok": verified["ok"], "errors": verified["errors"], "actions": [], "idempotent": True}
        journal = {"schemaVersion": 1, "planFingerprint": fresh["fingerprint"], "before": {p: before[p] for p in changed}}
        _atomic(root / JOURNAL, (json.dumps(journal, sort_keys=True) + "\n").encode())
        writes = 0
        for name in sorted(changed):
            path = _inside(root, name)
            if changed[name] is None:
                if path.exists(): path.unlink()
            else: _atomic(path, changed[name])
            writes += 1
            if fail_after_writes is not None and writes >= fail_after_writes:
                raise MigrationError(f"Injected failure after {writes} writes")
        verified = verify_dependency_migrations(root, skipo_version, _allow_journal=True)
        if not verified["ok"]: raise MigrationError("Independent verification failed: " + "; ".join(verified["errors"]))
        (root / JOURNAL).unlink()
        return {**fresh, "ok": True, "applied": True, "actions": sorted(changed), "errors": [], "verified": True, "idempotent": False}
    except (ValueError, KeyError, OSError, TypeError, UnicodeError) as exc:
        recovered = recover_dependency_migrations(root)
        return {**_failure(exc, "dependency-migration-execute"), "rollback": recovered}


def verify_dependency_migrations(root: Path, skipo_version: str = "1.1.0", *, _allow_journal: bool = False) -> dict[str, Any]:
    root = Path(root).resolve()
    try:
        if (root / JOURNAL).exists() and not _allow_journal: raise MigrationError("Unrecovered dependency transaction exists")
        versions, _ = _inventory(root)
        state = _read_json(root / STATE, {})
        tracking = _read_json(root / TRACKING, {})
        resolved = tracking.get("_resolved", {})
        if not isinstance(state, dict) or not isinstance(resolved, dict): raise MigrationError("Malformed migration tracking state")
        applied = set(state.get("dependencyApplied", []))
        grants = _grant(root)
        for name, item in sorted(versions.items()):
            if resolved.get(name) != item["version"] or tracking.get(name) != item["specifier"]:
                raise MigrationError(f"Unreconciled dependency state: {name}")
            contract = _contract(root, name, skipo_version)
            if contract:
                compatible = contract.get("compatibility", {}).get("dependencies", {})
                for dep, req in compatible.items():
                    if dep not in versions or not _range(versions[dep]["version"], req):
                        raise MigrationError(f"Incompatible provider dependency: {name}->{dep}")
                for mig in contract["migrations"]:
                    if f"{name}::{mig['id']}" in applied:
                        for op in mig.get("transformations", []) + mig.get("repair", []):
                            for target in _targets(root, op):
                                if grants.get(target) != name or target not in mig.get("ownedPaths", []):
                                    raise MigrationError(f"Lost migration ownership grant: {name} -> {target}")
                    if f"{name}::{mig['id']}" in applied and mig["toVersion"] == item["version"]:
                        memory = {p: (root / p).read_bytes() if (root / p).exists() else None
                                  for op in mig.get("verification", []) for p in _targets(root, op)}
                        for op in mig.get("verification", []): _assertion(memory, root, op)
        return {"ok": True, "errors": [], "versions": versions, "verified": True}
    except (ValueError, KeyError, TypeError, OSError, UnicodeError) as exc:
        return {"ok": False, "errors": [str(exc)], "verified": False}