#!/usr/bin/env python3
"""Deterministic Skipo capability resolver, composer, drift detector and verifier."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "architecture" / "capabilities" / "registry.json"

def load_registry() -> dict[str, Any]:
    return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))

def read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default
    except Exception:
        return default

def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")

def project_manifest(root: Path) -> dict[str, Any]:
    return read_json(root / ".skipo" / "project.json", {})

def package_json(root: Path) -> dict[str, Any]:
    return read_json(root / "package.json", {})

def canonical_version(value: str) -> tuple[int, ...]:
    match = re.search(r"(\d+(?:\.\d+){0,2})", value or "")
    return tuple(int(x) for x in match.group(1).split(".")) if match else (0,)

def ensure_state(root: Path) -> None:
    state = root / ".skipo"
    state.mkdir(parents=True, exist_ok=True)
    defaults = {
        "dependencies.json": {},
        "capabilities.json": {"schemaVersion": 1, "installed": {}, "generated": []},
        "overrides.json": {"schemaVersion": 1, "capabilities": {}},
        "migration-state.json": {"schemaVersion": 1, "applied": [], "pending": []},
    }
    for name, value in defaults.items():
        path = state / name
        if not path.exists():
            write_json(path, value)

def capability_state(root: Path) -> dict[str, Any]:
    ensure_state(root)
    return read_json(root / ".skipo" / "capabilities.json", {"schemaVersion": 1, "installed": {}, "generated": []})

def write_capability_state(root: Path, state: dict[str, Any]) -> None:
    write_json(root / ".skipo" / "capabilities.json", state)

def dependency_state(root: Path) -> dict[str, Any]:
    ensure_state(root)
    return read_json(root / ".skipo" / "dependencies.json", {})

def project_name(root: Path) -> str:
    pkg = package_json(root)
    return pkg.get("name") or root.name

def ensure_project(root: Path) -> None:
    ensure_state(root)
    path = root / ".skipo" / "project.json"
    data = project_manifest(root)
    if not data:
        data = {"framework": "skipo", "scaffold": "adopted", "skipo_version": "unknown", "generated_by": "skipo"}
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

def scan_text_files(root: Path):
    skip = {".git", "node_modules", "dist", ".next", ".turbo", ".skipo"}
    for base in ("src", "app", "pages", "components", "lib", "server", "scripts"):
        start = root / base
        if not start.exists():
            continue
        for path in start.rglob("*"):
            if not path.is_file() or any(part in skip for part in path.parts):
                continue
            if path.suffix.lower() not in {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py"}:
                continue
            try:
                yield path, path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue

def canonical_import_present(text: str, package: str) -> bool:
    return package in text

def diagnose(root: Path) -> list[dict[str, Any]]:
    registry = load_registry()["capabilities"]
    files = list(scan_text_files(root))
    findings: list[dict[str, Any]] = []
    for cap_id, spec in registry.items():
        for path, text in files:
            matched = [pattern for pattern in spec.get("duplicatePatterns", []) if re.search(pattern, text, re.I)]
            if not matched:
                continue
            canonical = any(canonical_import_present(text, p["package"]) for p in spec.get("providers", []))
            classification = "adapt" if canonical else "retire"
            findings.append({
                "capability": cap_id,
                "classification": classification,
                "path": path.relative_to(root).as_posix(),
                "patterns": matched,
                "canonical_import_present": canonical,
            })
    return findings

def normalize_items(items: list[str]) -> list[str]:
    if not items:
        raise ValueError("No capability supplied.")
    if items[0] in {"capability", "service", "ui"}:
        if len(items) != 2:
            raise ValueError(f"{items[0]} requires exactly one capability id.")
        return [items[1]]
    return items

def resolve_capabilities(items: list[str]) -> list[tuple[str, dict[str, Any]]]:
    registry = load_registry()["capabilities"]
    resolved = []
    for item in normalize_items(items):
        if item not in registry:
            raise ValueError(f"Unknown capability '{item}'. Available: {', '.join(sorted(registry))}")
        resolved.append((item, registry[item]))
    return resolved

def compose(root: Path, items: list[str], apply: bool = True) -> dict[str, Any]:
    ensure_project(root)
    resolved = resolve_capabilities(items)
    pkg_path = root / "package.json"
    pkg = package_json(root)
    if not pkg:
        raise ValueError("Target has no package.json.")
    deps = pkg.setdefault("dependencies", {})
    state = capability_state(root)
    generated = set(state.get("generated", []))
    installed = dict(state.get("installed", {}))
    actions = []
    for cap_id, spec in resolved:
        for package, version in spec.get("dependencies", {}).items():
            current = deps.get(package)
            if current != version:
                actions.append({"action": "dependency", "capability": cap_id, "package": package, "from": current, "to": version})
                if apply:
                    deps[package] = version
        for item in spec.get("generated", []):
            path = root / item["path"]
            desired = item["content"]
            current = path.read_text(encoding="utf-8") if path.exists() else None
            if current != desired:
                actions.append({"action": "generate", "capability": cap_id, "path": item["path"]})
                if apply:
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text(desired, encoding="utf-8")
            generated.add(item["path"])
        installed[cap_id] = {
            "kind": spec["kind"],
            "description": spec["description"],
            "providers": spec["providers"],
        }
    if apply:
        pkg_path.write_text(json.dumps(pkg, indent=2) + "\n", encoding="utf-8")
        state["installed"] = installed
        state["generated"] = sorted(generated)
        write_capability_state(root, state)
        deps_state = dependency_state(root)
        for package, version in pkg.get("dependencies", {}).items():
            if package.startswith("@ultrst-armada/") or package == "@dinilmusick/gutts":
                deps_state[package] = version
        write_json(root / ".skipo" / "dependencies.json", deps_state)
    return {"ok": True, "operation": "compose", "capabilities": [x[0] for x in resolved], "actions": actions, "applied": apply}

def remove(root: Path, items: list[str], apply: bool = True) -> dict[str, Any]:
    registry = load_registry()["capabilities"]
    resolved = resolve_capabilities(items)
    state = capability_state(root)
    actions = []
    for cap_id, spec in resolved:
        for item in spec.get("generated", []):
            path = root / item["path"]
            if path.exists():
                actions.append({"action": "delete-generated", "capability": cap_id, "path": item["path"]})
                if apply:
                    path.unlink()
        state.get("installed", {}).pop(cap_id, None)
        for item in spec.get("generated", []):
            state["generated"] = [p for p in state.get("generated", []) if p != item["path"]]
    if apply:
        write_capability_state(root, state)
    return {"ok": True, "operation": "remove", "capabilities": [x[0] for x in resolved], "actions": actions, "applied": apply}

def retire_known_duplicates(root: Path, findings: list[dict[str, Any]], apply: bool) -> list[dict[str, Any]]:
    registry = load_registry()["capabilities"]
    actions = []
    for finding in findings:
        if finding["classification"] != "retire":
            continue
        spec = registry[finding["capability"]]
        path = finding["path"]
        if path not in spec.get("safeRetire", []):
            continue
        absolute = root / path
        if not absolute.exists():
            continue
        action = {"action": "retire-duplicate", "capability": finding["capability"], "path": path}
        actions.append(action)
        if apply:
            absolute.unlink()
    return actions

def plan(root: Path) -> dict[str, Any]:
    findings = diagnose(root)
    return {
        "ok": True,
        "operation": "plan",
        "findings": findings,
        "retirement_actions": retire_known_duplicates(root, findings, False),
        "canonical_capabilities": sorted(capability_state(root).get("installed", {}).keys()),
    }

def adopt(root: Path) -> dict[str, Any]:
    ensure_project(root)
    ensure_state(root)
    findings = diagnose(root)
    caps = capability_state(root)
    return {
        "ok": True,
        "operation": "adopt",
        "project": project_name(root),
        "findings": findings,
        "capabilities": caps,
    }

def sync(root: Path, install: bool = False) -> dict[str, Any]:
    state = capability_state(root)
    capabilities = sorted(state.get("installed", {}).keys())
    result = compose(root, capabilities, apply=True) if capabilities else {"ok": True, "operation": "sync", "actions": [], "applied": True}
    result["operation"] = "sync"
    if install:
        result["install"] = install_dependencies(root)
    return result

def install_dependencies(root: Path) -> dict[str, Any]:
    if not (root / "package.json").exists():
        return {"ok": False, "error": "package.json missing"}
    if (root / "pnpm-lock.yaml").exists():
        command = ["pnpm", "install", "--frozen-lockfile=false"]
    elif (root / "yarn.lock").exists():
        command = ["yarn", "install"]
    else:
        command = ["npm", "install"]
    completed = subprocess.run(command, cwd=root)
    return {"ok": completed.returncode == 0, "command": command, "returncode": completed.returncode}

def update(root: Path, framework_version: str) -> dict[str, Any]:
    ensure_project(root)
    manifest_path = root / ".skipo" / "project.json"
    manifest = project_manifest(root)
    previous = manifest.get("skipo_version", "unknown")
    findings = diagnose(root)
    applied_migrations = list(read_json(root / ".skipo" / "migration-state.json", {"applied": []}).get("applied", []))
    legacy_module_markers = [p for p in ["src/modules", "src/module-contract", "src/module-runtime"] if (root / p).exists()]
    migration_id = "1.1.0-capability-composition"
    actions = []
    if legacy_module_markers:
        actions.append({"action": "legacy-module-detected", "paths": legacy_module_markers, "migration": migration_id})
    manifest.update({"framework": "skipo", "skipo_version": framework_version, "updated_by": "skipo"})
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    migration_state = read_json(root / ".skipo" / "migration-state.json", {"schemaVersion": 1, "applied": [], "pending": []})
    if migration_id not in applied_migrations:
        migration_state["applied"].append(migration_id)
    migration_state["pending"] = sorted({f["capability"] for f in findings if f["classification"] == "retire"})
    write_json(root / ".skipo" / "migration-state.json", migration_state)
    return {"ok": True, "operation": "update", "from_version": previous, "to_version": framework_version, "actions": actions, "findings": findings}

def repair(root: Path, apply: bool, framework_version: str) -> dict[str, Any]:
    findings = diagnose(root)
    retired = retire_known_duplicates(root, findings, apply)
    caps = sorted({f["capability"] for f in findings if f["classification"] in {"adapt", "retire"}})
    composed = compose(root, caps, apply=apply) if caps else {"ok": True, "actions": [], "applied": apply}
    updated = update(root, framework_version) if apply else {"ok": True, "operation": "update", "planned": True}
    return {"ok": True, "operation": "repair", "findings": findings, "retired": retired, "composition": composed, "update": updated, "applied": apply}

def verify(root: Path) -> dict[str, Any]:
    findings = diagnose(root)
    state = capability_state(root)
    errors = []
    for cap_id, installed in state.get("installed", {}).items():
        if cap_id not in load_registry()["capabilities"]:
            errors.append(f"Unknown installed capability: {cap_id}")
    for finding in findings:
        if finding["classification"] == "retire":
            cap_id = finding["capability"]
            if finding["path"] not in load_registry()["capabilities"][cap_id].get("safeRetire", []):
                errors.append(f"Unresolved duplicate for {cap_id}: {finding['path']}")
    return {"ok": not errors, "operation": "verify", "errors": errors, "findings": findings, "capabilities": sorted(state.get("installed", {}).keys())}
