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
    before = state_path.read_bytes()

    result = migrations.update_project(root, "1.2.0")

    assert result["ok"] is True
    assert result["unapplied_migrations"] == []
    assert result["applied_operations"] == []
    assert state_path.read_bytes() == before


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
