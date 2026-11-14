#!/usr/bin/env python3
"""Aspect 27: Guest-mode scaffold and Luth-boundary governance."""

from __future__ import annotations

import re
import sys
from pathlib import Path

SOURCE_SUFFIXES = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
REQUIRED_GUEST_MARKERS = ("GuestAccessGate", "Continue as Guest", "/api/guest/lease")


def source_files(root: Path):
    for base in (root / "src", root / "app", root / "scaffolds" / "nextjs", root / "scaffolds" / "vite"):
        if not base.exists():
            continue
        yield from (p for p in base.rglob("*") if p.is_file() and p.suffix.lower() in SOURCE_SUFFIXES)


def validate_guest_contract(root: Path) -> list[str]:
    errors: list[str] = []
    guest_gate = root / "src/frontend/components/gates/GuestAccessGate.tsx"
    guest_mode = root / "src/guest/GuestMode.ts"
    if not guest_gate.is_file():
        errors.append("canonical guest access gate is missing")
    if not guest_mode.is_file():
        errors.append("canonical GuestMode policy is missing")

    for relative in (
        "scaffolds/nextjs/src/frontend/components/gates/GuestAccessGate.tsx",
        "scaffolds/vite/src/frontend/components/gates/GuestAccessGate.tsx",
    ):
        path = root / relative
        if not path.is_file():
            errors.append(f"missing guest gate: {relative}")
        else:
            source = path.read_text(encoding="utf-8", errors="replace")
            for marker in REQUIRED_GUEST_MARKERS:
                if marker not in source:
                    errors.append(f"{relative} missing guest marker: {marker}")

    for relative in (
        "scaffolds/nextjs/app/login/page.tsx",
        "scaffolds/vite/src/frontend/components/gates/LoginGate.tsx",
    ):
        path = root / relative
        if path.is_file() and "GuestAccessGate" not in path.read_text(encoding="utf-8", errors="replace"):
            errors.append(f"{relative} does not expose the framework guest entry point")

    for path in source_files(root):
        source = path.read_text(encoding="utf-8", errors="replace")
        is_guest_scoped = "guest" in path.name.lower() or "/guest/" in path.as_posix().lower()
        if "x-user-id" in source and (is_guest_scoped or re.search(r'["\']x-user-id["\']\s*:\s*["\']guest', source, re.IGNORECASE)):
            errors.append(f"guest-aware source must not synthesize x-user-id: {path.relative_to(root)}")
        if "AuthServiceFacade" in source and "LuthAuthServiceFacade" not in source:
            errors.append(f"legacy local AuthServiceFacade reference: {path.relative_to(root)}")

    for relative in (
        "src/backend/auth/luthSession.ts",
        "scaffolds/nextjs/src/backend/auth/luthSession.ts",
        "scaffolds/vite/src/backend/auth/luthSession.ts",
    ):
        path = root / relative
        if path.is_file():
            source = path.read_text(encoding="utf-8", errors="replace")
            if "skipo_guest" not in source:
                errors.append(f"Luth boundary does not explicitly strip guest credentials: {relative}")

    return errors


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    errors = validate_guest_contract(root)
    if errors:
        for error in errors:
            print("GUEST CONTRACT VIOLATION:", error, file=sys.stderr)
        return 1
    print("Guest scaffold and Luth-boundary contract: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
