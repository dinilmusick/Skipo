import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import skipo_migrations as migrations


def project(tmp_path: Path, version: str = "1.0.0") -> Path:
    root = tmp_path / "app"
    (root / ".skipo").mkdir(parents=True)
    (root / ".skipo" / "project.json").write_text(json.dumps({
        "framework": "skipo",
        "skipo_version": version,
    }))
    return root


def test_fresh_upgrade_applies_all_required_catalogue_migrations(tmp_path):
    root = project(tmp_path)
    legacy = root / "src/module-runtime"
    legacy.mkdir(parents=True)
    (legacy / "ModuleHost.ts").write_text("legacy")

    result = migrations.update_project(root, "1.2.0")

    assert result["ok"] is True
    assert result["from_version"] == "1.0.0"
    assert result["to_version"] == "1.2.0"
    assert result["current_state"]["framework_version"] == "1.0.0"
    assert result["target_state"]["framework_version"] == "1.2.0"
    assert result["target_state"]["pending_migrations"] == []
    assert result["unapplied_migrations"] == [
        "1.1.0-capability-composition",
        "1.2.0-resumable-framework-upgrade",
    ]
    assert not legacy.exists()
    state = json.loads((root / ".skipo/migration-state.json").read_text())
    assert state["applied"] == [
        "1.1.0-capability-composition",
        "1.2.0-resumable-framework-upgrade",
    ]
    assert state["pending"] == []
    assert migrations.verify_migration_state(root)["ok"] is True


def test_multi_version_upgrade_preserves_existing_applied_migrations(tmp_path):
    root = project(tmp_path, "1.1.0")
    migrations.initialize_migration_state(root, "1.1.0")
    before = json.loads((root / ".skipo/migration-state.json").read_text())

    result = migrations.update_project(root, "1.2.0")

    after = json.loads((root / ".skipo/migration-state.json").read_text())
    assert result["ok"] is True
    assert before["applied"][0] in after["applied"]
    assert after["applied"] == [
        "1.1.0-capability-composition",
        "1.2.0-resumable-framework-upgrade",
    ]


def test_already_current_update_is_a_noop(tmp_path):
    root = project(tmp_path, "1.2.0")
    migrations.initialize_migration_state(root, "1.2.0")
    state_path = root / ".skipo/migration-state.json"
    manifest_path = root / ".skipo/project.json"
    before = state_path.read_bytes()
    manifest_before = manifest_path.read_bytes()

    result = migrations.update_project(root, "1.2.0")

    assert result["ok"] is True
    assert result["already_current"] is True
    assert result["unapplied_migrations"] == []
    assert result["applied_operations"] == []
    assert state_path.read_bytes() == before
    assert manifest_path.read_bytes() == manifest_before


def test_interrupted_migration_resumes_from_persisted_operation_checkpoint(tmp_path, monkeypatch):
    root = project(tmp_path, "1.0.0")
    (root / "legacy-a").mkdir()
    (root / "legacy-b").mkdir()
    catalogue = root / "catalogue.json"
    catalogue.write_text(json.dumps({
        "schemaVersion": 1,
        "migrations": [{
            "id": "1.1.0-test",
            "version": "1.1.0",
            "retirePaths": ["legacy-a", "legacy-b"],
            "verification": ["both legacy paths are absent"],
        }],
    }))
    monkeypatch.setattr(migrations, "CATALOGUE_PATH", catalogue)
    state_path = root / ".skipo/migration-state.json"
    state_path.write_text(json.dumps({
        "schemaVersion": 2,
        "applied": [],
        "pending": ["1.1.0-test"],
        "migrations": {
            "1.1.0-test": {
                "status": "applying",
                "completedOperations": ["legacy-a"],
            },
        },
    }))
    (root / "legacy-a").rmdir()

    result = migrations.update_project(root, "1.1.0")

    assert result["ok"] is True
    assert result["resumed_migrations"] == ["1.1.0-test"]
    assert not (root / "legacy-a").exists()
    assert not (root / "legacy-b").exists()
    state = json.loads(state_path.read_text())
    assert state["migrations"]["1.1.0-test"]["status"] == "applied"
    assert state["migrations"]["1.1.0-test"]["completedOperations"] == ["legacy-a", "legacy-b"]


def test_repeated_execution_is_idempotent(tmp_path):
    root = project(tmp_path, "1.0.0")
    (root / "legacy").mkdir()
    first = migrations.update_project(root, "1.2.0")
    state_path = root / ".skipo/migration-state.json"
    first_state = json.loads(state_path.read_text())

    second = migrations.update_project(root, "1.2.0")

    assert first["ok"] is True and second["ok"] is True
    assert second["applied_operations"] == []
    assert json.loads(state_path.read_text()) == first_state
    assert second["migration_state"]["applied"] == first_state["applied"]


def test_unknown_applied_migration_fails_without_mutating_project(tmp_path):
    root = project(tmp_path, "1.0.0")
    state_path = root / ".skipo/migration-state.json"
    original = {
        "schemaVersion": 1,
        "applied": ["removed-migration"],
        "pending": [],
    }
    state_path.write_text(json.dumps(original))
    manifest_path = root / ".skipo/project.json"
    manifest_before = manifest_path.read_bytes()
    state_before = state_path.read_bytes()

    with pytest.raises(migrations.MigrationStateError, match="unknown migrations"):
        migrations.update_project(root, "1.2.0")

    assert manifest_path.read_bytes() == manifest_before
    assert state_path.read_bytes() == state_before


