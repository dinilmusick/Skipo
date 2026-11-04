from pathlib import Path
import json
import re
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()

def read_json(path: Path):
    if not path.is_file():
        raise SystemExit(f"Missing required manifest: {path}")
    return json.loads(path.read_text(encoding="utf-8"))

root_pkg = read_json(root / "package.json")
scaffold_pkg = read_json(root / "scaffolds" / "nextjs" / "package.json")
baseline = {
    "@dinilmusick/gutts": "^1.4.3",
    "@ultrst-armada/floks": "^1.13.15",
    "@ultrst-armada/frnlts": "^0.5.5",
    "@ultrst-armada/kloks": "^1.24.9",
}
for name, version in baseline.items():
    if root_pkg.get("dependencies", {}).get(name) != version:
        raise SystemExit(f"Root package baseline mismatch: {name}")
    if scaffold_pkg.get("dependencies", {}).get(name) != version:
        raise SystemExit(f"Next.js scaffold package baseline mismatch: {name}")

gutts_spec = root_pkg.get("dependencies", {}).get("@dinilmusick/gutts", "")
gutts_override = root_pkg.get("pnpm", {}).get("overrides", {}).get("@dinilmusick/gutts", "")
if gutts_spec.startswith("git+") or gutts_override:
    raise SystemExit("GutTS must resolve from the published npm package, not a Git SHA or override.")

for manifest_name, manifest in (("root", root_pkg), ("Next.js scaffold", scaffold_pkg)):
    for section in ("dependencies", "devDependencies"):
        for dependency in (manifest.get(section) or {}):
            if dependency.lower() in {"bcrypt", "bcryptjs", "@types/bcryptjs"}:
                raise SystemExit(f"{manifest_name} must not install app-local password hashing: {dependency}")

login = (root / "scaffolds/nextjs/app/login/page.tsx").read_text(encoding="utf-8")
if "LuthAuthPage" not in login or "UserAuthPage" in login:
    raise SystemExit("Next.js scaffold login page must use integrated Floks LuthAuthPage.")

route = (root / "scaffolds/nextjs/app/api/auth/login/route.ts").read_text(encoding="utf-8")
if "DEFAULT_LUTH_URL" not in route or "appBackend.services.auth.loginUser" in route:
    raise SystemExit("Scaffold auth route must proxy to Luth and must not call local login services.")
for forbidden in (r"hashPassword\s*\(", r"verifyPassword\s*\(", r"bcrypt", r"createSession\s*\("):
    if re.search(forbidden, route + login, re.IGNORECASE):
        raise SystemExit(f"Local authentication implementation detected: {forbidden}")

skill = (root / "architecture/authentication/SKILL.md").read_text(encoding="utf-8")
if "SYSTEM_DATABASE_URL" not in skill:
    raise SystemExit("Canonical auth contract must preserve SYSTEM_DATABASE_URL configuration.")
for forbidden in ("SRKL_AUTH_BASE_URL", "LUTH_AUTH_URL"):
    if forbidden in skill:
        raise SystemExit(f"Per-app auth URL environment variable is forbidden: {forbidden}")

generator = (root / "scripts/scaffold_app_structure.py").read_text(encoding="utf-8")
for old in ('"@dinilmusick/gutts": "^1.3.2"', '"@ultrst-armada/kloks": "^1.24.0"',
            '"@ultrst-armada/floks": "^1.13.3"', '"@ultrst-armada/frnlts": "^0.5.3"'):
    if old in generator:
        raise SystemExit(f"Scaffold generator contains stale package baseline: {old}")


register_route = (root / "scaffolds/nextjs/app/api/auth/register/route.ts").read_text(encoding="utf-8")
if "DEFAULT_LUTH_URL" not in register_route or "registerUser" in register_route:
    raise SystemExit("Scaffold registration route must proxy to Luth and must not call local registration services.")

catch_all = root / "scaffolds/nextjs/app/api/auth/[...auth]/route.ts"
if not catch_all.is_file():
    raise SystemExit("Scaffold must include a canonical Luth auth catch-all proxy.")
catch_all_source = catch_all.read_text(encoding="utf-8")
if "DEFAULT_LUTH_URL" not in catch_all_source:
    raise SystemExit("Auth catch-all must forward to the canonical Luth URL.")

if "LuthAuthPage" not in generator or "export { AuthPage } from '@ultrst-armada/floks/ui'" in generator:
    raise SystemExit("Generic Skipo generator must generate the integrated Floks LuthAuthPage.")


backend_scaffold = (root / "scaffolds/nextjs/src/backend/AppBackend.ts").read_text(encoding="utf-8")
if "process.env." in backend_scaffold:
    raise SystemExit("Generated backend facade must not depend on per-app environment variables.")
if "sess::" in backend_scaffold or "AUTH_TOKEN" in backend_scaffold or "AUTH_USER_ID" in backend_scaffold:
    raise SystemExit("Generated backend facade must not synthesize or inject application-local auth tokens.")
if "AuthServiceFacade" not in backend_scaffold:
    raise SystemExit("Generated backend must expose the canonical Kloks/Luth auth facade.")

