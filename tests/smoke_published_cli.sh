#!/usr/bin/env bash
# End-to-end test of the actual npm tarball, not the repository-local CLI.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
temp="$(mktemp -d)"
cleanup() {
  code=$?
  if [ "$code" -ne 0 ]; then
    echo "Packed Skipo CLI smoke failed with exit code $code; command receipts:" >&2
    for receipt in plan first verify second verify-again policy semantic conformance; do
      if [ -f "$temp/$receipt.json" ]; then
        echo "---- $receipt.json ----" >&2
        cat "$temp/$receipt.json" >&2
      fi
    done
  fi
  rm -rf "$temp"
  exit "$code"
}
trap cleanup EXIT

if [[ -n "${SKIPO_REGISTRY_VERSION:-}" ]]; then
  # npm may acknowledge a publish before the version is available through the
  # public resolver. Check anonymously and wait for registry propagation.
  available=0
  for attempt in $(seq 1 40); do
    if npm view "@ultrst-armada/skipo@$SKIPO_REGISTRY_VERSION" version --prefer-online --registry=https://registry.npmjs.org/ >/dev/null 2>&1; then
      available=1
      break
    fi
    echo "Public npm registry has not resolved Skipo $SKIPO_REGISTRY_VERSION (attempt $attempt/40)."
    sleep 15
  done
  test "$available" -eq 1 || { echo "Published package remains unavailable from public npm registry." >&2; exit 1; }
  npm view "@ultrst-armada/skipo@$SKIPO_REGISTRY_VERSION" version --prefer-online --registry=https://registry.npmjs.org/
  packed=0
  for attempt in $(seq 1 20); do
    if npm pack "@ultrst-armada/skipo@$SKIPO_REGISTRY_VERSION" --pack-destination "$temp" --prefer-online --registry=https://registry.npmjs.org/ >/dev/null 2>&1; then
      packed=1
      break
    fi
    echo "Public npm tarball is not available yet (attempt $attempt/20)."
    sleep 10
  done
  test "$packed" -eq 1 || { echo "Published package version resolves but its tarball cannot be downloaded." >&2; exit 1; }
else
  (cd "$root/packages/skipo" && npm pack --pack-destination "$temp" >/dev/null)
fi
tarball="$(find "$temp" -maxdepth 1 -name '*.tgz' -print -quit)"
test -n "$tarball"

mkdir -p "$temp/consumer" "$temp/legacy-app"
npm --prefix "$temp/consumer" install --ignore-scripts --no-audit --no-fund "$tarball" >/dev/null
cat > "$temp/legacy-app/package.json" <<'JSON'
{
  "name": "skipo-legacy-package-smoke",
  "version": "0.1.0",
  "private": true,
  "skipo": {"deploy": "fullstack"},
  "packageManager": "npm@10.9.0",
  "dependencies": {}
}
JSON
cat > "$temp/legacy-app/.env.example" <<'ENV'
SYSTEM_DATABASE_URL=
APP_URL=http://localhost:3000
ENV
(cd "$temp/legacy-app" && npm install --package-lock-only --ignore-scripts --no-audit --no-fund >/dev/null)

cli="$temp/consumer/node_modules/.bin/skipo"
app="$temp/pages"
"$cli" create PageFixture "$app"
"$cli" add login "$app"
"$cli" add workspace "$app"
"$cli" add main "$app"
"$cli" add main tab "Mixer" "$app"
tab="$(find "$app/src/frontend/pages/main/tabs" -name page.tsx)"
echo '// app-owned edit' >> "$tab"
sed -i '/const authProxy = await proxyLuthAuthRequest(request);/d' "$app/src/app.ts"
"$cli" add auth "$app"
grep -Fq 'const authProxy = await proxyLuthAuthRequest(request);' "$app/src/app.ts"
# A conflicting app-owned registry file must leave the pending route repair untouched.
printf 'export const localAuthBridge = 1;\n' > "$app/src/libraries/skipo/auth.ts"
sed -i '/const authProxy = await proxyLuthAuthRequest(request);/d' "$app/src/app.ts"
if "$cli" add auth "$app"; then echo "Expected an app-owned conflict"; exit 1; fi
if grep -Fq 'const authProxy = await proxyLuthAuthRequest(request);' "$app/src/app.ts"; then
  echo "A rejected page operation modified its target"; exit 1
fi
rm "$app/src/libraries/skipo/auth.ts"
"$cli" add auth "$app"
before="$(git diff --no-index /dev/null "$tab" || true)"
"$cli" add main tab "Mixer" "$app"
test "$(find "$app/src/frontend/pages/main/tabs" -name page.tsx | wc -l)" -eq 1
test "$before" = "$(git diff --no-index /dev/null "$tab" || true)"
"$cli" plan "$temp/legacy-app" > "$temp/plan.json"
test ! -e "$temp/legacy-app/.skipo/project.json"
"$cli" update "$temp/legacy-app" > "$temp/first.json"
# An empty legacy application must not be certified merely because metadata
# migration succeeded. Exercise every new distributed entrypoint and preserve
# its independent failure evidence.
if "$cli" verify "$temp/legacy-app" > "$temp/verify.json"; then
  echo "Incomplete legacy app was falsely certified" >&2; exit 1
fi
if "$cli" policy "$temp/legacy-app" > "$temp/policy.json"; then
  echo "Incomplete legacy app passed architectural policy" >&2; exit 1
fi
"$cli" semantic "$temp/legacy-app" > "$temp/semantic.json"
if "$cli" certify "$temp/legacy-app" > "$temp/conformance.json"; then
  echo "Incomplete legacy app passed certification" >&2; exit 1
fi
# An update must not silently turn a noncompliant legacy app into success.
if "$cli" update "$temp/legacy-app" > "$temp/second.json"; then
  echo "Incomplete legacy update was incorrectly reported as compliant" >&2; exit 1
fi
if "$cli" verify "$temp/legacy-app" > "$temp/verify-again.json"; then
  echo "Incomplete legacy app passed repeat verification" >&2; exit 1
fi

python3 - "$temp" "$root/packages/skipo/package.json" <<'PY'
import json
import os
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
def read(name):
    return json.loads((root / name).read_text(encoding="utf-8"))
plan = read("plan.json")
first = read("first.json")
second = read("second.json")
project = read("legacy-app/.skipo/project.json")
assert plan["ok"], plan.get("errors")
assert first["ok"], first.get("errors")
assert not read("verify.json")["ok"], "Partial legacy app must fail certification"
assert not read("verify-again.json")["ok"], "Repeat verification must remain fail-closed"
assert read("verify.json")["diagnostics"], "Failure must retain actionable diagnostics"
assert read("conformance.json")["compliance_status"] != "compliant_offline"
assert read("policy.json")["state"] != "compliant"
assert read("second.json")["ok"] is False, "Noncompliant update cannot claim success"
assert project["framework"] == "skipo"
expected_version = os.environ.get("SKIPO_REGISTRY_VERSION") or json.loads(pathlib.Path(sys.argv[2]).read_text())["version"]
assert project["skipo_version"] == expected_version, f"Expected Skipo {expected_version}, got {project['skipo_version']}"
assert project["scaffold"] == "adopted"
print("Packed Skipo CLI: all governance entrypoints reachable; incomplete legacy app correctly blocked")
PY
