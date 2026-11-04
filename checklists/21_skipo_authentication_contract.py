#!/usr/bin/env python3
"""Enforce the canonical Luth-only authentication contract in Skipo scaffolds."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

PACKAGE_BASELINE = {
    "@dinilmusick/gutts": "^1.4.3",
    "@ultrst-armada/kloks": "^1.24.9",
    "@ultrst-armada/floks": "^1.13.15",
    "@ultrst-armada/frnlts": "^0.5.5",
    "@ultrst-armada/krnl": "^1.0.11",
}
SOURCE_SUFFIXES = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
FORBIDDEN_SOURCE_PATTERNS = (
    (r"\b(?:bcrypt|bcryptjs)\b", "bcrypt implementation or import"),
    (r"\b(?:hashPassword|verifyPassword|comparePassword|checkPassword)\s*\(", "local password verification/hashing"),
    (r"\bpassword_hash\b|\bpasswordHash\b", "application credential hash storage"),
    (r"(?:localStorage|sessionStorage)\s*\.\s*setItem\s*\(\s*['\"][^'\"]*(?:password|credential|refresh.?token)", "browser credential persistence"),
    (r"\b(?:createSession|generateSession|issueSession|mintSession|signSession)\s*\(", "application-local session issuance"),
    (r"\b(?:jsonwebtoken|jwt)\s*\.\s*sign\s*\(", "application-local JWT issuance"),
    (r"\bfrom\s+['\"]better-auth(?:/[^'\"]*)?['\"]|\bimport\s*\(\s*['\"]better-auth", "direct Better Auth integration outside Luth"),
    (r"\b(?:user_credentials|auth_credentials|auth_sessions|user_sessions)\b", "application-local authentication tables"),
    (r"\b(?:INSERT\s+INTO|UPDATE)\s+(?:users|accounts|sessions|credentials)\b", "direct authentication database mutation"),
    (r"\bappBackend\.services\.auth\.(?:login|loginUser|register|registerUser|createSession)", "legacy application-local auth service"),
    (r"\bAuthServiceFacade\b", "legacy Kloks application-local AuthServiceFacade"),
)

def source_files(root: Path):
    for base in (root / "app", root / "src", root / "scaffolds" / "nextjs" / "app", root / "scaffolds" / "nextjs" / "src"):
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if path.is_file() and path.suffix.lower() in SOURCE_SUFFIXES:
                yield path

def scan_source_tree(root: Path) -> list[str]:
    violations: list[str] = []
    for path in source_files(root):
        source = path.read_text(encoding="utf-8", errors="replace")
        for pattern, description in FORBIDDEN_SOURCE_PATTERNS:
            if re.search(pattern, source, re.IGNORECASE):
                violations.append(f"{path.relative_to(root)}: {description}")
    return violations

def read_manifest(path: Path) -> dict:
    if not path.is_file():
        raise ValueError(f"Missing required manifest: {path}")
    return json.loads(path.read_text(encoding="utf-8"))

def validate_repository(root: Path) -> list[str]:
    errors: list[str] = []
    try:
        root_manifest = read_manifest(root / "package.json")
        next_manifest = read_manifest(root / "scaffolds" / "nextjs" / "package.json")
    except (ValueError, json.JSONDecodeError) as error:
        return [str(error)]

    for label, manifest in (("root", root_manifest), ("Next.js scaffold", next_manifest)):
        dependencies = {}
        dependencies.update(manifest.get("dependencies") or {})
        dependencies.update(manifest.get("devDependencies") or {})
        for name in ("bcrypt", "bcryptjs", "@types/bcryptjs"):
            if name in dependencies:
                errors.append(f"{label} manifest installs forbidden auth dependency: {name}")
        for name, expected in PACKAGE_BASELINE.items():
            actual = dependencies.get(name)
            if actual != expected:
                errors.append(f"{label} manifest baseline mismatch for {name}: expected {expected}, got {actual}")
        gutts_spec = dependencies.get("@dinilmusick/gutts", "")
        if isinstance(gutts_spec, str) and gutts_spec.startswith(("git+", "git:", "github:")):
            errors.append(f"{label} must consume published GutTS, not a Git dependency")
        overrides = manifest.get("pnpm", {}).get("overrides") or {}
        if any(name == "@dinilmusick/gutts" or name.startswith("@dinilmusick/gutts@") for name in overrides):
            errors.append(f"{label} must not override GutTS with a Git SHA or alternate source")

    required_files = (
        "scaffolds/nextjs/app/login/page.tsx",
        "scaffolds/nextjs/src/frontend/pages/auth/LuthAuthPage.tsx",
        "scaffolds/nextjs/src/backend/AppBackend.ts",
        "scaffolds/nextjs/src/backend/auth/luthSession.ts",
        "scripts/scaffold_app_structure.py",
        "architecture/authentication/SKILL.md",
    )
    for rel in required_files:
        if not (root / rel).is_file():
            errors.append(f"Missing canonical authentication file: {rel}")

    login = root / "scaffolds/nextjs/app/login/page.tsx"
    if login.is_file():
        source = login.read_text(encoding="utf-8")
        if "LuthAuthPage" not in source or "applicationId=" not in source:
            errors.append("Next.js login page must compose the LuthAuthPage adapter with an applicationId")

    adapter = root / "scaffolds/nextjs/src/frontend/pages/auth/LuthAuthPage.tsx"
    if adapter.is_file():
        source = adapter.read_text(encoding="utf-8")
        for marker in ("@ultrst-armada/floks/auth", "AuthPage", "@ultrst-armada/kloks/auth", "createLuthAuthClient", "signInWithEmail", "signUpWithEmail", "signInWithGoogle", "getSession"):
            if marker not in source:
                errors.append(f"LuthAuthPage adapter missing canonical integration: {marker}")

    for rel in ("scaffolds/nextjs/app/api/auth/login/route.ts", "scaffolds/nextjs/app/api/auth/register/route.ts"):
        if (root / rel).exists():
            errors.append(f"Dedicated app-local login/registration endpoint must be absent: {rel}")

    catch_all = root / "scaffolds/nextjs/app/api/auth/[...auth]/route.ts"
    if catch_all.is_file() and "DEFAULT_LUTH_URL" not in catch_all.read_text(encoding="utf-8"):
        errors.append("Optional auth catch-all must proxy only to DEFAULT_LUTH_URL")

    backend = root / "scaffolds/nextjs/src/backend/AppBackend.ts"
    if backend.is_file() and "AuthServiceFacade" in backend.read_text(encoding="utf-8"):
        errors.append("Next.js backend must not expose the legacy Kloks local-auth facade")

    guard = root / "scaffolds/nextjs/src/backend/auth/luthSession.ts"
    if guard.is_file():
        source = guard.read_text(encoding="utf-8")
        if "DEFAULT_LUTH_URL" not in source or "/api/session" not in source or "authenticated !== true" not in source:
            errors.append("Protected-route helper must ask Luth to validate a real session")

    generator = root / "scripts/scaffold_app_structure.py"
    if generator.is_file():
        source = generator.read_text(encoding="utf-8")
        if '"@ultrst-armada/krnl": "^1.0.9"' in source:
            errors.append("Generic scaffold generator contains stale Krnl package baseline")
        if "AuthServiceFacade" in source:
            errors.append("Generic scaffold generator must not generate the legacy Kloks local-auth facade")
        for marker in ("LuthAuthPage", "createLuthAuthClient", "@ultrst-armada/floks/auth", "requireLuthSession"):
            if marker not in source:
                errors.append(f"Generic scaffold generator missing canonical auth output: {marker}")

    skill = root / "architecture/authentication/SKILL.md"
    if skill.is_file():
        source = skill.read_text(encoding="utf-8")
        for marker in ("Luth", "Better Auth", "AuthServiceFacade", "protected backend route"):
            if marker not in source:
                errors.append(f"Authentication skill missing contract marker: {marker}")

    errors.extend(scan_source_tree(root))
    return errors

def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    errors = validate_repository(root)
    if errors:
        for error in errors:
            print(f"AUTH CONTRACT VIOLATION: {error}", file=sys.stderr)
        return 1
    print("Canonical Luth-only authentication scaffold: PASS")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
