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
    app_id, web, assets = read_project(root)
    if not BUNDLE_ID.fullmatch(args.bundle_id):
        raise ValueError("Bundle ID must be a reverse-DNS identifier (com.example.app)")
    if not args.app_name.strip() or len(args.app_name.strip()) > 80:
        raise ValueError("App display name must be 1–80 non-whitespace characters")
    origin = https_origin(args.api_origin)
    if args.backend == "remote" and not origin:
        raise ValueError("Remote backend mode requires an HTTPS --api-origin")
    if args.discovery and args.target != "desktop":
        raise ValueError("Mobile NSD/Bonjour adapters are not installed; discovery is blocked")
    peer = root / "native" / "peer" / "nodeBeacon.mjs"
    if args.discovery and (not peer.is_file() or peer.is_symlink()):
        raise ValueError("First install reviewed desktop peer adapter using skipo native-peer")
    if args.backend == "remote" and args.action == "prepare":
        raise ValueError("Native authenticated API bridge is unverified; remote packaging blocked")

    output = root / "dist" / "native" / args.target
    files = {path: data.encode("utf-8") for path, data in
             render_files(args.target, args.bundle_id, args.app_name, args.discovery, app_id).items()}
    if args.discovery:
        files["peer/nodeBeacon.mjs"] = peer.read_bytes()
    for path in assets:
        files["web/" + path.relative_to(web).as_posix()] = path.read_bytes()
    sha = hashlib.sha256()
    for path in sorted(files):
        sha.update(path.encode("utf-8") + b"\\x00" + files[path] + b"\\x00")
    digest = sha.hexdigest()
    report = {
        "operation": "skipo package", "target": args.target,
        "backend": args.backend, "apiOrigin": origin,
        "discovery": "desktop-udp" if args.discovery else "disabled",
        "source": str(root), "output": str(output),
        "artifactDigest": digest, "fileCount": len(files),
        "nativeShellPrepared": False, "nativeBinaryBuilt": False,
        "signed": False, "releaseReady": False,
        "blockers": (["Canonical native API and Luth auth redirect bridge not verified"]
                     if args.backend == "remote" else []),
    }
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
    parser.add_argument("action", choices=("plan", "prepare"))
    parser.add_argument("--target", required=True, choices=TARGETS)
    parser.add_argument("--project", type=Path, default=Path.cwd())
    parser.add_argument("--bundle-id", required=True)
    parser.add_argument("--app-name", required=True)
    parser.add_argument("--backend", choices=("static", "remote"), required=True)
    parser.add_argument("--api-origin")
    parser.add_argument("--discovery", action="store_true")
    args = parser.parse_args(argv)
    try:
        report, files = build_plan(args)
        if args.action == "prepare":
            report = prepare(report, files)
        print(json.dumps({"ok": True, **report}, sort_keys=True))
        return 0
    except (ValueError, OSError, TypeError, KeyError, json.JSONDecodeError) as exc:
        print(json.dumps({"ok": False, "operation": "skipo package",
                          "error": str(exc), "action": args.action}, sort_keys=True))
        return 2


if __name__ == "__main__":
    sys.exit(main())
