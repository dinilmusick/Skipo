#!/usr/bin/env python3
"""Deterministic native-shell preparation for a canonical Skipo Fetch app.

The stage deliberately does not claim SDK compilation, signing, native auth,
or executable API routing. These are separate verifiable release gates.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlparse

from skipo_packager_templates import render_files

APP_ID = re.compile(r"^[a-z][a-z0-9-]{0,62}$")
BUNDLE_ID = re.compile(r"^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){2,}$")
TARGETS = ("desktop", "android", "ios")


def safe_files(root: Path) -> list[Path]:
    if root.is_symlink() or not root.is_dir():
        raise ValueError("Web asset directory is absent or is a symlink")
    result = []
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise ValueError("Symlink assets are forbidden: " + str(path))
        if not path.is_file() and not path.is_dir():
            raise ValueError("Unsupported web asset: " + str(path))
        if path.is_file():
            result.append(path)
    return result


def read_project(root: Path) -> tuple[str, Path, list[Path]]:
    if not root.is_dir() or root.is_symlink():
        raise ValueError("Project directory must be a real directory")
    descriptor = root / "skipo.providers.json"
    entry = root / "src" / "app.ts"
    package = root / "package.json"
    for path in (descriptor, entry, package):
        if not path.is_file() or path.is_symlink():
            raise ValueError("Expected canonical Skipo input: " + str(path))
    manifest = json.loads(descriptor.read_text(encoding="utf-8"))
    if manifest.get("application", {}).get("entry") != "src/app.ts":
        raise ValueError("Provider manifest must refer to canonical src/app.ts")
    config = json.loads(package.read_text(encoding="utf-8"))
    if not isinstance(config.get("scripts", {}).get("build"), str):
        raise ValueError("Existing application must expose its canonical build command")
    name = config.get("name")
    if not isinstance(name, str):
        raise ValueError("Application package name is missing")
    app_id = re.sub(r"[^a-z0-9-]", "-", name.lower()).strip("-")
    if not APP_ID.fullmatch(app_id):
        raise ValueError("Cannot derive a safe native application identifier")
    web = root / "dist" / "client"
    if not (web / "index.html").is_file():
        raise ValueError("Build the canonical Skipo app first (npm run build)")
    assets = safe_files(web)
    return app_id, web, assets



def read_hubrys_project(root: Path) -> tuple[str, Path, list[Path], list[dict]]:
    """Validate a real Hubrys complex; never synthesize a fake Skipo Fetch entry.

    Hubrys is an application host, so its native wrapper inherits the same
    target-specific Skipo native platform assets but not Skipo app scaffolding.
    """
    if root.is_symlink() or not root.is_dir():
        raise ValueError("Hubrys project directory must be a real directory")
    descriptor = root / "hubrys.package.json"
    package_path = root / "package.json"
    for path in (descriptor, package_path):
        if not path.is_file() or path.is_symlink():
            raise ValueError("Hubrys package input missing: " + str(path))
    try:
        spec = json.loads(descriptor.read_text(encoding="utf-8"))
        package = json.loads(package_path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("Invalid Hubrys package manifest or package.json") from exc
    if (not isinstance(spec, dict) or spec.get("kind") != "hubrys-complex-v1"
        or spec.get("schemaVersion") != 1):
        raise ValueError("Invalid Hubrys composition manifest schema")
    name = spec.get("complexId")
    if not isinstance(name, str) or not APP_ID.fullmatch(name):
        raise ValueError("Invalid Hubrys complex ID")
    host = spec.get("host")
    if not isinstance(host, dict) or host.get("httpEntrypoints") != 1 or host.get("appPorts") != 0:
        raise ValueError("Hubrys must expose one host entrypoint and zero per-app ports")
    frontend = spec.get("frontend")
    if not isinstance(frontend, dict) or frontend.get("directory") != "dist/client":
        raise ValueError("Hubrys native frontend must use dist/client; arbitrary paths are forbidden")
    if not isinstance(package, dict) or not isinstance(package.get("name"), str):
        raise ValueError("Hubrys package.json must name the host package")
    apps = spec.get("apps")
    if not isinstance(apps, list) or not apps or len(apps) > 64:
        raise ValueError("Hubrys native packaging requires 1–64 embedded apps")
    ids: set[str] = set()
    records: list[dict] = []
    for app in apps:
        if not isinstance(app, dict):
            raise ValueError("Invalid Hubrys embedded application entry")
        app_id, version = app.get("id"), app.get("version")
        if (not isinstance(app_id, str) or not APP_ID.fullmatch(app_id)
            or not isinstance(version, str) or not version.strip() or len(version) > 100
            or any(c in version for c in ("/", "\\", "\x00"))):
            raise ValueError("Invalid Hubrys app ID or version")
        if app_id in ids:
            raise ValueError("Duplicate embedded Hubrys app " + app_id)
        ids.add(app_id)
        component = root / "apps" / app_id
        meta = component / "hubrys.manifest.json"
        if (component.is_symlink() or not component.is_dir()
            or meta.is_symlink() or not meta.is_file()):
            raise ValueError("Missing Hubrys embedded app manifest: " + app_id)
        installed = json.loads(meta.read_text(encoding="utf-8"))
        if (not isinstance(installed, dict) or installed.get("id") != app_id
            or installed.get("version") != version):
            raise ValueError("Hubrys app ID/version mismatch: " + app_id)
        backend_entry = installed.get("backendEntry")
        if not isinstance(backend_entry, str) or not backend_entry or "\\" in backend_entry:
            raise ValueError("Invalid Hubrys app backend entry: " + app_id)
        resolved = (component / backend_entry).resolve()
        if not resolved.is_relative_to(component.resolve()) or not resolved.is_file() or resolved.is_symlink():
            raise ValueError("Hubrys backend entry not installed inside its app: " + app_id)
        records.append({"id": app_id, "version": version})
    frontend_dir = root / "dist" / "client"
    if not (frontend_dir / "index.html").is_file():
        raise ValueError("Hubrys complex frontend is not built: dist/client/index.html")
    return name, frontend_dir, safe_files(frontend_dir), records

def https_origin(value: str | None) -> str | None:
    if value is None:
        return None
    parsed = urlparse(value)
    if (parsed.scheme != "https" or parsed.username or parsed.password
        or parsed.port or parsed.path not in ("", "/") or parsed.query
        or parsed.fragment or not parsed.hostname
        or "." not in parsed.hostname or parsed.hostname.endswith(".local")):
        raise ValueError("API origin must be an HTTPS DNS origin without URL paths")
    return parsed.scheme + "://" + parsed.hostname


def build_plan(args: argparse.Namespace) -> tuple[dict, dict[str, bytes]]:
    root = args.project.resolve()
    if (root / "dist").is_symlink():
        raise ValueError("Build output cannot be symlinked")
    if args.source_kind == "hubrys":
        app_id, web, assets, embedded_apps = read_hubrys_project(root)
    else:
        app_id, web, assets = read_project(root)
        embedded_apps = []
    if not BUNDLE_ID.fullmatch(args.bundle_id):
        raise ValueError("Bundle ID must be a reverse-DNS identifier (com.example.app)")
    if not args.app_name.strip() or len(args.app_name.strip()) > 80:
        raise ValueError("App display name must be 1–80 non-whitespace characters")
    origin = https_origin(args.api_origin)
    if args.backend == "remote" and not origin:
        raise ValueError("Remote backend mode requires an HTTPS --api-origin")
    # Mandatory target capabilities; packaging no longer has a discovery-off path.
    from skipo_native_peer import TEMPLATE
    from skipo_discovery_native import render_mobile_discovery
    peer = root / "native" / "peer" / "nodeBeacon.mjs"
    if args.target == "desktop" and peer.exists():
        if peer.is_symlink() or not peer.is_file() or peer.read_text(encoding="utf-8") != TEMPLATE:
            raise ValueError("Desktop native peer adapter drift from canonical Skipo source")
    if args.backend == "remote" and args.action in ("prepare", "build"):
        raise ValueError("Native authenticated API bridge is unverified; remote packaging blocked")

    output = root / "dist" / "native" / args.target
    files = {path: data.encode("utf-8") for path, data in
             render_files(args.target, args.bundle_id, args.app_name, True, app_id).items()}
    if args.target == "desktop":
        files["peer/nodeBeacon.mjs"] = TEMPLATE.encode("utf-8")
    else:
        files.update({path: data.encode("utf-8") for path, data in
                      render_mobile_discovery(args.target).items()})
    for path in assets:
        files["web/" + path.relative_to(web).as_posix()] = path.read_bytes()
    if embedded_apps:
        composition = {"kind": "hubrys-complex-v1", "complexId": app_id,
                       "host": {"httpEntrypoints": 1, "appPorts": 0},
                       "apps": embedded_apps}
        files["meta/hubrys-composition.json"] = (
            json.dumps(composition, sort_keys=True, separators=(",", ":")) + "\n"
        ).encode("utf-8")
    if args.target in ("android", "ios"):
        key = "web/index.html"
        html = files[key].decode("utf-8")
        if "</head>" not in html:
            raise ValueError("Mobile native discovery requires a valid HTML head")
        if "skipo-native-discovery.js" in html:
            raise ValueError("App HTML already injects a discovery bridge")
        files[key] = html.replace("</head>",
            '<script src="/skipo-native-discovery.js" defer></script></head>', 1
        ).encode("utf-8")
    sha = hashlib.sha256()
    for path in sorted(files):
        sha.update(path.encode("utf-8") + b"\\x00" + files[path] + b"\\x00")
    digest = sha.hexdigest()
    report = {
        "operation": "skipo package", "target": args.target,
        "sourceKind": args.source_kind, "embeddedApps": embedded_apps,
        "backend": args.backend, "apiOrigin": origin,
        "discovery": {"desktop":"desktop-udp","android":"android-nsd","ios":"ios-bonjour"}[args.target],
        "source": str(root), "output": str(output),
        "artifactDigest": digest, "fileCount": len(files),
        "nativeShellPrepared": False, "nativeBinaryBuilt": False,
        "signed": False, "releaseReady": False,
        "blockers": (["Canonical native API and Luth auth redirect bridge not verified"]
                     if args.backend == "remote" else []),
    }
    if args.source_kind == "hubrys":
        report["compositeBackendBundled"] = False
        report["blockers"].append(
            "Hubrys app backend mounting and authenticated Luth session bridge are not included in this native shell"
        )
    return report, files


def prepare(report: dict, files: dict[str, bytes]) -> dict:
    output = Path(report["output"])
    parent = output.parent
    if parent.is_symlink() or not parent.resolve().is_relative_to(Path(report["source"]).resolve()):
        raise ValueError("Generated destination escapes the project")
    if output.exists() or output.is_symlink():
        if output.is_symlink() or not output.is_dir():
            raise ValueError("Generated destination is unsafe")
        old_paths = [p for p in output.rglob("*") if p.is_file()]
        if any(p.is_symlink() for p in output.rglob("*")):
            raise ValueError("Generated destination contains a symlink")
        actual = {p.relative_to(output).as_posix(): p.read_bytes() for p in old_paths}
        if actual != files:
            raise ValueError("Generated output drift; refusing to replace edited files")
        return {**report, "nativeShellPrepared": True, "noop": True}
    parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".skipo-pack-", dir=parent) as stage_name:
        stage = Path(stage_name)
        for rel, data in files.items():
            dest = stage / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
        os.rename(stage, output)
    return {**report, "nativeShellPrepared": True, "noop": False}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="skipo package")
    parser.add_argument("action", choices=("plan", "prepare", "build"))
    parser.add_argument("--target", required=True, choices=TARGETS)
    parser.add_argument("--project", type=Path, default=Path.cwd())
    parser.add_argument("--source-kind", choices=("skipo", "hubrys"), default="skipo")
    parser.add_argument("--bundle-id", required=True)
    parser.add_argument("--app-name", required=True)
    parser.add_argument("--backend", choices=("static", "remote"), required=True)
    parser.add_argument("--api-origin")
    parser.add_argument("--discovery", action="store_true", help="Deprecated: discovery is mandatory for native targets")
    parser.add_argument("--platform", choices=("windows", "macos", "linux"))
    parser.add_argument("--arch", choices=("x64", "arm64", "universal"), default="x64")
    args = parser.parse_args(argv)
    try:
        report, files = build_plan(args)
        if args.action == "prepare":
            report = prepare(report, files)
        elif args.action == "build":
            from skipo_native_build import build_native
            report = build_native(args, report, files)
        print(json.dumps({"ok": True, **report}, sort_keys=True))
        return 0
    except (ValueError, OSError, TypeError, KeyError, json.JSONDecodeError) as exc:
        print(json.dumps({"ok": False, "operation": "skipo package",
                          "error": str(exc), "action": args.action}, sort_keys=True))
        return 2


if __name__ == "__main__":
    sys.exit(main())
