#!/usr/bin/env python3
"""Reproducible SHA-256 attestation for shipped, non-app-owned Vite library source.

This is a release-authoring tool, NOT a generated application feature. The
validator embeds a separately reviewed SHA-256 manifest digest and rejects a
modified/missing attestation. App-owned edits do not acquire trusted provenance.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "scaffolds/vite/src/libraries"
ATTESTATION = ROOT / "checklists/framework_owned_vite_libraries.json"


def canonical_bytes() -> bytes:
    files = {}
    for source in sorted(TEMPLATE.rglob("*")):
        if not source.is_file() or source.is_symlink() or source.suffix not in {".ts", ".tsx"}:
            continue
        relative = source.relative_to(TEMPLATE).as_posix()
        if relative.startswith("skipo/"):
            # Dynamic application capability assets are never framework-exempt.
            continue
        # Git checkout autocrlf changes text bytes on Windows. Canonical LF
        # normalization preserves semantic source identity on every platform;
        # every other change must still cause a SHA-256 mismatch.
        canonical = source.read_bytes().replace(b"\r\n", b"\n").replace(b"\r", b"\n")
        files["src/libraries/" + relative] = hashlib.sha256(canonical).hexdigest()
    if not files:
        raise ValueError("Cannot attest an empty framework-owned Vite library snapshot")
    payload = {"schema": 1, "source": "canonical-vite-scaffold", "files": files}
    return (json.dumps(payload, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--print", action="store_true", help="Print release candidate manifest and digest")
    parser.add_argument("--check", action="store_true", help="Check committed attestation against scaffold")
    args = parser.parse_args()
    data = canonical_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if args.print:
        print("SKIPO_FRAMEWORK_MANIFEST_BEGIN")
        print(data.decode("utf-8"), end="")
        print("SKIPO_FRAMEWORK_MANIFEST_END")
        print("SKIPO_FRAMEWORK_MANIFEST_SHA256=" + digest)
    if args.check:
        if not ATTESTATION.is_file() or ATTESTATION.read_bytes() != data:
            raise ValueError("Framework source changed without a new reviewed attestation")
    if not args.print and not args.check:
        parser.error("Specify --print or --check")


if __name__ == "__main__":
    main()
