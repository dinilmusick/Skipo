"""Skipo must package an actual Hubrys complex without inventing a Fetch app."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "skipo_packager.py"


def fixture(tmp_path):
    root = tmp_path
    (root / "apps" / "docustack").mkdir(parents=True)
    (root / "apps" / "aiko").mkdir(parents=True)
    (root / "dist" / "client" / "assets").mkdir(parents=True)
    (root / "package.json").write_text(json.dumps({
        "name": "@ultrst-armada/hubrys-complex", "private": True, "type": "module"
    }))
    apps = []
    for app in ("docustack", "aiko"):
        data = {
            "id": app, "name": app, "version": "1.0.0", "backendEntry": "backend.mjs"
        }
        (root / "apps" / app / "hubrys.manifest.json").write_text(json.dumps(data))
        (root / "apps" / app / "backend.mjs").write_text("export default {};\n")
        apps.append({"id": app, "version": "1.0.0"})
    (root / "hubrys.package.json").write_text(json.dumps({
        "kind": "hubrys-complex-v1", "schemaVersion": 1,
        "complexId": "hubrys-suite", "apps": apps,
        "host": {"httpEntrypoints": 1, "appPorts": 0},
        "frontend": {"directory": "dist/client"},
    }))
    (root / "dist" / "client" / "index.html").write_text(
        "<!doctype html><html><head></head><body>Hubrys</body></html>"
    )
    (root / "dist" / "client" / "assets" / "app.js").write_text(
        "document.body.dataset.hubrys='true';\n"
    )
    return root


def call(root, target="desktop", action="plan", source_kind="hubrys", backend="static"):
    command = [
        sys.executable, str(SCRIPT), action, "--project", str(root),
        "--source-kind", source_kind, "--target", target,
        "--bundle-id", "com.ultrst.hubrys", "--app-name", "Hubrys",
        "--backend", backend,
    ]
    result = subprocess.run(command, capture_output=True, text=True, cwd=ROOT)
    return result.returncode, json.loads(result.stdout), result.stderr


@pytest.mark.parametrize(("target", "expected"), [
    ("desktop", "desktop-udp"),
    ("android", "android-nsd"),
    ("ios", "ios-bonjour"),
])
def test_composition_package_uses_canonical_native_service_by_target(tmp_path, target, expected):
    project = fixture(tmp_path)
    source_before = (project / "dist" / "client" / "index.html").read_bytes()
    code, plan, err = call(project, target)
    assert code == 0, err
    assert plan["sourceKind"] == "hubrys"
    assert plan["discovery"] == expected
    assert [a["id"] for a in plan["embeddedApps"]] == ["docustack", "aiko"]
    assert plan["compositeBackendBundled"] is False
    assert plan["blockers"]
    assert not (project / "dist" / "native").exists()
    code, prepared, err = call(project, target, "prepare")
    assert code == 0, err
    assert prepared["nativeShellPrepared"] is True
    assert prepared["nativeBinaryBuilt"] is False
    assert prepared["releaseReady"] is False
    artifact = project / "dist" / "native" / target
    composition = json.loads((artifact / "meta" / "hubrys-composition.json").read_text())
    assert composition["host"] == {"httpEntrypoints": 1, "appPorts": 0}
    if target == "desktop":
        assert "node:dgram" in (artifact / "peer" / "nodeBeacon.mjs").read_text()
        assert "NativeUdpBeacon" in (artifact / "main.mjs").read_text()
    else:
        assert (artifact / "web" / "skipo-native-discovery.js").is_file()
        assert (artifact / "native" / "skipo-discovery" / "package.json").is_file()
    assert (project / "dist" / "client" / "index.html").read_bytes() == source_before
    code, repeated, err = call(project, target, "prepare")
    assert code == 0, err
    assert repeated["noop"] is True
    assert repeated["artifactDigest"] == prepared["artifactDigest"]


def test_invalid_composition_ownership_is_rejected(tmp_path):
    root = fixture(tmp_path)
    path = root / "hubrys.package.json"
    spec = json.loads(path.read_text())
    spec["host"]["appPorts"] = 3
    path.write_text(json.dumps(spec))
    code, report, _ = call(root)
    assert code == 2 and "zero per-app ports" in report["error"]


def test_duplicate_apps_and_missing_entries_are_rejected(tmp_path):
    root = fixture(tmp_path)
    path = root / "hubrys.package.json"
    spec = json.loads(path.read_text())
    spec["apps"].append({"id": "aiko", "version": "1.0.0"})
    path.write_text(json.dumps(spec))
    code, report, _ = call(root)
    assert code == 2 and "Duplicate" in report["error"]
    spec["apps"] = [spec["apps"][0]]
    path.write_text(json.dumps(spec))
    (root / "apps" / "docustack" / "backend.mjs").unlink()
    code, report, _ = call(root)
    assert code == 2 and "not installed" in report["error"]


def test_hubrys_is_not_faked_as_skipo_app(tmp_path):
    root = fixture(tmp_path)
    assert not (root / "src" / "app.ts").exists()
    assert not (root / "skipo.providers.json").exists()
    code, report, _ = call(root, source_kind="skipo")
    assert code == 2
    assert "canonical Skipo" in report["error"]


def test_remote_compound_backend_fails_closed_for_prepare_and_build(tmp_path):
    root = fixture(tmp_path)
    for action in ("prepare", "build"):
        code, report, _ = call(root, action=action, backend="remote")
        assert code == 2
        assert "HTTPS" in report["error"] or "unverified" in report["error"]


def test_symlinked_component_entry_is_not_accepted(tmp_path):
    root = fixture(tmp_path)
    entry = root / "apps" / "aiko" / "backend.mjs"
    entry.unlink()
    entry.symlink_to(root / "apps" / "docustack" / "backend.mjs")
    code, report, _ = call(root)
    assert code == 2
    assert "not installed inside" in report["error"]
