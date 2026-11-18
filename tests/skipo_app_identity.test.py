"""Skipo app identity: no derived authority, immutable reference through repair."""
import json
import subprocess
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import skipo_app_identity as identity
import skipo_cli as cli


def make_manifest(root, **fields):
    (root / ".skipo").mkdir(exist_ok=True)
    data = {"framework": "skipo", "skipo_version": "1.3.0", **fields}
    (root / ".skipo" / "project.json").write_text(json.dumps(data), encoding="utf-8")


def test_create_never_forges_registered_application_id(tmp_path):
    scaffold = tmp_path / "fixture"
    scaffold.mkdir()
    (scaffold / "package.json").write_text('{"name":"my-app"}', encoding="utf-8")
    (scaffold / "vite.config.ts").write_text("export default {};\n", encoding="utf-8")
    target = tmp_path / "new-app"
    with patch.object(cli, "SCAFFOLDS", tmp_path), \
         patch.object(cli, "capability_adopt", return_value={"ok": True}), \
         patch.object(cli, "capability_compose", return_value={"ok": True}), \
         patch("skipo_canonical_shell.reconcile_shell", return_value={"ok": True}):
        assert cli.create_project("New App", target, "fixture", False) == 0
    manifest = json.loads((target / ".skipo/project.json").read_text())
    assert manifest["app_id"] is None
    assert manifest["registration_status"] == "enrollment_required"
    assert identity.inspect_identity(target)["status"] == "enrollment_required"
    assert not identity.inspect_identity(target)["authority_verified"]


def test_two_repairs_keep_app_id_independent_of_app_url(tmp_path):
    make_manifest(tmp_path, app_id="aiko", oauth_client_id="aiko-public-web",
                  deployment_id="aiko-deploy-01")
    (tmp_path / ".env").write_text("APP_URL=https://old.example\n")
    with patch.object(cli, "assess_architecture", return_value={"blocked": False}), \
         patch.object(cli, "reconcile_transaction", return_value={"ok": True, "applied": True}):
        assert cli.repair_project(tmp_path, apply=True) == 0
        (tmp_path / ".env").write_text("APP_URL=https://new.example\n")
        assert cli.repair_project(tmp_path, apply=True) == 0
        assert cli.update_project(tmp_path) == 0
    state = identity.inspect_identity(tmp_path)
    assert state["app_id"] == "aiko"
    assert state["status"] == "registry_confirmation_required"
    assert state["authority_verified"] is False
    assert json.loads((tmp_path / ".skipo/project.json").read_text())["app_id"] == "aiko"


def test_role_collision_fails_closed(tmp_path):
    make_manifest(tmp_path, app_id="aiko", oauth_client_id="aiko")
    result = identity.inspect_identity(tmp_path)
    assert not result["ok"]
    assert result["status"] == "invalid_identity"
    assert "must not equal" in result["errors"][0]


def test_spoofed_local_verified_status_never_proves_registry_authority(tmp_path):
    make_manifest(tmp_path, app_id="aiko", registration_status="verified",
                  app_url="https://elsewhere.example")
    state = identity.inspect_identity(tmp_path)
    assert state["ok"]
    assert state["app_id"] == "aiko"
    assert state["status"] == "registry_confirmation_required"
    assert not state["authority_verified"]


def test_invalid_identity_and_manifest_fail_closed(tmp_path):
    make_manifest(tmp_path, app_id="UPPER CASE")
    assert identity.inspect_identity(tmp_path)["status"] == "invalid_identity"
    (tmp_path / ".skipo/project.json").write_text("not-json", encoding="utf-8")
    assert identity.inspect_identity(tmp_path)["status"] == "invalid_manifest"


def test_identity_initializer_is_idempotent_and_never_overwrites_reference(tmp_path):
    make_manifest(tmp_path, app_id="kone")
    before = json.loads((tmp_path / ".skipo/project.json").read_text())
    identity.initialize_unenrolled_identity(tmp_path)
    identity.initialize_unenrolled_identity(tmp_path)
    after = json.loads((tmp_path / ".skipo/project.json").read_text())
    assert after["app_id"] == before["app_id"] == "kone"
    assert not identity.inspect_identity(tmp_path)["authority_verified"]




