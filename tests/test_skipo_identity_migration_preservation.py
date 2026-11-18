"""Regression proof: framework upgrades never change registered application identity.

The Skipo framework can maintain an application, but application registration,
OAuth client enrollment, and deployment verification belong to their trusted
registrars. Treat existing enrollment values as opaque during framework updates.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import skipo_migrations as migrations


def application(tmp_path: Path, *, registered: bool = True) -> tuple[Path, dict]:
    target = tmp_path / "app"
    (target / ".skipo").mkdir(parents=True)
    (target / "package.json").write_text('{"name":"skipo-identity-fixture"}\n')
    manifest = {
        "framework": "skipo",
        "scaffold": "vite",
        "skipo_version": "1.0.0",
        "generated_by": "skipo",
    }
    if registered:
        manifest.update({
            "app_id": "registered-application",
            "oauth_clients": [{"client_id": "registered-web-client", "verified": True}],
            "deployments": [{
                "deployment_id": "verified-deployment",
                "origin": "https://first.example",
                "ownership_verified": True,
            }],
            "identity_schema_version": 1,
        })
    (target / ".skipo" / "project.json").write_text(json.dumps(manifest, indent=2) + "\n")
    (target / ".env").write_text("APP_URL=https://first.example\n")
    return target, manifest


def test_upgrade_plan_cannot_mutate_registered_identity(tmp_path: Path):
    target, original = application(tmp_path)
    manifest_path = target / ".skipo" / "project.json"
    before_manifest = manifest_path.read_bytes()
    before_env = (target / ".env").read_bytes()

    plan = migrations.plan_upgrade(target, "1.3.0")

    assert plan["ok"] is True
    assert manifest_path.read_bytes() == before_manifest
    assert (target / ".env").read_bytes() == before_env
    assert json.loads(manifest_path.read_text())["app_id"] == original["app_id"]
    assert not (target / ".skipo" / "migration-state.json").exists()


def test_upgrading_preserves_enrolled_app_client_and_deployment(tmp_path: Path):
    target, original = application(tmp_path)

    upgrade = migrations.update_project(target, "1.3.0")

    assert upgrade["ok"] is True
    updated = json.loads((target / ".skipo" / "project.json").read_text())
    for field in ("app_id", "oauth_clients", "deployments", "identity_schema_version"):
        assert updated[field] == original[field], f"Skipo must not rewrite registered {field}"
    assert updated["skipo_version"] == "1.3.0"
    assert (target / ".env").read_text() == "APP_URL=https://first.example\n"
    assert migrations.verify_migration_state(target)["ok"] is True


def test_origin_move_and_repeated_upgrade_do_not_rotate_identity(tmp_path: Path):
    target, _ = application(tmp_path)
    assert migrations.update_project(target, "1.3.0")["ok"] is True
    project_path = target / ".skipo" / "project.json"
    ledger_path = target / ".skipo" / "migration-state.json"
    before_project, before_ledger = project_path.read_bytes(), ledger_path.read_bytes()

    (target / ".env").write_text("APP_URL=https://new.example\n")
    again = migrations.update_project(target, "1.3.0")

    assert again["ok"] is True
    assert again["already_current"] is True
    assert project_path.read_bytes() == before_project
    assert ledger_path.read_bytes() == before_ledger
    assert json.loads(project_path.read_text())["app_id"] == "registered-application"


def test_upgrade_does_not_mint_trusted_identity_for_unenrolled_app(tmp_path: Path):
    target, _ = application(tmp_path, registered=False)

    result = migrations.update_project(target, "1.3.0")

    assert result["ok"] is True
    manifest = json.loads((target / ".skipo" / "project.json").read_text())
    assert "app_id" not in manifest
    assert "oauth_clients" not in manifest
    assert "deployments" not in manifest


def test_invalid_identity_manifest_fails_without_minting_or_repairing(tmp_path: Path):
    target, _ = application(tmp_path)
    project_path = target / ".skipo" / "project.json"
    project_path.write_text('{"framework":"skipo","skipo_version":"not-a-version","app_id":"registered"}\n')
    original = project_path.read_bytes()

    with pytest.raises(migrations.MigrationStateError):
        migrations.update_project(target, "1.3.0")

    assert project_path.read_bytes() == original
    assert not (target / ".skipo" / "migration-state.json").exists()