# Scan the complete generated source tree, not just documentation markers or known routes.
for source_root in (root / "scaffolds" / "nextjs" / "app", root / "scaffolds" / "nextjs" / "src"):
    for source_file in source_root.rglob("*"):
        if not source_file.is_file() or source_file.suffix not in {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}:
            continue
        source = source_file.read_text(encoding="utf-8", errors="replace")
        forbidden_patterns = (
            r"\bbcrypt(?:js)?\b",
            r"\b(?:verifyPassword|hashPassword|rotateRefreshToken)\s*\(",
            r"\bpassword_hash\b",
            r"\bcreateSession\s*\(",
            r"appBackend\.services\.auth\.(?:loginUser|registerUser)",
            r"\bUserAuthPage\b",
            r"\b(?:jsonwebtoken|jwt)\.sign\s*\(",
        )
        for pattern in forbidden_patterns:
            if re.search(pattern, source, re.IGNORECASE):
                raise SystemExit(f"Generated application contains local authentication authority: {source_file.relative_to(root)} ({pattern})")


# The Vite scaffold is a first-class generated application target and must satisfy
# the same canonical Luth contract as the Next.js scaffold.
vite_pkg = read_json(root / "scaffolds" / "vite" / "package.json")
for name, version in baseline.items():
    if vite_pkg.get("dependencies", {}).get(name) != version:
        raise SystemExit(f"Vite scaffold package baseline mismatch: {name}")
for section in ("dependencies", "devDependencies"):
    for dependency in (vite_pkg.get(section) or {}):
        if dependency.lower() in {"bcrypt", "bcryptjs", "@types/bcryptjs"}:
            raise SystemExit(f"Vite scaffold must not install local password hashing: {dependency}")

vite_login = (root / "scaffolds/vite/src/frontend/components/gates/LoginGate.tsx").read_text(encoding="utf-8")
if "LuthAuthPage" not in vite_login or "AuthPage" in vite_login.replace("LuthAuthPage", ""):
    raise SystemExit("Vite scaffold LoginGate must use integrated Floks LuthAuthPage.")
for framework in ("nextjs", "vite"):
    auth_client = (root / f"scaffolds/{framework}/src/libraries/client/luthAuthClient.ts").read_text(encoding="utf-8")
    if "VITE_LUTH_URL" in auth_client or "NEXT_PUBLIC_LUTH_URL" in auth_client or "process.env" in auth_client:
        raise SystemExit(f"{framework} scaffold must use Kloks DEFAULT_LUTH_URL, not per-app auth URL environment variables.")
    if "luthAuthClient.getAuthHeaders()" not in auth_client:
        raise SystemExit(f"{framework} scaffold must provide the canonical Luth bearer transport.")

next_middleware = root / "scaffolds/nextjs/middleware.ts"
if not next_middleware.is_file():
    raise SystemExit("Next.js scaffold must enforce Luth session validation at the API boundary.")
next_middleware_source = next_middleware.read_text(encoding="utf-8")
if "/api/session" not in next_middleware_source or "session.user.id" not in next_middleware_source:
    raise SystemExit("Next.js API middleware must validate Luth and inject verified identity.")
if "forwarded.set('x-user-id', session.user.id)" not in next_middleware_source:
    raise SystemExit("Next.js middleware must overwrite caller-supplied identity headers.")

vite_session = (root / "scaffolds/vite/src/backend/auth/luthSession.ts").read_text(encoding="utf-8")
vite_adapter = (root / "scaffolds/vite/src/backend/adapters/httpsAdapter.ts").read_text(encoding="utf-8")
if "authenticateLuthRequest" not in vite_adapter or "proxyLuthAuthRequest" not in vite_adapter:
    raise SystemExit("Vite API adapter must enforce Luth validation and proxy canonical auth routes.")
if "/api/session" not in vite_session or "session.user.id" not in vite_session:
    raise SystemExit("Vite API boundary must validate Luth and inject verified identity.")
if "sess::" in vite_adapter or "url.searchParams.get('userId')" in vite_adapter:
    raise SystemExit("Vite scaffold must not derive identity from synthetic tokens or caller query parameters.")
if "DepmBackend.services.auth.loginUser" in vite_adapter:
    raise SystemExit("Vite scaffold must not issue application-local login sessions.")

for framework in ("nextjs", "vite"):
    source_roots = (
        root / "scaffolds" / framework / "app",
        root / "scaffolds" / framework / "src",
    )
    for source_root in source_roots:
        if not source_root.exists():
            continue
        for source_file in source_root.rglob("*"):
            if not source_file.is_file() or source_file.suffix not in {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}:
                continue
            source = source_file.read_text(encoding="utf-8", errors="replace")
            forbidden_markers = (
                "localStorage.getItem('skipo-auth-token')",
                'localStorage.getItem("skipo-auth-token")',
                "Bearer sess::",
                "hashPassword(",
                "verifyPassword(",
                "createSession(",
                "password_hash",
                "bcrypt",
                "bcryptjs",
            )
            for marker in forbidden_markers:
                if marker.lower() in source.lower():
                    raise SystemExit(f"Generated {framework} source contains local auth authority: {source_file.relative_to(root)} ({marker})")

print("Canonical Luth scaffold architecture: PASS")