def test_offline_verify_checks_identity_shape_without_claiming_registry_authority(tmp_path, capsys):
    make_manifest(tmp_path, app_id="aiko", registration_status="verified")
    with patch.object(cli, "maintenance_verify", return_value={"ok": True, "status": "clean", "diagnostics": []}):
        with patch.object(cli, "independent_verify", return_value={"ok": True, "architecture": {}}):
            assert cli.verify_project(tmp_path) == 0
    report = json.loads(capsys.readouterr().out)
    assert report["ok"] is True
    assert report["app_identity"]["authority_verified"] is False
    assert any(item["code"] == "SKIPO_APP_REGISTRY_AUTHORITY_NOT_CHECKED"
               and item["status"] == "not_verified" for item in report["diagnostics"])


def test_offline_verify_rejects_missing_canonical_app_id(tmp_path, capsys):
    make_manifest(tmp_path)
    with patch.object(cli, "maintenance_verify", return_value={"ok": True, "status": "clean", "diagnostics": []}):
        with patch.object(cli, "independent_verify", return_value={"ok": True, "architecture": {}}):
            assert cli.verify_project(tmp_path) == 1
    report = json.loads(capsys.readouterr().out)
    assert report["ok"] is False
    assert any(item["code"] == "SKIPO_APP_REGISTRY_ENROLLMENT_REQUIRED"
               for item in report["diagnostics"])


def test_forced_create_preserves_existing_registered_identity_and_role_references(tmp_path, capsys):
    scaffold_root = tmp_path / "scaffolds"
    scaffold = scaffold_root / "vite"
    scaffold.mkdir(parents=True)
    (scaffold / "package.json").write_text('{"name":"my-app"}\n', encoding="utf-8")
    (scaffold / "vite.config.ts").write_text("export default {};\n", encoding="utf-8")

    target = tmp_path / "existing-app"
    target.mkdir()
    make_manifest(
        target,
        app_id="aiko",
        deployment_id="d290f1ee-6c54-4b01-90e6-d701748f0851",
        oauth_client_id="luth-aiko-web",
        app_identity_version=1,
        registration_status="verified",
    )
    (target / "existing-user-file.ts").write_text("export const retained = true;\n", encoding="utf-8")

    with patch.object(cli, "SCAFFOLDS", scaffold_root), \
         patch.object(cli, "capability_adopt", return_value={"ok": True}), \
         patch.object(cli, "capability_compose", return_value={"ok": True}), \
         patch("skipo_canonical_shell.reconcile_shell", return_value={"ok": True}):
        assert cli.create_project("Aiko Refreshed", target, "vite", True) == 0

    capsys.readouterr()
    manifest = json.loads((target / ".skipo/project.json").read_text(encoding="utf-8"))
    assert manifest["app_id"] == "aiko"
    assert manifest["deployment_id"] == "d290f1ee-6c54-4b01-90e6-d701748f0851"
    assert manifest["oauth_client_id"] == "luth-aiko-web"
    assert manifest["app_identity_version"] == 1
    assert manifest["registration_status"] == "verified"
    generated = (target / "src/backend/ecosystem/appIdentity_Pure.ts").read_text(encoding="utf-8")
    assert 'export const appId: string | null = "aiko";' in generated
    assert "appIdentityAuthorityVerified = false" in generated
    assert "WORKSPACE_APP_ID: appId" in generated
    assert (target / "existing-user-file.ts").exists() is True
    assert identity.inspect_identity(target)["app_id"] == "aiko"


def test_generated_identity_module_exports_runtime_contract_without_local_trust(tmp_path):
    make_manifest(
        tmp_path,
        app_id=None,
        deployment_id=None,
        oauth_client_id=None,
    )
    identity.initialize_unenrolled_identity(tmp_path)
    generated = (tmp_path / "src/backend/ecosystem/appIdentity_Pure.ts").read_text(encoding="utf-8")
    assert "export const appId: string | null = null;" in generated
    assert "export const appRegistrationStatus" in generated
    assert "export const appIdentityAuthorityVerified = false as const" in generated
    assert "export const deploymentId: string | null = null;" in generated
    assert "export const oauthClientId: string | null = null;" in generated
    assert "WORKSPACE_APP_ID: appId" in generated
    assert "appId ? { WORKSPACE_APP_ID: appId }" in generated
    assert "appIdentityAuthorityVerified && deploymentId" in generated
    assert "appIdentityAuthorityVerified && oauthClientId" in generated
    assert "LUTH_OAUTH_CLIENT_ID: oauthClientId" in generated


