"""Independent integration fixtures for the fail-closed package migration runtime."""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from skipo_dependency_safety import (  # noqa: E402
    MigrationError, exact_version, validate_contract, resolve_path,
    plan_dependency_migrations, execute_dependency_migrations,
    verify_dependency_migrations, recover_dependency_migrations,
)

PACKAGE = "@ultrst-armada/floks"

def write(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2), encoding="utf-8")

def fixture(tmp_path, *, package=PACKAGE, old="1.0.0", current="1.2.0", grants=True):
    dep = "^1.2.0" if current == "1.2.0" else f"^{current}"
    write(tmp_path / "package.json", {"dependencies": {package: dep}})
    write(tmp_path / "package-lock.json", {"lockfileVersion": 3, "packages": {
        "": {"dependencies": {package: dep}},
        f"node_modules/{package}": {"version": current}}})
    pkg = tmp_path / "node_modules" / package
    write(pkg / "package.json", {"name": package, "version": current,
                                 "skipo": {"migrationContract": "skipo.migrations.json"}})
    write(tmp_path / ".skipo/dependencies.json", {package: "^1.0.0", "_resolved": {package: old}})
    if grants:
        write(tmp_path / ".skipo/dependency-ownership.json", {"owners": {"src/canonical.ts": package}})
    (tmp_path / "src").mkdir(exist_ok=True)
    (tmp_path / "src/canonical.ts").write_text("legacy_A", encoding="utf-8")
    (tmp_path / "src/unknown.ts").write_text("do not change legacy_A", encoding="utf-8")
    return pkg

def edge(id_, source, target, find, replace):
    return {"id": id_, "fromVersion": source, "toVersion": target,
            "ownedPaths": ["src/canonical.ts"],
            "preconditions": [{"type": "text_present", "text": find, "paths": ["src/canonical.ts"]}],
            "transformations": [{"type": "replace_text", "find": find, "replace": replace,
                                 "paths": ["src/canonical.ts"]}],
            "verification": [{"type": "text_present", "text": replace, "paths": ["src/canonical.ts"]},
                             {"type": "text_absent", "text": find, "paths": ["src/canonical.ts"]}]}

def contract(pkg, migrations=None):
    obj = {"schemaVersion": 1, "package": PACKAGE,
           "migrations": migrations if migrations is not None else [
               edge("v1-v11", "1.0.0", "1.1.0", "legacy_A", "intermediate_B"),
               edge("v11-v12", "1.1.0", "1.2.0", "intermediate_B", "canonical_C")
           ]}
    write(pkg / "skipo.migrations.json", obj)
    return obj

def test_successive_versions_verification_and_idempotency(tmp_path):
    pkg = fixture(tmp_path)
    contract(pkg)
    plan = plan_dependency_migrations(tmp_path)
    assert plan["ok"], plan["errors"]
    assert [m["contractId"] for m in plan["migrations"]] == ["v1-v11", "v11-v12"]
    receipt = execute_dependency_migrations(tmp_path, plan)
    assert receipt["ok"] and receipt["verified"]
    assert (tmp_path / "src/canonical.ts").read_text() == "canonical_C"
    assert (tmp_path / "src/unknown.ts").read_text() == "do not change legacy_A"
    assert verify_dependency_migrations(tmp_path)["ok"]
    again = plan_dependency_migrations(tmp_path)
    assert again["ok"] and not again["migrations"]
    assert execute_dependency_migrations(tmp_path, again)["ok"]

def test_missing_contract_fails_closed(tmp_path):
    fixture(tmp_path)
    plan = plan_dependency_migrations(tmp_path)
    assert not plan["ok"] and "Missing package-shipped" in str(plan["errors"])
    assert (tmp_path / "src/canonical.ts").read_text() == "legacy_A"

def test_missing_intermediate_edge_fails_closed(tmp_path):
    pkg = fixture(tmp_path)
    contract(pkg, [edge("first", "1.0.0", "1.1.0", "legacy_A", "intermediate_B")])
    assert "Missing migration edge" in str(plan_dependency_migrations(tmp_path)["errors"])

def test_ambiguous_paths_rejected(tmp_path):
    pkg = fixture(tmp_path)
    obj = contract(pkg, [
        edge("jump", "1.0.0", "1.2.0", "legacy_A", "canonical_C"),
        edge("first", "1.0.0", "1.1.0", "legacy_A", "intermediate_B"),
        edge("second", "1.1.0", "1.2.0", "intermediate_B", "canonical_C")])
    with pytest.raises(MigrationError, match="Ambiguous"):
        resolve_path(obj, "1.0.0", "1.2.0")
    assert not plan_dependency_migrations(tmp_path)["ok"]

