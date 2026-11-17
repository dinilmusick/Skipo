#!/usr/bin/env bash
# End-to-end test of the actual npm tarball, not the repository-local CLI.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
temp="$(mktemp -d)"
trap 'rm -rf "$temp"' EXIT

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
  npm pack "@ultrst-armada/skipo@$SKIPO_REGISTRY_VERSION" --pack-destination "$temp" >/dev/null
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
"$cli" plan "$temp/legacy-app" > "$temp/plan.json"
test ! -e "$temp/legacy-app/.skipo/project.json"
"$cli" update "$temp/legacy-app" > "$temp/first.json"
"$cli" verify "$temp/legacy-app" > "$temp/verify.json"
"$cli" update "$temp/legacy-app" > "$temp/second.json"
"$cli" verify "$temp/legacy-app" > "$temp/verify-again.json"

python3 - "$temp" <<'PY'
import json
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
assert read("verify.json")["ok"], read("verify.json").get("errors")
assert second["ok"], second.get("errors")
assert read("verify-again.json")["ok"], read("verify-again.json").get("errors")
assert second["actions"] == [], second["actions"]
assert project["framework"] == "skipo"
assert project["skipo_version"] == "1.1.1"
assert project["scaffold"] == "adopted"
print("Packed Skipo CLI: legacy upgrade, verification, and idempotency passed")
PY