def test_published_skipo_entrypoint_routes_identity_to_framework_cli(tmp_path):
    make_manifest(tmp_path, app_id="aiko")
    repository_root = Path(__file__).resolve().parents[1]
    result = subprocess.run(
        ["node", str(repository_root / "bin" / "skipo.js"), "identity", str(tmp_path)],
        cwd=repository_root,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    report = json.loads(result.stdout)
    assert report["app_id"] == "aiko"
    assert report["status"] == "registry_confirmation_required"
    assert report["authority_verified"] is False


def test_forced_scaffold_regeneration_preserves_app_owned_tabs_byte_for_byte(tmp_path):
    scaffold_root = tmp_path / "scaffolds"
    scaffold = scaffold_root / "vite"
    main = scaffold / "src" / "frontend" / "pages" / "main"
    main.mkdir(parents=True)
    (scaffold / "package.json").write_text('{"name":"my-app"}\n', encoding="utf-8")
    (scaffold / "vite.config.ts").write_text("export default {};\n", encoding="utf-8")
    (main / "page.tsx").write_text("export const title = 'MyApp';\n", encoding="utf-8")

    target = tmp_path / "existing"
    target.mkdir()
    make_manifest(target, app_id="aiko", deployment_id="aiko-prod-deployment",
                  oauth_client_id="aiko-web-client", registration_status="verified")
    tabs = target / "src" / "frontend" / "pages" / "main" / "tabs"
    custom = tabs / "aiko"
    custom.mkdir(parents=True)
    page = custom / "page.tsx"
    before = b"export default function MyApp() { return 'private-custom-tab'; }\n"
    page.write_bytes(before)
    assets = custom / "assets"
    assets.mkdir()
    raw_asset = assets / "fixture.bin"
    raw_asset.write_bytes(b"\x00\xffMyApp\x00")
    (tabs / "empty").mkdir()

    with patch.object(cli, "SCAFFOLDS", scaffold_root), \\
         patch.object(cli, "capability_adopt", return_value={"ok": True}), \\
         patch.object(cli, "capability_compose", return_value={"ok": True}), \\
         patch("skipo_canonical_shell.reconcile_shell", return_value={"ok": True}):
        assert cli.create_project("Aiko Refreshed", target, "vite", True) == 0
        assert cli.create_project("Aiko Refreshed", target, "vite", True) == 0

    assert page.read_bytes() == before
    assert raw_asset.read_bytes() == b"\x00\xffMyApp\x00"
    assert (tabs / "empty").is_dir()
    assert "Aiko Refreshed" in ((target / "src/frontend/pages/main/page.tsx")).read_text()
    project = json.loads((target / ".skipo" / "project.json").read_text())
    assert project["app_id"] == "aiko"
    assert project["deployment_id"] == "aiko-prod-deployment"
    assert identity.inspect_identity(target)["authority_verified"] is False


def test_force_refresh_rejects_symlinked_custom_tabs_without_touching_source(tmp_path):
    scaffold_root = tmp_path / "scaffolds"
    scaffold = scaffold_root / "vite"
    scaffold.mkdir(parents=True)
    (scaffold / "package.json").write_text('{"name":"my-app"}\n', encoding="utf-8")
    (scaffold / "vite.config.ts").write_text("export default {};\n", encoding="utf-8")

    target = tmp_path / "app"
    target.mkdir()
    make_manifest(target, app_id="aiko")
    real = tmp_path / "outside"
    real.mkdir()
    (real / "page.tsx").write_text("export const retained = true;\n", encoding="utf-8")
    main = target / "src" / "frontend" / "pages" / "main"
    main.mkdir(parents=True)
    (main / "tabs").symlink_to(real, target_is_directory=True)

    with patch.object(cli, "SCAFFOLDS", scaffold_root):
        assert cli.create_project("Aiko", target, "vite", True) == 2
    assert (real / "page.tsx").read_text() == "export const retained = true;\n"
    assert (target / ".skipo" / "project.json").exists()
