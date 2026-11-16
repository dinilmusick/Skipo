#!/usr/bin/env python3
"""Contract-driven, deterministic dependency migrations for Skipo applications."""
from __future__ import annotations
import json
import re
from collections import deque
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 1
STATE_DEFAULT = {"schemaVersion": 1, "applied": [], "pending": []}

def version(value: str) -> tuple[int, ...]:
    match = re.search(r"(\d+(?:\.\d+){0,2})", str(value or ""))
    parts = [int(part) for part in match.group(1).split(".")] if match else [0]
    return tuple((parts + [0, 0, 0])[:3])

def safe_path(root: Path, relative: str) -> Path:
    candidate = (root / relative).resolve()
    if candidate != root.resolve() and root.resolve() not in candidate.parents:
        raise ValueError(f"Migration path escapes application root: {relative}")
    return candidate

def package_name_path(name: str) -> str:
    return name.replace("@", "").replace("/", "__")

def discover_contract(root: Path, package: str) -> dict[str, Any] | None:
    pkg_dir = safe_path(root, f"node_modules/{package}")
    manifest_path = pkg_dir / "package.json"
    metadata = {}
    if manifest_path.is_file():
        metadata = json.loads(manifest_path.read_text(encoding="utf-8"))
    declaration = metadata.get("skipo", {})
    relative = declaration.get("migrationContract") or declaration.get("migrations")
    candidates = [pkg_dir / relative] if isinstance(relative, str) else []
    candidates.extend([pkg_dir / "skipo.migrations.json",
        safe_path(root, f".skipo/contracts/{package_name_path(package)}.migrations.json")])
    for path in candidates:
        resolved = path.resolve()
        if isinstance(relative, str) and path == candidates[0] and resolved != pkg_dir.resolve() and pkg_dir.resolve() not in resolved.parents:
            raise ValueError(f"Migration contract path escapes package: {relative}")
        if path.is_file():
            return json.loads(path.read_text(encoding="utf-8"))
    return None

def satisfies(actual: str, requirement: str) -> bool:
    actual_v = version(actual)
    for clause in requirement.split(","):
        clause = clause.strip()
        operator = next((op for op in (">=", "<=", ">", "<", "^", "~") if clause.startswith(op)), "==")
        expected = version(clause[len(operator):] if operator != "==" else clause)
        if operator == ">=" and actual_v < expected: return False
        if operator == "<=" and actual_v > expected: return False
        if operator == ">" and actual_v <= expected: return False
        if operator == "<" and actual_v >= expected: return False
        if operator == "==" and actual_v != expected: return False
        if operator == "^" and (actual_v < expected or actual_v[0] != expected[0]): return False
        if operator == "~" and (actual_v < expected or actual_v[:2] != expected[:2]): return False
    return True

def validate_operations(migration: dict[str, Any]) -> None:
    handlers = {
        "replace_text": {"find", "replace", "paths"}, "set_json": {"path", "key", "value"},
        "text_absent": {"text", "paths"}, "text_present": {"text", "paths"},
        "json_equals": {"path", "key", "value"},
    }
    for group in ("transformations", "repair", "verification"):
        for operation in migration.get(group, []):
            kind = operation.get("type")
            required = handlers.get(kind)
            if required is None or not required.issubset(operation):
                raise ValueError(f"Unsupported or incomplete {group} operation in {migration['id']}: {kind}")
            paths = operation.get("paths", []) if "paths" in operation else [operation["path"]]
            for path in paths:
                if not isinstance(path, str) or Path(path).is_absolute() or ".." in Path(path).parts:
                    raise ValueError(f"Unsafe migration operation path: {path}")
            if kind == "replace_text" and operation["find"] == operation["replace"]:
                raise ValueError(f"No-op text replacement in {migration['id']}")

