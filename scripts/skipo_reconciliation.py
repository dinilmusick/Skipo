#!/usr/bin/env python3
"""Deterministic dirty-to-clean reconciliation for Skipo applications.

Only registry-owned outputs, explicitly owned dependencies, exact safe-retirement
entries, and versioned migration paths may be changed automatically.
"""
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path
from typing import Any

import skipo_capabilities as capabilities


def _inside(root: Path, relative: str) -> Path:
    rel = Path(relative)
    if rel.is_absolute() or ".." in rel.parts:
        raise ValueError(f"Repair path is not a safe relative path: {relative}")
    candidate = root / rel
    base = root.resolve()
    current = root
    for part in rel.parts:
        current = current / part
        if current.is_symlink():
            raise ValueError(f"Repair path contains a symlink: {relative}")
    resolved = candidate.resolve(strict=False)
    if resolved != base and base not in resolved.parents:
        raise ValueError(f"Repair path escapes application root: {relative}")
    return candidate


def _rule(detection: str, remediation: str, verification: str) -> dict[str, str]:
    return {"detection": detection, "remediation": remediation, "verification": verification}


def _state_findings(root: Path, registry: dict[str, Any], installed: dict[str, Any],
                    dependencies: dict[str, str], dependency_owners: dict[str, str],
                    generated: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for cap_id in sorted(installed):
        spec = registry.get(cap_id)
        if not spec:
            findings.append({"type": "unknown-capability", "capability": cap_id,
                             "classification": "keep", "message": "Installed capability is absent from canonical registry."})
            continue
        for package, expected in sorted(spec.get("dependencies", {}).items()):
            current = dependencies.get(package)
            if current != expected:
                findings.append({
                    "type": "dependency-drift", "capability": cap_id, "package": package,
                    "current": current, "expected": expected,
                    "classification": "adapt" if current is None or dependency_owners.get(package) == current else "keep",
                })
        for item in spec.get("generated", []):
            path = _inside(root, item["path"])
            current = path.read_text(encoding="utf-8") if path.is_file() else None
            if current != item["content"]:
                findings.append({
                    "type": "canonical-component-drift", "capability": cap_id, "path": item["path"],
                    "classification": "adapt" if current is None or (
                        generated.get(item["path"], {}).get("owner") == "skipo"
                        and generated.get(item["path"], {}).get("checksum") == capabilities.sha256_text(current)
                    ) else "keep",
                })

    # Legacy imports are detected but never rewritten without an explicit,
    # versioned import mapping in the migration contract.
    migration_data = capabilities.read_json(
        capabilities.ROOT / "architecture" / "capabilities" / "migrations.json", {"migrations": []}
    )
    legacy_tokens = sorted({
        token
        for migration in migration_data.get("migrations", [])
        for path in migration.get("retirePaths", [])
        for token in ({Path(path).name, Path(path).stem} if Path(path).suffix else {Path(path).name})
    })
    token_pattern = re.compile(r"""(?:from|import)\s*['"]([^'"]+)['"]""", re.I)
    for path, source in capabilities.scan_text_files(root):
        for match in token_pattern.finditer(source):
            imported = match.group(1)
            if any(token in imported for token in legacy_tokens):
                findings.append({
                    "type": "stale-import", "path": path.relative_to(root).as_posix(),
                    "import": imported, "classification": "keep",
                    "message": "No explicit deterministic import mapping exists for this legacy module.",
                })
    return findings


def reconcile(root: Path, apply: bool, framework_version: str) -> dict[str, Any]:
    """Plan all repairs first; apply only after every precondition passes."""
    root = root.resolve()
    if not (root / "package.json").is_file():
        return {"ok": False, "operation": "repair", "applied": False, "actions": [],
                "conflicts": [{"message": "Target has no package.json."}]}
    if not (root / ".skipo" / "project.json").is_file():
        return {"ok": False, "operation": "repair", "applied": False, "actions": [],
                "conflicts": [{"message": "Project must be explicitly adopted before repair."}]}

    registry = capabilities.load_registry()["capabilities"]
    findings = capabilities.diagnose(root)
    state = capabilities.read_json(root / ".skipo" / "capabilities.json",
                                   {"schemaVersion": 1, "installed": {}, "generated": []})
    installed = dict(state.get("installed", {}))
    package = capabilities.package_json(root)
    dependencies = dict(package.get("dependencies", {}))
    dependency_owners = capabilities.read_json(root / ".skipo" / "dependencies.json", {})
    generated = capabilities.generated_entries(state)
    findings.extend(_state_findings(root, registry, installed, dependencies, dependency_owners, generated))

    actions: list[dict[str, Any]] = []
    conflicts: list[dict[str, Any]] = []
    writes: dict[Path, str] = {}
    file_removals: set[Path] = set()
    migration_removals: set[Path] = set()
    dependency_updates: dict[str, str] = {}
    original_generated = dict(generated)
    original_installed = dict(installed)
    original_dependency_owners = dict(dependency_owners)

    capability_ids = set(installed)
    capability_ids.update(
        item["capability"] for item in findings
        if item.get("classification") in {"adapt", "retire"} and item.get("capability") in registry
    )

    for finding in findings:
        if finding.get("type") == "unknown-capability":
            conflicts.append({"capability": finding.get("capability"), "message": finding["message"]})
        elif finding.get("type") == "stale-import":
            conflicts.append({"path": finding["path"], "import": finding["import"], "message": finding["message"]})

    for cap_id in sorted(capability_ids):
        spec = registry[cap_id]
        installed[cap_id] = {
            "kind": spec["kind"], "description": spec["description"], "providers": spec["providers"]
        }
        for package_name, desired in sorted(spec.get("dependencies", {}).items()):
            current = dependencies.get(package_name)
            if current != desired:
                if current is not None and dependency_owners.get(package_name) != current:
                    conflicts.append({
                        "capability": cap_id, "package": package_name,
                        "message": "Dependency differs from canonical state and is not Skipo-owned; refusing to overwrite.",
                    })
                    continue
                actions.append({
                    "action": "set-canonical-dependency", "capability": cap_id,
                    "package": package_name, "from": current, "to": desired,
                    "rule": _rule(
                        f"Installed capability {cap_id} requires {package_name}@{desired}; current value is {current!r}.",
                        "Set package.json dependencies to the registry's exact declared range.",
                        f"package.json and .skipo/dependencies.json record {package_name}@{desired}.",
                    ),
                })
                dependencies[package_name] = desired
                dependency_updates[package_name] = desired
            dependency_owners[package_name] = desired

        for item in spec.get("generated", []):
            relative = item["path"]
            path = _inside(root, relative)
            desired = item["content"]
            if path.is_symlink():
                conflicts.append({"capability": cap_id, "path": relative, "message": "Canonical component is a symlink."})
                continue
            current = path.read_text(encoding="utf-8") if path.is_file() else None
            if current == desired:
                generated[relative] = {
                    "path": relative, "owner": "skipo", "capability": cap_id,
                    "checksum": capabilities.sha256_text(desired),
                }
                continue
            previous = generated.get(relative)
            if current is None:
                action = "generate-canonical-component"
            elif previous and previous.get("owner") == "skipo" and previous.get("checksum") == capabilities.sha256_text(current):
                action = "refresh-owned-canonical-component"
            else:
                conflicts.append({
                    "capability": cap_id, "path": relative,
                    "message": "Canonical path contains unowned or modified application content; refusing to overwrite.",
                })
                continue
            actions.append({
                "action": action, "capability": cap_id, "path": relative,
                "rule": _rule(
                    f"Registry component {relative} is missing or differs from its last verified Skipo-owned checksum.",
                    "Write the exact registry content; do not synthesize or rewrite application code.",
                    "File content equals registry content and its ownership checksum matches.",
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
        cap_id, relative = finding.get("capability"), finding.get("path")
        if cap_id not in registry or relative not in registry[cap_id].get("safeRetire", []):
            conflicts.append({"capability": cap_id, "path": relative,
                              "message": "Retirement is not explicitly classified by the canonical registry."})
            continue
        path = _inside(root, relative)
        if not path.exists():
            continue
        if path.is_symlink() or not path.is_file():
            conflicts.append({"capability": cap_id, "path": relative,
                              "message": "Safe-retirement target must be a regular file, not a symlink or directory."})
            continue
        file_removals.add(path)
        actions.append({
            "action": "retire-explicit-duplicate", "capability": cap_id, "path": relative,
            "rule": _rule(
                f"{relative} is explicitly listed in {cap_id}.safeRetire.",
                "Delete only this exact regular file.",
                "The classified path no longer exists.",
            ),
        })

    manifest = capabilities.project_manifest(root)
    previous_version = manifest.get("skipo_version", "unknown")
    needs_update = capabilities.canonical_version(previous_version) < capabilities.canonical_version(framework_version)
    migration_state = capabilities.read_json(
        root / ".skipo" / "migration-state.json", {"schemaVersion": 1, "applied": [], "pending": []}
    )
    if needs_update:
        migrations = capabilities.read_json(
            capabilities.ROOT / "architecture" / "capabilities" / "migrations.json", {"migrations": []}
        ).get("migrations", [])
        for migration in migrations:
            migration_version = migration.get("version", "0")
            if (capabilities.canonical_version(previous_version) >= capabilities.canonical_version(migration_version)
                    or capabilities.canonical_version(framework_version) < capabilities.canonical_version(migration_version)
                    or migration.get("id") in migration_state.get("applied", [])):
                continue
            retire_paths = migration.get("retirePaths", [])
            if retire_paths and migration.get("classification") != "retire":
                conflicts.append({"migration": migration.get("id"),
                                  "message": "Destructive migration paths lack explicit retire classification."})
                continue
            for relative in retire_paths:
                path = _inside(root, relative)
                if not path.exists():
                    continue
                if path.is_symlink() or not (path.is_file() or path.is_dir()):
                    conflicts.append({"migration": migration.get("id"), "path": relative,
                                      "message": "Migration target is not a regular file or directory."})
                    continue
                migration_removals.add(path)
                actions.append({
                    "action": "retire-versioned-obsolete-path", "migration": migration.get("id"),
                    "path": relative,
                    "rule": _rule(
                        f"Migration {migration.get('id')} explicitly classifies {relative} for retirement.",
                        "Remove only the exact migration-listed path.",
                        "The retired migration path no longer exists.",
                    ),
                })
            actions.append({
                "action": "apply-versioned-migration", "migration": migration.get("id"),
                "version": migration_version,
                "rule": _rule(
                    f"Project version {previous_version} precedes migration {migration.get('id')}.",
                    "Apply only the deterministic operations listed by this migration.",
                    f"Migration {migration.get('id')} is recorded as applied and all its paths are absent.",
                ),
            })
        actions.append({
            "action": "advance-framework-version", "from": previous_version, "to": framework_version,
            "rule": _rule(
                f"Project framework version {previous_version} is older than {framework_version}.",
                "Persist the framework version after registered migrations complete.",
                f".skipo/project.json records {framework_version}.",
            ),
        })

    if conflicts:
        return {"ok": False, "operation": "repair", "findings": findings, "actions": actions,
                "conflicts": conflicts, "applied": False,
                "verification": {"ok": False, "errors": ["Repair preflight failed; no changes applied."]}}

    if not apply:
        return {"ok": True, "operation": "repair", "findings": findings, "actions": actions,
                "conflicts": [], "applied": False, "verification": {"ok": None, "planned": True}}

    for path, desired in writes.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(desired, encoding="utf-8")
    for path in sorted(file_removals, key=str):
        if path.exists():
            path.unlink()
    for path in sorted(migration_removals, key=lambda item: len(item.parts), reverse=True):
        if not path.exists():
            continue
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()

    if dependency_updates:
        package["dependencies"] = dependencies
        (root / "package.json").write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")
    if dependency_owners != original_dependency_owners:
        capabilities.write_json(root / ".skipo" / "dependencies.json", dependency_owners)
    if generated != original_generated or installed != original_installed:
        capabilities.write_generated_entries(state, generated)
        capabilities.write_capability_state(root, state)

    update_result = None
    if needs_update:
        migration_ids = [
            action["migration"] for action in actions
            if action.get("action") == "apply-versioned-migration"
        ]
        applied = list(migration_state.get("applied", []))
        for migration_id in migration_ids:
            if migration_id not in applied:
                applied.append(migration_id)
        migration_state["applied"] = applied
        migration_state["pending"] = []
        manifest.update({
            "framework": "skipo", "skipo_version": framework_version,
            "updated_by": "skipo", "migration_policy": "deterministic",
        })
        (root / ".skipo" / "project.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        capabilities.write_json(root / ".skipo" / "migration-state.json", migration_state)
        update_result = {
            "ok": True, "from_version": previous_version, "to_version": framework_version,
            "applied_migrations": migration_ids, "migration_state": migration_state,
        }

    verification = capabilities.verify(root)
    return {
        "ok": bool(verification.get("ok")), "operation": "repair",
        "findings": findings, "actions": actions, "conflicts": [],
        "applied": bool(actions), "synchronized": sorted(set(dependency_updates) | set(dependency_owners)),
        "update": update_result, "verification": verification,
    }
