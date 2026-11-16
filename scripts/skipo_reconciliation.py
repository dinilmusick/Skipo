#!/usr/bin/env python3
"""Deterministic dirty-to-clean reconciliation for Skipo applications.

Repairs are limited to registry-owned generated files, explicitly owned
dependencies, explicitly classified retirement paths, and versioned migrations.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import skipo_capabilities as capabilities


def _inside(root: Path, relative: str) -> Path:
    candidate = (root / relative).resolve()
    base = root.resolve()
    if candidate != base and base not in candidate.parents:
        raise ValueError(f"Repair path escapes application root: {relative}")
    return candidate


def _rule(detection: str, remediation: str, verification: str) -> dict[str, str]:
    return {
        "detection": detection,
        "remediation": remediation,
        "verification": verification,
    }


def reconcile(root: Path, apply: bool, framework_version: str) -> dict[str, Any]:
    """Build a complete repair plan, fail closed on ambiguity, then apply and verify."""
    root = root.resolve()
    if not (root / "package.json").is_file():
        return {"ok": False, "operation": "repair", "applied": False,
                "conflicts": [{"message": "Target has no package.json."}], "actions": []}
    if not (root / ".skipo" / "project.json").is_file():
        return {"ok": False, "operation": "repair", "applied": False,
                "conflicts": [{"message": "Project must be explicitly adopted before repair."}], "actions": []}

    registry_data = capabilities.load_registry()
    registry = registry_data["capabilities"]
    findings = capabilities.diagnose(root)
    state = capabilities.capability_state(root)
    installed = state.get("installed", {})
    package = capabilities.package_json(root)
    dependencies = dict(package.get("dependencies", {}))
    dependency_owners = capabilities.read_json(root / ".skipo" / "dependencies.json", {})
    generated = capabilities.generated_entries(state)
    actions: list[dict[str, Any]] = []
    conflicts: list[dict[str, Any]] = []
    writes: dict[Path, str] = {}
    removals: list[Path] = []
    dependency_updates: dict[str, str] = {}
    capability_ids = set(installed)
    capability_ids.update(
        f["capability"] for f in findings
        if f.get("classification") in {"adapt", "retire"} and f.get("capability") in registry
    )

    # Every action carries an observable trigger, deterministic operation and
    # postcondition. No source rewriting or inferred deletion is permitted.
    for cap_id in sorted(capability_ids):
        spec = registry[cap_id]
        for package_name, desired in sorted(spec.get("dependencies", {}).items()):
            current = dependencies.get(package_name)
            if current == desired:
                continue
            if current is not None and dependency_owners.get(package_name) != current:
                conflicts.append({
                    "capability": cap_id, "package": package_name,
                    "message": "Dependency version differs from canonical state but is not owned by Skipo; refusing to overwrite.",
                })
                continue
            actions.append({
                "action": "set-canonical-dependency", "capability": cap_id,
                "package": package_name, "from": current, "to": desired,
                "rule": _rule(
                    f"Installed capability {cap_id} requires {package_name}@{desired}; current value is {current!r}.",
                    "Set package.json dependencies to the registry's exact declared range.",
                    f"package.json and .skipo/dependencies.json both record {package_name}@{desired}.",
                ),
            })
            dependencies[package_name] = desired
            dependency_updates[package_name] = desired

        for item in spec.get("generated", []):
            relative = item["path"]
            path = _inside(root, relative)
            desired = item["content"]
            current = path.read_text(encoding="utf-8") if path.is_file() else None
            previous = generated.get(relative)
            if current == desired:
                continue
            if current is None:
                action = "generate-canonical-component"
            elif previous and previous.get("owner") == "skipo" and previous.get("checksum") == capabilities.sha256_text(current):
                action = "refresh-owned-canonical-component"
            else:
                conflicts.append({
                    "capability": cap_id, "path": relative,
                    "message": "Canonical component path contains unowned or modified application content; refusing to overwrite.",
                })
                continue
            actions.append({
                "action": action, "capability": cap_id, "path": relative,
                "rule": _rule(
                    f"Registry component {relative} is missing or differs from its verified Skipo-owned checksum.",
                    "Write the exact registry content; never synthesize or rewrite application code.",
                    f"File content equals the registry content and its ownership checksum matches.",
                ),
            })
            writes[path] = desired
            generated[relative] = {
                "path": relative, "owner": "skipo", "capability": cap_id,
                "checksum": capabilities.sha256_text(desired),
            }

    for finding in findings:
        if finding.get("classification") != "retire":
            continue
        cap_id, relative = finding["capability"], finding["path"]
        if relative not in registry[cap_id].get("safeRetire", []):
            conflicts.append({"capability": cap_id, "path": relative,
                              "message": "Retirement was not explicitly classified by the canonical registry."})
            continue
        path = _inside(root, relative)
        if not path.exists():
            continue
        if path.is_symlink() or not path.is_file():
            conflicts.append({"capability": cap_id, "path": relative,
                              "message": "Explicit retirement target is not a regular file; refusing recursive or symlink deletion."})
            continue
        actions.append({
            "action": "retire-explicit-duplicate", "capability": cap_id, "path": relative,
            "rule": _rule(
                f"{relative} is explicitly listed in {cap_id}.safeRetire.",
                "Delete only this exact regular file.",
                f"The classified path no longer exists.",
            ),
        })
        removals.append(path)

    manifest = capabilities.project_manifest(root)
    previous_version = manifest.get("skipo_version", "unknown")
    needs_update = capabilities.canonical_version(previous_version) < capabilities.canonical_version(framework_version)
    migration_state = capabilities.read_json(
        root / ".skipo" / "migration-state.json", {"schemaVersion": 1, "applied": [], "pending": []}
    )
    if needs_update:
        migration_data = capabilities.read_json(
            capabilities.ROOT / "architecture" / "capabilities" / "migrations.json", {"migrations": []}
        )
        for migration in migration_data.get("migrations", []):
            if capabilities.canonical_version(previous_version) >= capabilities.canonical_version(migration.get("version", "0")):
                continue
            if migration.get("classification") != "retire":
                conflicts.append({"migration": migration.get("id"),
                                  "message": "Migration has no explicit retire classification; refusing destructive update."})
                continue
            for relative in migration.get("retirePaths", []):
                path = _inside(root, relative)
                if path.exists():
                    actions.append({
                        "action": "retire-versioned-obsolete-path", "migration": migration.get("id"),
                        "path": relative,
                        "rule": _rule(
                            f"Versioned migration {migration.get('id')} explicitly classifies {relative} for retirement.",
                            "Remove only the migration's exact listed path.",
                            f"The retired migration path no longer exists.",
                        ),
                    })
        actions.append({
            "action": "advance-framework-version", "from": previous_version, "to": framework_version,
            "rule": _rule(
                f"Project framework version {previous_version} is older than {framework_version}.",
                "Apply registered deterministic migrations and update the project manifest.",
                f"Project manifest records {framework_version} and all migrations verify cleanly.",
            ),
        })

    if conflicts:
        return {"ok": False, "operation": "repair", "findings": findings,
                "actions": actions, "conflicts": conflicts, "applied": False,
                "verification": {"ok": False, "errors": ["Repair preflight failed; no changes applied."]}}

    if not apply:
        return {"ok": True, "operation": "repair", "findings": findings,
                "actions": actions, "conflicts": [], "applied": False,
                "verification": {"ok": None, "planned": True}}

    # All preconditions are checked before the first write.
    for path, desired in writes.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(desired, encoding="utf-8")
    for path in removals:
        if path.exists():
            path.unlink()
    if dependency_updates:
        package["dependencies"] = dependencies
        (root / "package.json").write_text(
            __import__("json").dumps(package, indent=2) + "\n", encoding="utf-8"
        )
        for package_name, version in dependency_updates.items():
            dependency_owners[package_name] = version
        capabilities.write_json(root / ".skipo" / "dependencies.json", dependency_owners)
    capabilities.write_generated_entries(state, generated)
    capabilities.write_capability_state(root, state)

    update_result = None
    if needs_update:
        update_result = capabilities.update(root, framework_version)

    verification = capabilities.verify(root)
    ok = bool(verification.get("ok"))
    return {
        "ok": ok, "operation": "repair", "findings": findings, "actions": actions,
        "conflicts": [], "applied": True, "update": update_result,
        "verification": verification,
    }