def validate_contract(contract: dict[str, Any], package: str, skipo_version: str = "1.1.0") -> None:
    if contract.get("schemaVersion") != SCHEMA_VERSION or contract.get("package") != package:
        raise ValueError(f"Invalid migration contract identity/schema for {package}")
    if not isinstance(contract.get("migrations"), list):
        raise ValueError(f"Migration contract for {package} must contain a migrations array")
    compatibility = contract.get("compatibility", {})
    requirement = compatibility.get("skipo") or compatibility.get("requiresSkipo")
    if requirement and not satisfies(skipo_version, requirement):
        raise ValueError(f"{package} migration contract requires Skipo {requirement}")
    seen = set()
    for item in contract.get("migrations", []):
        required = ("id", "fromVersion", "toVersion")
        if any(not item.get(key) for key in required) or item["id"] in seen:
            raise ValueError(f"Invalid or duplicate migration in {package}")
        seen.add(item["id"])
        validate_operations(item)
        if version(item["toVersion"]) == version(item["fromVersion"]):
            raise ValueError(f"Migration {item['id']} does not change version")
        if item.get("requiresSkipo") and not satisfies(skipo_version, item["requiresSkipo"]):
            raise ValueError(f"Migration {item['id']} requires Skipo {item['requiresSkipo']}")

def resolve_path(contract: dict[str, Any], start: str, target: str) -> list[dict[str, Any]]:
    migrations = contract.get("migrations", [])
    queue = deque([(start, [])])
    best = {start}
    while queue:
        current, path = queue.popleft()
        if version(current) == version(target):
            return path
        edges = sorted((m for m in migrations if version(m["fromVersion"]) == version(current)),
                       key=lambda m: (version(m["toVersion"]), m["id"]))
        for edge in edges:
            nxt = edge["toVersion"]
            if version(nxt) not in best and version(nxt) <= version(target):
                best.add(version(nxt))
                queue.append((nxt, path + [edge]))
    raise ValueError(f"Missing migration path {contract['package']} {start} -> {target}")

def _package_version(root: Path, name: str, declared: str) -> str:
    manifest = safe_path(root, f"node_modules/{name}/package.json")
    if manifest.is_file():
        return str(json.loads(manifest.read_text(encoding="utf-8")).get("version") or declared)
    return str(declared).lstrip("^~")

def plan_dependency_migrations(root: Path, skipo_version: str = "1.1.0") -> dict[str, Any]:
    dependencies = {}
    pkg = json.loads((root / "package.json").read_text(encoding="utf-8"))
    for section in ("dependencies", "devDependencies", "optionalDependencies"):
        dependencies.update(pkg.get(section, {}))
    previous = json.loads((root / ".skipo/dependencies.json").read_text(encoding="utf-8")) if (root / ".skipo/dependencies.json").is_file() else {}
    selected, errors, paths = [], [], {}
    for package in sorted(dependencies):
        if not package.startswith("@ultrst-armada/") and package != "@dinilmusick/gutts":
            continue
        current = _package_version(root, package, dependencies[package])
        old = previous.get(package)
        if not old:
            paths[package] = {"from": None, "to": current, "migrations": [], "baseline": True}
            continue
        if version(old) == version(current):
            paths[package] = {"from": old, "to": current, "migrations": []}
            continue
        try:
            contract = discover_contract(root, package)
            if not contract:
                raise ValueError(f"No migration contract shipped by {package}")
            validate_contract(contract, package, skipo_version)
            chosen = resolve_path(contract, str(old), current)
            paths[package] = {"from": old, "to": current, "migrations": [m["id"] for m in chosen]}
            for item in chosen:
                selected.append({"package": package, **item})
        except (ValueError, OSError, json.JSONDecodeError) as exc:
            errors.append(str(exc))
    last_by_package = {}
    for item in selected:
        previous_id = last_by_package.get(item["package"])
        if previous_id:
            item["dependsOn"] = sorted(set(item.get("dependsOn", [])) | {previous_id})
        last_by_package[item["package"]] = item["id"]
    state_file = root / ".skipo/migration-state.json"
    applied_ids = set(json.loads(state_file.read_text(encoding="utf-8")).get("applied", [])) if state_file.is_file() else set()
    ordered = order_migrations(selected, errors, applied_ids)
    return {"ok": not errors, "operation": "dependency-migration-plan", "paths": paths,
            "migrations": ordered, "errors": sorted(set(errors)), "applied": False}

