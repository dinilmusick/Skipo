import json
import sys
import importlib.util
import uuid
from types import SimpleNamespace
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from skipo_app_identity import ensure_app_identity, inspect_app_identity


def make_project(root: Path, extra=None):
    manifest_dir = root / ".skipo"
    manifest_dir.mkdir(parents=True)
    manifest = {"framework": "skipo", "scaffold": "vite", **(extra or {})}
    (manifest_dir / "project.json").write_text(json.dumps(manifest), encoding="utf-8")
    return manifest_dir / "project.json"


def test_identity_is_not_minted_locally_and_enrollment_request_is_idempotent(tmp_path):
    manifest_path = make_project(tmp_path)
    first = ensure_app_identity(tmp_path)
    first_request = json.loads((tmp_path / ".skipo/enrollment-request.json").read_text(encoding="utf-8"))
    second = ensure_app_identity(tmp_path)
    second_request = json.loads((tmp_path / ".skipo/enrollment-request.json").read_text(encoding="utf-8"))
    stored = json.loads(manifest_path.read_text(encoding="utf-8"))
    generated = (tmp_path / "src/backend/ecosystem/appIdentity_Pure.ts").read_text(encoding="utf-8")

    assert first["app_id"] is None
    assert second["app_id"] is None
    assert stored["app_id"] if "app_id" in stored else None is None
    assert first["registration_status"] == second["registration_status"] == "pending_enrollment"
    assert first_request["request_id"] == second_request["request_id"]
    assert first_request["app_id"] is None
    assert str(uuid.UUID(first_request["request_id"])) == first_request["request_id"]
    assert first["enrollment_request_id"] == first_request["request_id"]
    assert stored["deployment_id"] is None
    assert stored["oauth_client_id"] is None
    assert inspect_app_identity(tmp_path)["enrollment_required"] is True
    assert inspect_app_identity(tmp_path)["registry_trust_verified"] is False
    assert generated.count("export const appId = '';") == 1
    assert "app- " not in generated
    assert "WORKSPACE_APP_ID: appId" in generated
    assert "my-app" not in generated


def test_url_changes_do_not_mint_or_change_permanent_app_identity(tmp_path):
    manifest_path = make_project(tmp_path, {
        "app_url": "https://first.example",
        "deployment_id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
        "oauth_client_id": "luth-aiko-web",
    })
    first = ensure_app_identity(tmp_path)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["app_url"] = "https://second.example"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    second = ensure_app_identity(tmp_path)
    assert first["app_id"] is None
    assert second["app_id"] is None
    updated = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert updated.get("app_id") is None
    assert updated["deployment_id"] == "d290f1ee-6c54-4b01-90e6-d701748f0851"
    assert updated["oauth_client_id"] == "luth-aiko-web"


def test_local_approval_markers_cannot_authorize_an_application(tmp_path):
    manifest_path = make_project(tmp_path, {
        "app_id": "aiko",
        "app_identity": {"app_id": "aiko", "registration_status": "approved",
                         "approval_reference": "registry:apps/aiko"},
        "deployment_id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
        "oauth_client_id": "luth-aiko-web",
    })
    result = ensure_app_identity(tmp_path)
    stored = json.loads(manifest_path.read_text(encoding="utf-8"))
    report = inspect_app_identity(tmp_path)

    assert result == {
        "app_id": "aiko",
        "deployment_id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
        "oauth_client_id": "luth-aiko-web",
        "registration_status": "pending_enrollment",
        "enrollment_request_id": result["enrollment_request_id"],
        "enrollment_request": ".skipo/enrollment-request.json",
    }
    assert str(uuid.UUID(result["enrollment_request_id"])) == result["enrollment_request_id"]
    assert stored["app_identity"]["registration_status"] == "pending_enrollment"
    assert "approval_reference" not in stored["app_identity"]
    assert report["ok"] is False
    assert report["registry_trust_verified"] is False
    assert report["enrollment_required"] is True
    assert report["deployment_id"] == "d290f1ee-6c54-4b01-90e6-d701748f0851"
    assert report["oauth_client_id"] == "luth-aiko-web"


def test_invalid_existing_identity_is_never_silently_replaced(tmp_path):
    make_project(tmp_path, {"app_id": "https://app.example"})
    try:
        ensure_app_identity(tmp_path)
    except ValueError as exc:
        assert "invalid" in str(exc)
    else:
        raise AssertionError("invalid permanent app identity must be rejected")


