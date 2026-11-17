# Skipo dependency migrations — standalone API

This engine applies **package-shipped declarative** contracts for approved providers (Kloks, Floks, KrnlTS, FrnlTS and other integrated packages). It never executes provider shell scripts or arbitrary code and does not install packages itself. Dependency installation and regeneration of the lockfile must be completed first.

## Contract

A provider package's package.json declares skipo.migrationContract (relative to its own installed package); conventionally skipo.migrations.json is used. The contract has schemaVersion: 1, an exact package identity, optional compatibility.skipo / compatibility.dependencies ranges, and a migrations array. Each migration has a unique id, fromVersion, toVersion, optional dependsOn (package-qualified for cross-package dependencies), requiresDependencies, preconditions, transformations, repair, verification, deprecatedPatterns, and canonicalReplacements.

Permitted transformations: replace_text (paths, find, replace, optional expectedMatches) and set_json (path, key, value, optional expectedOld). Preconditions and postconditions: text_present, text_absent, and json_equals. No shell operations, path traversal, symlinks, or provider rewrites of package manifests, lockfiles, node_modules, .git or .skipo are permitted. Paths/patterns must be package-defined and explicit. Unmatched application-owned files are preserved.

A provider migration must list each possible mutation target as a literal path in its `ownedPaths` array. The application must grant the same paths to that package in `.skipo/dependency-ownership.json`:

```json
{
  "owners": {
    "src/framework/workspaces.ts": "@ultrst-armada/kloks"
  }
}
```

Keep transformation patterns scoped to granted files. An ungranted match blocks the plan. Skipo seals the grant file with the plan and checks ownership again during execution and terminal migration verification. Existing mutation contracts need literal path declarations and corresponding app grants before use.

Versions are concrete semantic release numbers (one to three numeric components) without prerelease or wildcards; migration resolution is exact. Missing edges, multiple paths, invalid operations and incompatible provider ranges block; the engine never selects one of multiple valid routes arbitrarily. The installed package name/version must agree with package.json and the **single** npm v2/v3 lockfile (package-lock.json or npm-shrinkwrap.json) or pnpm v6/v9 lockfile. Unsupported managers and inconsistent, absent or stale lockfiles stop safely.

## Public callable API

    from pathlib import Path
    from skipo_dependency_migrations import (
        plan_dependency_migrations, execute_dependency_migrations,
        verify_dependency_migrations, recover_dependency_migrations,
    )
    root = Path('/path/to/app')
    plan = plan_dependency_migrations(root, skipo_version='1.1.0')
    if not plan['ok']:
        raise RuntimeError(plan['errors'])
    result = execute_dependency_migrations(root, plan)
    assert result['ok'] and verify_dependency_migrations(root)['ok']

plan_dependency_migrations is read-only and emits the ordered route, immutable input hashes, exact resolved versions, compatibility diagnostics and sealed planId. execute_dependency_migrations rejects altered or stale plans; it preflights all operations on a scratch copy before application mutation. It then writes a durable journal under .skipo/, commits using atomic per-file replacements, verifies independently and removes the journal. Failure restores all affected original bytes, reporting conflicts when recovery is not possible. On process interruption, run recover_dependency_migrations(root) **before** planning again. Recovery refuses to overwrite unrelated edits. Re-executing the same successful plan is a verified no-op.

Receipts include actions, changedFiles, verified, errors, rollback, recovery, integrity and planId as applicable. The reconciler should treat ok: false as a hard gate, never infer success from an empty action array, and persist receipts as evidence. It must not repair unrelated app files or modify dependency manifests itself.

## Independent tests

    python -m pytest -q tests/test_dependency_migration_contract.py tests/test_dependency_migration_rollback.py tests/test_dependency_migration_safety.py

Failure injection is provided exclusively through the callable execute_dependency_migrations(root, plan, fail_at='after_write:0') interface for tests. No change to Skipo's shared CLI, orchestration, workflows or other agents' owned files is required.
