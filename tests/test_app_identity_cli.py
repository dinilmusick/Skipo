import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from skipo_app_identity import ensure_app_identity, inspect_app_identity


def make_project(root: Path, extra=None):
    manifest_dir = root / ".skipo"
    manifest_dir.mkdir(parents=True)
    manifest = {"framework": "skipo", "scaffold": "vite", **(extra or {})}
    (manifest_dir / "project.json").write_text(json.dumps(manifest), encoding="utf-8")
    return manifest_dir / "project.json"


def test_identity_is_persisted_and_repairs_are_idempotent(tmp_path):
    manifest_path = make_project(tmp_path)
    first = ensure_app_identity(tmp_path)
    second = ensure_app_identity(tmp_path)
    stored = json.loads(manifest_path.read_text(encoding="utf-8"))
    generated = (tmp_path / "src/backend/ecosystem/appIdentity_Pure.ts").read_text(encoding="utf-8")

    assert first["app_id"] == second["app_id"] == stored["app_id"]
    assert first["registration_status"] == "pending_enrollment"
    enrollment = json.loads((tmp_path / ".skipo/enrollment-request.json").read_text(encoding="utf-8"))
    assert enrollment["app_id"] == first["app_id"]
    assert enrollment["requires_ecosystem_admin_approval"] is True
    assert generated.count(first["app_id"]) == 1
    assert "WORKSPACE_APP_ID: appId" in generated


def test_url_changes_do_not_change_permanent_app_identity(tmp_path):
    manifest_path = make_project(tmp_path, {"app_url": "https://first.example"})
    first = ensure_app_identity(tmp_path)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["app_url"] = "https://second.example"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    second = ensure_app_identity(tmp_path)
    assert second["app_id"] == first["app_id"]


def test_existing_approved_identity_is_preserved(tmp_path):
    manifest_path = make_project(tmp_path, {
        "app_id": "aiko",
        "app_identity": {"app_id": "aiko", "registration_status": "approved", "approval_reference": "registry:apps/aiko"},
    })
    result = ensure_app_identity(tmp_path)
    stored = json.loads(manifest_path.read_text(encoding="utf-8"))

    assert result == {"app_id": "aiko", "registration_status": "approved", "enrollment_request": None}
    assert stored["app_identity"]["registration_status"] == "approved"
    report = inspect_app_identity(tmp_path)
    assert report["ok"] is True
    assert report["registry_trust_verified"] is False


def test_invalid_existing_identity_is_never_silently_replaced(tmp_path):
    make_project(tmp_path, {"app_id": "https://app.example"})
    try:
        ensure_app_identity(tmp_path)
    except ValueError as exc:
        assert "invalid" in str(exc)
    else:
        raise AssertionError("invalid permanent app identity must be rejected")
