#!/usr/bin/env python3
"""Build actual unsigned native artifacts from Skipo's deterministic shell inputs.

Never report a signed binary or production-capable backend without independent
evidence. Build in a temporary directory to avoid altering the canonical app.
"""
from __future__ import annotations

import hashlib
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

HOST = {"Windows": "windows", "Darwin": "macos", "Linux": "linux"}


def _run(args: list[str], cwd: Path, env: dict[str, str], timeout=1200) -> None:
    print("[skipo native] " + " ".join(args), file=sys.stderr, flush=True)
    result = subprocess.run(args, cwd=cwd, env=env, stderr=sys.stderr,
                            stdout=sys.stderr, timeout=timeout)
    if result.returncode:
        raise ValueError(f"Native toolchain exited {result.returncode}: {args[0]}")


def _artifacts(stage: Path, target: str) -> list[Path]:
    if target == "desktop":
        directory = stage / "release"
        files = [p for p in directory.rglob("*") if p.is_file() and
                 p.suffix.lower() in (".exe", ".dmg", ".appimage", ".zip")]
    elif target == "android":
        directory = stage / "android" / "app" / "build" / "outputs" / "apk" / "debug"
        files = list(directory.glob("*.apk"))
    else:
        directory = stage / ".skipo-derived" / "Build" / "Products" / "Debug-iphonesimulator"
        files = list(directory.glob("*.app"))
    if not files:
        raise ValueError("Native SDK reported success but produced no expected artifact")
    return sorted(files)


def _archive_app(path: Path, target: Path) -> None:
    """Preserve macOS/iOS app bundle structure; generated archive is not an IPA."""
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for member in sorted(path.rglob("*")):
            if member.is_symlink():
                raise ValueError("Native SDK produced unexpected symlink in .app")
            if member.is_file():
                archive.write(member, arcname=path.name + "/" +
                              member.relative_to(path).as_posix())


def build_native(args, report: dict, files: dict[str, bytes]) -> dict:
    host = HOST.get(platform.system())
    target = args.target
    if target == "desktop":
        if not args.platform:
            raise ValueError("Desktop build requires --platform windows|macos|linux")
        if host != args.platform:
            raise ValueError("Native binary builds require matching OS runner")
        if args.arch == "universal" and args.platform != "macos":
            raise ValueError("Universal architecture is supported only on macOS")
    else:
        if args.platform:
            raise ValueError("Mobile native builds do not accept --platform")
        if args.arch != "x64":
            raise ValueError("Mobile architecture is selected by the native SDK")
        if target == "ios" and host != "macos":
            raise ValueError("iOS builds require a macOS Xcode host")
        if target == "android" and host not in ("linux", "macos", "windows"):
            raise ValueError("Android SDK host unavailable")
    npm = "npm.cmd" if host == "windows" else "npm"
    env = dict(os.environ)
    # Signing is a separate explicit verified operation. Do not use secrets
    # inherited from the agent runner or accidental builder auto-discovery.
    for name in ("CSC_LINK", "CSC_KEY_PASSWORD", "WIN_CSC_LINK",
                 "WIN_CSC_KEY_PASSWORD", "APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD"):
        env.pop(name, None)
    env["CSC_IDENTITY_AUTO_DISCOVERY"] = "false"
    source = Path(report["source"])
    temp_root = source / "dist" / "native"
    temp_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".skipo-sdk-", dir=temp_root) as dirname:
        stage = Path(dirname)
        for rel, data in files.items():
            path = stage / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        _run([npm, "install", "--ignore-scripts", "--no-audit", "--no-fund"],
             stage, env)
        if target == "desktop":
            # Electron requires its binary, downloaded by its postinstall script.
            _run([npm, "rebuild", "electron", "--foreground-scripts"], stage, env)
            _run([npm, "run",
                  f"package:{args.platform}:{args.arch}"], stage, env)
        else:
            _run([npm, "run", "native:add"], stage, env)
            _run([npm, "run", "native:sync"], stage, env)
            if target == "android":
                gradle = "gradlew.bat" if host == "windows" else "./gradlew"
                _run([gradle, ":app:assembleDebug"], stage / "android", env)
            else:
                _run(["xcodebuild", "-project", "ios/App/App.xcodeproj",
                      "-scheme", "App", "-configuration", "Debug",
                      "-sdk", "iphonesimulator",
                      "-destination", "generic/platform=iOS Simulator",
                      "-derivedDataPath", str(stage / ".skipo-derived"),
                      "CODE_SIGNING_ALLOWED=NO", "build"], stage, env)
        built = _artifacts(stage, target)
        release = temp_root / "releases" / target / (
            args.platform + "-" + args.arch if target == "desktop" else "debug")
        release.mkdir(parents=True, exist_ok=True)
        digests = []
        for path in built:
            destination = release / (path.name + ".zip" if path.is_dir() else path.name)
            if destination.exists() or destination.is_symlink():
                raise ValueError("Release artifact already exists: " + str(destination))
            if path.is_dir():
                _archive_app(path, destination)
            else:
                shutil.copy2(path, destination)
            digests.append({"file": str(destination),
                            "sha256": hashlib.sha256(destination.read_bytes()).hexdigest()})
    return {**report, "nativeBinaryBuilt": True, "signed": False,
            "releaseReady": False, "nativeArtifacts": digests,
            "notes": "Unsigned native SDK output only; release signing/auth separately verified"}