def test_deployment_and_oauth_client_ids_are_distinct_and_preserved(tmp_path):
    manifest_path = make_project(tmp_path, {
        "app_id": "aiko",
        "deployment_id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
        "oauth_client_id": "luth-aiko-web",
    })
    result = ensure_app_identity(tmp_path)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    generated = (tmp_path / "src/backend/ecosystem/appIdentity_Pure.ts").read_text(encoding="utf-8")

    assert manifest["app_id"] == "aiko"
    assert manifest["deployment_id"] == "d290f1ee-6c54-4b01-90e6-d701748f0851"
    assert manifest["oauth_client_id"] == "luth-aiko-web"
    assert result["app_id"] == "aiko"
    assert result["app_id"] != result["deployment_id"]
    assert generated.count("export const appId = \"aiko\" as const;") == 1
    assert "export const deploymentId" in generated
    assert "export const oauthClientId" in generated


def test_invalid_deployment_id_is_rejected_without_replacing_app_id(tmp_path):
    make_project(tmp_path, {"app_id": "aiko", "deployment_id": "https://app.example"})
    try:
        ensure_app_identity(tmp_path)
    except ValueError as exc:
        assert "deployment_id" in str(exc)
    else:
        raise AssertionError("invalid deployment identity must be rejected")


def test_real_cli_create_and_two_repairs_keep_identity_unassigned_until_registry_enrollment(tmp_path, monkeypatch, capsys):
    scripts_dir = Path(__file__).resolve().parents[1] / "scripts"
    spec = importlib.util.spec_from_file_location("skipo_cli_identity_test", scripts_dir / "skipo_cli.py")
    cli = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(cli)

    scaffold = tmp_path / "scaffolds" / "vite"
    (scaffold / "src/backend/ecosystem").mkdir(parents=True)
    (scaffold / "src/backend/ecosystem/appIdentity_Pure.ts").write_text("export const appId = 'my-app';\n")
    (scaffold / "package.json").write_text('{"name":"my-app"}\n')
    cli.SCAFFOLDS = tmp_path / "scaffolds"
    monkeypatch.setattr(cli, "capability_adopt", lambda _root: None)
    monkeypatch.setattr(cli, "capability_compose", lambda *_args, **_kwargs: {"ok": True})
    monkeypatch.setattr(cli, "assess_architecture", lambda _root: {"blocked": False})
    monkeypatch.setattr(cli, "transaction_verify", lambda _root, _version: {"ok": True})

    def reconcile(root, apply, _version, with_environment, verify_hook):
        if apply:
            (root / "src/backend/ecosystem/appIdentity_Pure.ts").write_text("export const appId = 'my-app';\n")
            return verify_hook(root)
        return {"ok": True}

    monkeypatch.setattr(cli, "reconcile_transaction", reconcile)
    monkeypatch.setitem(sys.modules, "skipo_canonical_shell", SimpleNamespace(
        reconcile_shell=lambda root, apply: {"ok": apply}
    ))

    target = tmp_path / "generated-app"
    assert cli.create_project("Generated App", target, "vite", False) == 0
    capsys.readouterr()
    manifest_path = target / ".skipo/project.json"
    first = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert first.get("app_id") is None

    first["app_url"] = "https://first.example"
    manifest_path.write_text(json.dumps(first), encoding="utf-8")
    assert cli.repair_project(target, apply=True) == 0
    capsys.readouterr()
    second = json.loads(manifest_path.read_text(encoding="utf-8"))
    second["app_url"] = "https://second.example"
    manifest_path.write_text(json.dumps(second), encoding="utf-8")
    assert cli.repair_project(target, apply=True) == 0
    capsys.readouterr()

    final = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert final.get("app_id") is None
    assert final["app_identity"]["registration_status"] == "pending_enrollment"
    assert final["deployment_id"] is None
    assert final["oauth_client_id"] is None
    generated_identity = (target / "src/backend/ecosystem/appIdentity_Pure.ts").read_text(encoding="utf-8")
    assert "export const appId = ''; " .strip() in generated_identity
    assert "my-app" not in generated_identity
    enrollment = json.loads((target / ".skipo/enrollment-request.json").read_text(encoding="utf-8"))
    assert enrollment["app_id"] is None
    assert enrollment["request_id"] == final.get("app_identity", {}).get("enrollment_request_id", enrollment["request_id"])
