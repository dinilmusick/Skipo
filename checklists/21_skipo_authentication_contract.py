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

print("Canonical Luth scaffold architecture: PASS")