def test_downgrade_and_malformed_state_fail_safely(tmp_path):
    root = project(tmp_path, "1.2.0")
    migrations.initialize_migration_state(root, "1.2.0")
    with pytest.raises(migrations.MigrationStateError, match="downgrade"):
        migrations.update_project(root, "1.1.0")

    state_path = root / ".skipo/migration-state.json"
    state_path.write_text("{broken")
    with pytest.raises(migrations.MigrationStateError, match="Cannot read migration state"):
        migrations.update_project(root, "1.2.0")


def test_committed_migration_with_old_manifest_is_recovered(tmp_path, monkeypatch):
    root = project(tmp_path, "1.0.0")
    manifest_path = root / ".skipo/project.json"
    original_write = migrations.atomic_write_json
    interrupted = {"value": False}

    def fail_once_on_manifest(path, value):
        if path == manifest_path and not interrupted["value"]:
            interrupted["value"] = True
            raise OSError("simulated interruption before manifest version commit")
        return original_write(path, value)

    monkeypatch.setattr(migrations, "atomic_write_json", fail_once_on_manifest)
    with pytest.raises(OSError, match="simulated interruption"):
        migrations.update_project(root, "1.2.0")

    state = json.loads((root / ".skipo/migration-state.json").read_text())
    assert "1.2.0-resumable-framework-upgrade" in state["applied"]
    assert json.loads(manifest_path.read_text())["skipo_version"] == "1.0.0"
    assert migrations.verify_migration_state(root)["ok"] is False

    monkeypatch.setattr(migrations, "atomic_write_json", original_write)
    resumed = migrations.update_project(root, "1.2.0")

    assert resumed["ok"] is True
    assert json.loads(manifest_path.read_text())["skipo_version"] == "1.2.0"
    assert migrations.verify_migration_state(root)["ok"] is True

def test_legacy_manifest_is_upgraded_without_manual_initialization(tmp_path):
    root = tmp_path / "legacy-aiko"
    (root / ".skipo").mkdir(parents=True)
    original = {
        "kind": "skipo-application",
        "schemaVersion": 1,
        "deploymentTargets": {"api": {"platform": "cloudflare-workers"}},
        "requiredEnvironment": {"serverOnly": ["SKIPO_DATABASE_URL"]},
    }
    (root / ".skipo/project.json").write_text(json.dumps(original))
    (root / "package.json").write_text(json.dumps({"name": "aiko", "skipo": {"deploy": "fullstack"}}))
    before = (root / ".skipo/project.json").read_bytes()
    planned = migrations.plan_upgrade(root, "1.1.0")
    assert planned["ok"] is True
    assert (root / ".skipo/project.json").read_bytes() == before
    assert not (root / ".skipo/migration-state.json").exists()

    upgraded = migrations.update_project(root, "1.1.0")
    assert upgraded["ok"] is True
    saved = json.loads((root / ".skipo/project.json").read_text())
    assert all(saved[key] == value for key, value in original.items())
    assert saved["framework"] == "skipo"
    assert saved["skipo_version"] == "1.1.0"
    assert migrations.verify_migration_state(root)["ok"] is True
    second = migrations.update_project(root, "1.1.0")
    assert second["already_current"] is True
    assert second["applied_operations"] == []


def test_marker_only_legacy_app_is_upgradeable(tmp_path):
    root = tmp_path / "legacy-kone"
    root.mkdir()
    (root / "package.json").write_text(json.dumps({"name": "kone", "skipo": {"deploy": "fullstack"}}))
    result = migrations.update_project(root, "1.1.0")
    assert result["ok"] is True
    manifest = json.loads((root / ".skipo/project.json").read_text())
    assert manifest["scaffold"] == "adopted"
    assert manifest["skipo_version"] == "1.1.0"
    assert migrations.verify_migration_state(root)["ok"] is True


def test_implicit_upgrade_rejects_non_skipo_without_writes(tmp_path):
    root = tmp_path / "unrelated"
    root.mkdir()
    (root / "package.json").write_text(json.dumps({"name": "not-skipo"}))
    with pytest.raises(migrations.MigrationStateError, match="not an adopted Skipo project"):
        migrations.update_project(root, "1.1.0")
    assert not (root / ".skipo").exists()


def test_legacy_app_full_maintenance_update_and_repeat_are_clean(tmp_path):
    import skipo_maintenance as maintenance

    root = tmp_path / "legacy-srkl"
    root.mkdir()
    (root / "package.json").write_text(json.dumps({
        "name": "srkl-engine", "version": "0.1.0",
        "skipo": {"deploy": "fullstack"}, "dependencies": {},
    }))
    # The real apps use npm lockfiles; a deterministic stub suffices because
    # this test isolates Skipo's own state reconciliation from npm resolution.
    (root / "package-lock.json").write_text("{}")
    (root / ".env.example").write_text("SYSTEM_DATABASE_URL=postgres://example\n")
    environment = {"node": "v22.16.0", "npm": "10.5.0", "pnpm": None, "yarn": None}
    first_plan = maintenance.build_plan(root, "1.1.0", environment=environment, git_status="")
    assert first_plan["ok"], first_plan["errors"]
    assert not (root / ".skipo/project.json").exists()
    first = maintenance.execute_plan(
        root, first_plan, "1.1.0",
        lockfile_sync=lambda _root, _pkg: {"ok": True},
    )
    assert first["ok"], first["errors"]
    assert maintenance.verify(root, "1.1.0")["ok"]
    second_plan = maintenance.build_plan(root, "1.1.0", environment=environment, git_status="")
    assert second_plan["ok"], second_plan["errors"]
    assert second_plan["pending_migrations"] == []
    assert not any(action["action"] == "framework" for action in second_plan["actions"])
    second = maintenance.execute_plan(
        root, second_plan, "1.1.0",
        lockfile_sync=lambda _root, _pkg: {"ok": True},
    )
    assert second["ok"], second["errors"]