def order_migrations(items: list[dict[str, Any]], errors: list[str], applied: set[str] | None = None) -> list[dict[str, Any]]:
    by_id = {item["id"]: item for item in items}
    completed = applied or set()
    incoming = {}
    for key, item in by_id.items():
        missing = set(item.get("dependsOn", [])) - by_id.keys() - completed
        if missing:
            errors.append(f"Migration {key} depends on unavailable migrations: {', '.join(sorted(missing))}")
        incoming[key] = set(item.get("dependsOn", [])) & by_id.keys()
    ready = sorted(key for key, deps in incoming.items() if not deps)
    ordered = []
    while ready:
        key = ready.pop(0)
        ordered.append(by_id[key])
        for other in sorted(incoming):
            if key in incoming[other]:
                incoming[other].remove(key)
                if not incoming[other] and other not in {x["id"] for x in ordered} and other not in ready:
                    ready.append(other)
        ready.sort()
    if len(ordered) != len(items):
        errors.append("Dependency migration ordering contains a cycle or missing dependency.")
        return []
    return ordered

def files_for_pattern(root: Path, pattern: str) -> list[Path]:
    safe_path(root, pattern)
    return [p for p in sorted(root.glob(pattern)) if p.is_file() and not p.is_symlink()]

def apply_operation(root: Path, operation: dict[str, Any], apply: bool) -> dict[str, Any]:
    kind = operation.get("type")
    if kind == "replace_text":
        matches = []
        for pattern in operation.get("paths", []):
            for path in files_for_pattern(root, pattern):
                text = path.read_text(encoding="utf-8")
                if operation["find"] in text or operation["replace"] in text:
                    matches.append((path, text))
        changed = 0
        replacement_present = any(operation["replace"] in p.read_text(encoding="utf-8") for pattern in operation.get("paths", []) for p in files_for_pattern(root, pattern))
        for path, text in matches:
            count = text.count(operation["find"])
            if not count and operation["replace"] in text:
                continue
            if count < operation.get("expectedMatches", 1):
                raise ValueError(f"Expected matches not found for {path.relative_to(root)}")
            changed += count
            if apply:
                path.write_text(text.replace(operation["find"], operation["replace"]), encoding="utf-8")
        if changed < operation.get("expectedMatches", 1) and not replacement_present:
            raise ValueError(f"Expected source pattern not found: {operation['find']}")
        return {"type": kind, "matches": changed, "files": [p.relative_to(root).as_posix() for p, _ in matches]}
    if kind == "set_json":
        path = safe_path(root, operation["path"])
        data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        cursor = data
        parts = operation["key"].split(".")
        for part in parts[:-1]:
            cursor = cursor.setdefault(part, {})
        old, desired = cursor.get(parts[-1]), operation["value"]
        if old not in (operation.get("expectedOld", old), desired):
            raise ValueError(f"Unexpected JSON value at {operation['path']}:{operation['key']}")
        if apply and old != desired:
            cursor[parts[-1]] = desired
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        return {"type": kind, "path": operation["path"], "key": operation["key"], "changed": old != desired}
    raise ValueError(f"Unsupported deterministic migration operation: {kind}")