def test_recovery_after_injected_partial_failure(tmp_path):
    pkg = fixture(tmp_path)
    contract(pkg)
    plan = plan_dependency_migrations(tmp_path)
    response = execute_dependency_migrations(tmp_path, plan, fail_after_writes=1)
    assert not response["ok"] and response["rollback"]["ok"]
    assert (tmp_path / "src/canonical.ts").read_text() == "legacy_A"
    assert not (tmp_path / ".skipo/dependency-migration-journal.json").exists()
    assert execute_dependency_migrations(tmp_path, plan)["ok"]

def test_stale_plan_rejected(tmp_path):
    pkg = fixture(tmp_path)
    contract(pkg)
    plan = plan_dependency_migrations(tmp_path)
    (tmp_path / "src/canonical.ts").write_text("unexpected concurrent edit")
    result = execute_dependency_migrations(tmp_path, plan)
    assert not result["ok"] and "Stale" in str(result["errors"])
    assert (tmp_path / "src/canonical.ts").read_text() == "unexpected concurrent edit"

def test_conflicting_manifest_lock_and_installed_versions(tmp_path):
    pkg = fixture(tmp_path)
    contract(pkg)
    write(pkg / "package.json", {"name": PACKAGE, "version": "1.1.0"})
    assert "Installed package/lockfile mismatch" in str(plan_dependency_migrations(tmp_path)["errors"])

def test_conflicting_provider_compatibility(tmp_path):
    pkg = fixture(tmp_path)
    obj = contract(pkg)
    obj["compatibility"] = {"dependencies": {"@ultrst-armada/kloks": "^3.0.0"}}
    write(pkg / "skipo.migrations.json", obj)
    assert "Incompatible provider dependency" in str(plan_dependency_migrations(tmp_path)["errors"])

def test_missing_ownership_grant_blocks_unknown_app_files(tmp_path):
    pkg = fixture(tmp_path, grants=False)
    contract(pkg)
    plan = plan_dependency_migrations(tmp_path)
    assert not plan["ok"] and "Unowned migration target" in str(plan["errors"])

def test_symlink_to_external_app_file_rejected(tmp_path):
    pkg = fixture(tmp_path)
    contract(pkg)
    outside = tmp_path.parent / (tmp_path.name + "-outside.txt")
    outside.write_text("legacy_A")
    (tmp_path / "src/canonical.ts").unlink()
    (tmp_path / "src/canonical.ts").symlink_to(outside)
    assert not plan_dependency_migrations(tmp_path)["ok"]
    assert outside.read_text() == "legacy_A"

def test_invalid_script_and_traversal_rejected(tmp_path):
    pkg = fixture(tmp_path)
    obj = contract(pkg)
    obj["migrations"][0]["script"] = "rm -rf ."
    with pytest.raises(MigrationError, match="forbidden"):
        validate_contract(obj, PACKAGE)
    del obj["migrations"][0]["script"]
    obj["migrations"][0]["transformations"][0]["paths"] = ["../outside.ts"]
    with pytest.raises(MigrationError, match="Unsafe"):
        validate_contract(obj, PACKAGE)

def test_unstable_or_unknown_versions_not_inferred():
    for v in ("latest", "1.2", "v1.2.3", ">=1.2.3", "1.2.3.4", "1.2.3-beta.1"):
        with pytest.raises(MigrationError): exact_version(v)

def test_recovered_preexisting_transaction(tmp_path):
    pkg = fixture(tmp_path)
    contract(pkg)
    plan = plan_dependency_migrations(tmp_path)
    # Interrupted journal can be recovered without applying anything.
    import base64
    snapshot = {"src/canonical.ts": base64.b64encode(b"legacy_A").decode()}
    write(tmp_path / ".skipo/dependency-migration-journal.json", {"schemaVersion": 1, "before": snapshot})
    (tmp_path / "src/canonical.ts").write_text("partially modified")
    assert not plan_dependency_migrations(tmp_path)["ok"]
    assert recover_dependency_migrations(tmp_path)["recovered"]
    assert (tmp_path / "src/canonical.ts").read_text() == "legacy_A"
    assert execute_dependency_migrations(tmp_path, plan)["ok"]


def test_verifier_detects_revoked_ownership(tmp_path):
    pkg = fixture(tmp_path)
    contract(pkg)
    plan = plan_dependency_migrations(tmp_path)
    assert execute_dependency_migrations(tmp_path, plan)["ok"]
    write(tmp_path / ".skipo/dependency-ownership.json", {"owners": {}})
    check = verify_dependency_migrations(tmp_path)
    assert not check["ok"] and "Lost migration ownership grant" in str(check["errors"])


def test_mixed_lockfile_managers_rejected(tmp_path):
    pkg = fixture(tmp_path)
    contract(pkg)
    (tmp_path / "pnpm-lock.yaml").write_text("lockfileVersion: 9")
    plan = plan_dependency_migrations(tmp_path)
    assert not plan["ok"] and "package manager lockfile" in str(plan["errors"])