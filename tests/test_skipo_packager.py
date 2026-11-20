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
        "<html><head><meta charset='utf-8'></head><body>Skipo</body></html>\n"
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


def test_mobile_discovery_is_mandatory_and_has_real_native_sources(tmp_path):
    root = project(tmp_path)
    for target, name in (("android", "NsdManager"), ("ios", "NetServiceBrowser")):
        code, status, stderr = call(root, action="prepare", target=target)
        assert code == 0, stderr
        assert status["discovery"] == {"android": "android-nsd", "ios": "ios-bonjour"}[target]
        output = root / "dist" / "native" / target
        native = output / "native" / "skipo-discovery"
        if target == "android":
            source = native / "android" / "src" / "main" / "java" / "org" / "ultrst" / "skipo" / "discovery" / "SkipoDiscoveryPlugin.java"
            assert name in source.read_text()
            assert "ACCESS_LOCAL_NETWORK" in (native / "android" / "src" / "main" / "AndroidManifest.xml").read_text()
        else:
            source = native / "ios" / "Sources" / "SkipoDiscovery" / "SkipoDiscoveryPlugin.swift"
            assert name in source.read_text()
            assert "capacitor-swift-pm" in (native / "Package.swift").read_text()
        assert "skipo-native-discovery.js" in (output / "web" / "index.html").read_text()
        assert (output / "web" / "skipo-native-discovery.js").is_file()
        assert "file:./native/skipo-discovery" in (output / "package.json").read_text()
        assert (output / "scripts" / "skipo-postadd.mjs").is_file()


def test_desktop_udp_is_mandatory_even_without_explicit_flag(tmp_path):
    root = project(tmp_path)
    code, status, stderr = call(root, action="prepare", target="desktop")
    assert code == 0, stderr
    assert status["discovery"] == "desktop-udp"
    output = root / "dist" / "native" / "desktop"
    assert "NativeUdpBeacon" in (output / "main.mjs").read_text()
    assert "node:dgram" in (output / "peer" / "nodeBeacon.mjs").read_text()
    assert "electron-builder" in (output / "package.json").read_text()
    assert "package:windows:x64" in (output / "package.json").read_text()
    assert "package:macos:arm64" in (output / "package.json").read_text()
    assert "package:linux:x64" in (output / "package.json").read_text()
    assert "node:dgram" not in (root / "src" / "app.ts").read_text()


def test_custom_peer_adapter_drift_is_rejected(tmp_path):
    root = project(tmp_path)
    peer = root / "native" / "peer" / "nodeBeacon.mjs"
    peer.parent.mkdir(parents=True)
    peer.write_text("export class Unsafe {}\\n")
    code, status, _ = call(root, action="prepare", target="desktop")
    assert code == 2 and not status["ok"]
    assert "drift" in status["error"]


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


def test_native_build_rejects_wrong_host_and_architecture(tmp_path):
    import platform
    root = project(tmp_path)
    code, status, _ = call(root, action="build", target="desktop")
    assert code == 2 and "--platform" in status["error"]
    args = [sys.executable, str(SCRIPT), "build", "--target", "desktop",
            "--project", str(root), "--bundle-id", "com.example.app",
            "--app-name", "My App", "--backend", "static", "--platform",
            ("windows" if platform.system() != "Windows" else "linux")]
    result = subprocess.run(args, capture_output=True, text=True)
    assert result.returncode == 2
    assert "matching OS" in json.loads(result.stdout)["error"]
    assert not (root / "dist" / "native" / "releases").exists()


def test_iOS_native_requires_mac_host(tmp_path):
    import platform
    if platform.system() == "Darwin":
        pytest.skip("Native iOS build should run through Xcode on macOS runner")
    root = project(tmp_path)
    code, result, _ = call(root, action="build", target="ios")
    assert code == 2
    assert "macOS Xcode" in result["error"]


def test_native_js_bridge_is_syntax_valid(tmp_path):
    root = project(tmp_path)
    assert call(root, action="prepare", target="android")[0] == 0
    output = root / "dist" / "native" / "android"
    for rel in ("web/skipo-native-discovery.js", "scripts/skipo-postadd.mjs"):
        result = subprocess.run(["node", "--check", str(output / rel)],
                                capture_output=True, text=True)
        assert result.returncode == 0, result.stderr