def verify_operation(root: Path, operation: dict[str, Any]) -> None:
    kind = operation.get("type")
    if kind == "text_absent":
        for pattern in operation.get("paths", []):
            for path in files_for_pattern(root, pattern):
                if operation["text"] in path.read_text(encoding="utf-8"):
                    raise ValueError(f"Deprecated pattern remains: {path.relative_to(root)}")
    elif kind == "text_present":
        if not any(operation["text"] in p.read_text(encoding="utf-8") for pattern in operation.get("paths", []) for p in files_for_pattern(root, pattern)):
            raise ValueError(f"Required canonical pattern missing: {operation['text']}")
    elif kind == "json_equals":
        path = safe_path(root, operation["path"])
        data = json.loads(path.read_text(encoding="utf-8"))
        value = data
        for part in operation["key"].split("."):
            value = value[part]
        if value != operation["value"]:
            raise ValueError(f"Verification failed at {operation['path']}:{operation['key']}")
    else:
        raise ValueError(f"Unsupported migration verification operation: {kind}")

def execute_dependency_migrations(root: Path, plan: dict[str, Any]) -> dict[str, Any]:
    if not plan.get("ok"):
        return {**plan, "applied": False}
    actions, errors = [], []
    state_path = root / ".skipo/migration-state.json"
    state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.is_file() else dict(STATE_DEFAULT)
    applied = set(state.get("applied", []))
    snapshots: dict[Path, bytes | None] = {}
    for migration in plan["migrations"]:
        if migration["id"] in applied:
            continue
        for operation in migration.get("transformations", []) + migration.get("repair", []):
            if operation.get("type") == "replace_text":
                targets = [p for pattern in operation.get("paths", []) for p in files_for_pattern(root, pattern)]
            elif operation.get("type") == "set_json":
                targets = [safe_path(root, operation["path"])]
            else:
                targets = []
            for target in targets:
                snapshots.setdefault(target, target.read_bytes() if target.is_file() else None)
    for migration in plan["migrations"]:
        if migration["id"] in applied:
            continue
        try:
            for operation in migration.get("transformations", []) + migration.get("repair", []):
                actions.append({"migration": migration["id"], **apply_operation(root, operation, True)})
            for operation in migration.get("verification", []):
                verify_operation(root, operation)
            applied.add(migration["id"])
        except (ValueError, OSError, KeyError, json.JSONDecodeError) as exc:
            errors.append(f"{migration['id']}: {exc}")
            break
    if errors:
        for path, content in snapshots.items():
            if content is None:
                if path.exists(): path.unlink()
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(content)
        actions = []
    if not errors:
        state.update({"schemaVersion": max(1, state.get("schemaVersion", 1)), "applied": sorted(applied), "pending": []})
        state_path.parent.mkdir(parents=True, exist_ok=True)
        state_path.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        dependencies = json.loads((root / ".skipo/dependencies.json").read_text(encoding="utf-8")) if (root / ".skipo/dependencies.json").is_file() else {}
        dependencies.update({name: item["to"] for name, item in plan["paths"].items()})
        (root / ".skipo/dependencies.json").write_text(json.dumps(dependencies, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return {**plan, "ok": not errors, "errors": errors, "actions": actions, "applied": not errors}

def verify_dependency_migrations(root: Path, skipo_version: str = "1.1.0") -> dict[str, Any]:
    plan = plan_dependency_migrations(root, skipo_version)
    errors = list(plan["errors"])
    state_file = root / ".skipo/migration-state.json"
    applied = set(json.loads(state_file.read_text(encoding="utf-8")).get("applied", [])) if state_file.is_file() else set()
    pkg = json.loads((root / "package.json").read_text(encoding="utf-8"))
    names = set(pkg.get("dependencies", {})) | set(pkg.get("devDependencies", {})) | set(pkg.get("optionalDependencies", {}))
    for package in sorted(names):
        if not package.startswith("@ultrst-armada/") and package != "@dinilmusick/gutts":
            continue
        try:
            contract = discover_contract(root, package)
            if contract:
                validate_contract(contract, package, skipo_version)
                for migration in contract.get("migrations", []):
                    if migration["id"] in applied:
                        for operation in migration.get("verification", []):
                            verify_operation(root, operation)
        except (ValueError, OSError, KeyError, json.JSONDecodeError) as exc:
            errors.append(f"{package}: {exc}")
    return {"ok": not errors, "errors": errors, "paths": plan["paths"]}
