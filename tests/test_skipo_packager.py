"""Target packaging smoke tests against a canonical Fetch project fixture."""
import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "skipo_packager.py"
SKIPO = ROOT / "scripts" / "skipo_cli.py"


def project(tmp_path):
    (tmp_path / "src").mkdir()
    (tmp_path / "dist" / "client" / "assets").mkdir(parents=True)
    (tmp_path / "src" / "app.ts").write_text("export default {fetch() {}};\n")
    (tmp_path / "dist" / "client" / "index.html").write_text(
        "<html><body>Skipo</body></html>\n"
    )
    (tmp_path / "dist" / "client" / "assets" / "app.js").write_text(
        "document.body.dataset.ready='true';\n"
    )
    (tmp_path / "package.json").write_text(json.dumps({
        "name": "example-app", "scripts": {"build": "node scripts/skipo-build.mjs"}
    }))
    (tmp_path / "skipo.providers.json").write_text(json.dumps({
        "application": {"entry": "src/app.ts", "protocol": "fetch"}
    }))
    return tmp_path


def call(root, action="plan", target="desktop", backend="static",
         discovery=False, api_origin=None, via_cli=False):
    script = SKIPO if via_cli else SCRIPT
    command = [sys.executable, str(script)]
    if via_cli:
        command.append("package")
    command += [
        action, "--project", str(root), "--target", target,
        "--bundle-id", "com.example.app", "--app-name", "My App",
        "--backend", backend,
    ]
    if discovery:
        command.append("--discovery")
    if api_origin:
        command.extend(["--api-origin", api_origin])
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    return result.returncode, json.loads(result.stdout), result.stderr


def test_plan_is_read_only_and_deterministic(tmp_path):
    root = project(tmp_path)
    before = (root / "src" / "app.ts").read_bytes()
    a, report, stderr = call(root, via_cli=True)
    b, again, _ = call(root)
    assert a == b == 0, stderr
    assert report == again
    assert report["target"] == "desktop"
    assert report["nativeBinaryBuilt"] is False
    assert report["releaseReady"] is False
    assert not (root / "dist" / "native").exists()
    assert (root / "src" / "app.ts").read_bytes() == before


@pytest.mark.parametrize("target", ["desktop", "android", "ios"])
def test_prepare_idempotent_and_original_source_unmodified(tmp_path, target):
    root = project(tmp_path)
    source = (root / "src" / "app.ts").read_bytes()
    code, first, stderr = call(root, action="prepare", target=target, via_cli=True)
    assert code == 0, stderr
    output = root / "dist" / "native" / target
    assert first["nativeShellPrepared"] and not first["noop"]
    assert (output / "web" / "index.html").exists()
    assert (output / "web" / "assets" / "app.js").exists()
    if target == "desktop":
        assert (output / "main.mjs").exists()
        assert "nodeIntegration: false" in (output / "main.mjs").read_text()
        assert "Native API transport not configured" in (output / "main.mjs").read_text()
        checked = subprocess.run(["node", "--check", str(output / "main.mjs")],
                                 capture_output=True, text=True)
        assert checked.returncode == 0, checked.stderr
    else:
        assert json.loads((output / "capacitor.config.json").read_text())["webDir"] == "web"
    code, again, stderr = call(root, action="prepare", target=target)
    assert code == 0, stderr
    assert again["noop"] is True
    assert again["artifactDigest"] == first["artifactDigest"]
    assert (root / "src" / "app.ts").read_bytes() == source


def test_edited_native_project_is_preserved(tmp_path):
    root = project(tmp_path)
    assert call(root, action="prepare")[0] == 0
    package = root / "dist" / "native" / "desktop" / "package.json"
    package.write_text("user-owned custom changes\n")
    code, status, _ = call(root, action="prepare")
    assert code == 2 and not status["ok"]
    assert "refusing" in status["error"]
    assert package.read_text() == "user-owned custom changes\n"


def test_mobile_discovery_denied_until_real_adapter_exists(tmp_path):
    root = project(tmp_path)
    for target in ("android", "ios"):
        code, status, _ = call(root, target=target, discovery=True)
        assert code == 2 and not status["ok"]
        assert "not installed" in status["error"]


def test_desktop_discovery_requires_opt_in_and_reviewed_module(tmp_path):
    root = project(tmp_path)
    code, _, _ = call(root, discovery=True)
    assert code == 2
    peer = root / "native" / "peer" / "nodeBeacon.mjs"
    peer.parent.mkdir(parents=True)
    sys.path.insert(0, str(ROOT / "scripts"))
    from skipo_native_peer import TEMPLATE
    peer.write_text(TEMPLATE)
    code, report, _ = call(root, action="prepare", discovery=True)
    assert code == 0 and report["discovery"] == "desktop-udp"
    output = root / "dist" / "native" / "desktop"
    assert "NativeUdpBeacon" in (output / "main.mjs").read_text()
    assert (output / "peer" / "nodeBeacon.mjs").read_bytes() == peer.read_bytes()
    assert "node:dgram" not in (root / "src" / "app.ts").read_text()


@pytest.mark.parametrize("origin", [
    "http://example.com", "https://localhost:8000", "https://x.local",
    "https://user:pass@example.com", "https://example.com/api",
    "https://example.com:444", "https://example.com/?token=x",
])
def test_remote_rejects_unsafe_origin(tmp_path, origin):
    root = project(tmp_path)
    code, report, _ = call(root, backend="remote", api_origin=origin)
    assert code == 2, report


def test_remote_stays_blocked_until_native_api_bridge_is_real(tmp_path):
    root = project(tmp_path)
    code, report, _ = call(root, backend="remote", api_origin="https://api.example.com")
    assert code == 0 and report["blockers"]
    code, report, _ = call(
        root, action="prepare", backend="remote", api_origin="https://api.example.com"
    )
    assert code == 2
    assert "unverified" in report["error"]
    assert not (root / "dist" / "native").exists()


def test_native_bundle_does_not_change_web_or_serverless_artifacts(tmp_path):
    root = project(tmp_path)
    before = {p.relative_to(root).as_posix(): p.read_bytes() for p in [
        root / "src" / "app.ts",
        root / "skipo.providers.json",
        root / "dist" / "client" / "index.html",
    ]}
    assert call(root, action="prepare", target="android")[0] == 0
    assert call(root, action="prepare", target="desktop")[0] == 0
    for rel, data in before.items():
        assert (root / rel).read_bytes() == data


def test_rejects_symlink_assets(tmp_path):
    root = project(tmp_path)
    (root / "dist" / "client" / "assets" / "external").symlink_to(
        root / "src" / "app.ts"
    )
    code, report, _ = call(root)
    assert code == 2 and "Symlink" in report["error"]
