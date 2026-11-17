# Deterministic dependency migrations

This independent interface is designed for the final Skipo reconciler. It never runs
provider scripts or changes app-owned/unknown files without an explicit grant.

## Integration API

```python
from skipo_dependency_migrations import (
    plan_dependency_migrations,
    execute_dependency_migrations,
    verify_dependency_migrations,
)
from skipo_dependency_safety import recover_dependency_migrations

plan = plan_dependency_migrations(app_root, skipo_version="1.1.0")
if plan["ok"]:
    receipt = execute_dependency_migrations(app_root, plan)
    assert receipt["ok"] and receipt["verified"]
# When an interrupted journal exists, recover explicitly before re-planning.
```

The standalone `scripts` directory must be on `PYTHONPATH` (as it is for the
existing Skipo CLI). The planner reads `package.json`, an npm v2/v3 `package-lock.json` or
`npm-shrinkwrap.json`, installed `node_modules/<package>/package.json`, the
app's `.skipo/dependencies.json` previous-resolution ledger, and the versioned
contract declared in the **installed provider package's** `skipo.migrations.json`
(or `package.json#skipo.migrationContract`). Unsupported/no lockfiles, unresolved
semver, mismatched installed versions, missing edges, alternate migration routes,
and incompatible package constraints stop without mutation. Non-npm lockfiles are
explicitly unsupported until a verified resolver is implemented.

## Package-shipped contract

```json
{
  "schemaVersion": 1,
  "package": "@ultrst-armada/floks",
  "compatibility": {
    "skipo": ">=1.1.0",
    "dependencies": { "@ultrst-armada/kloks": "^2.0.5" }
  },
  "migrations": [
    {
      "id": "workspaces-v2",
      "fromVersion": "2.0.5",
      "toVersion": "2.0.6",
      "ownedPaths": ["src/framework/workspaces.ts"],
      "requiresPackages": { "@ultrst-armada/kloks": "^2.0.5" },
      "preconditions": [
        { "type": "text_present", "text": "LegacyWorkspaces", "paths": ["src/framework/workspaces.ts"] }
      ],
      "transformations": [
        { "type": "replace_text", "find": "LegacyWorkspaces", "replace": "CanonicalWorkspaces", "paths": ["src/framework/workspaces.ts"], "expectedMatches": 1 }
      ],
      "verification": [
        { "type": "text_present", "text": "CanonicalWorkspaces", "paths": ["src/framework/workspaces.ts"] },
        { "type": "text_absent", "text": "LegacyWorkspaces", "paths": ["src/framework/workspaces.ts"] }
      ]
    }
  ]
}
```

Allowed deterministic mutations: `replace_text`, `set_json`. Assertions:
`text_absent`, `text_present`, `json_equals`. `repair`, `dependsOn` and
`canonicalReplacements` are supported; arbitrary scripts, commands, hooks and
unsafe paths are rejected. Version resolution requires exact `MAJOR.MINOR.PATCH`
for installed and previous versions; manifest requirements accept simple exact,
`^`, `~`, and comma-separated numeric comparisons. Cross-provider constraints
are evaluated against the installed, locked graph.

## Ownership and failure behaviour

The application must explicitly approve each mutable target, separate from the
provider declaration, in `.skipo/dependency-ownership.json`:

```json
{ "owners": { "src/framework/workspaces.ts": "@ultrst-armada/floks" } }
```

Both the grant and the provider migration's `ownedPaths` must contain the
**literal** target path. Pattern-based operations cannot implicitly take ownership
of unrelated files. `.skipo`, `.git`, `node_modules`, path traversal and symlink
mutations are refused. Preflight captures content and validates preconditions,
transforms and postconditions in memory before writing. The plan fingerprint
binds versions, declared ownership, previous state and file snapshots; any edit
requires re-planning.

Execution writes an on-disk `.skipo/dependency-migration-journal.json` with
base64 before-images, atomically replaces affected files, and independently
checks the final installed state before deleting the journal. In-process failures
trigger rollback. After process termination or crash, use
`recover_dependency_migrations` to restore the exact prior affected files,
then plan again. If recovery fails, the journal stays intact and execution is
blocked with explicit evidence. Successful reruns do not repeat migrations.

## Verification

Run:

```sh
python -m pytest -q tests/dependency_migration_safety_test.py
```

Fixture coverage includes successive edges, ambiguous/missing routes,
unsupported operations, unsafe symlinks, ownership refusal, stale plans,
manifest/lock/installed conflicts, provider compatibility conflicts,
injected partial-write rollback, crash-recovery journal and idempotency.