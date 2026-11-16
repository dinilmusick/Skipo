import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from skipo_maintenance import build_plan, execute_plan, inspect, verify
from skipo_state_registry import load_registry
import skipo_cli as cli

CANONICAL = load_registry()["applicationState"]
MIGRATION_IDS = ["1.1.0-capability-composition"]


def make_app(tmp_path, version="1.1.0", dependencies=None, migration_applied=True, lockfile=True):
    (tmp_path / "package.json").write_text(json.dumps({
        "name": "maintenance-fixture",
        "packageManager": "pnpm@10.33.0",
        "engines": {"node": ">=22"},
        "dependencies": dependencies if dependencies is not None else dict(CANONICAL["dependencies"]),
    }), encoding="utf-8")
    state = tmp_path / ".skipo"
    state.mkdir()
    (state / "project.json").write_text(json.dumps({
        "framework": "skipo", "skipo_version": version, "generated_by": "skipo",
    }), encoding="utf-8")
    (state / "capabilities.json").write_text(json.dumps({
        "schemaVersion": 1, "installed": {}, "generated": [],
    }), encoding="utf-8")
    (state / "dependencies.json").write_text(json.dumps(CANONICAL["dependencies"]), encoding="utf-8")
    (state / "migration-state.json").write_text(json.dumps({
        "schemaVersion": 1,
        "applied": MIGRATION_IDS if migration_applied else [],
        "pending": [],
    }), encoding="utf-8")
    if lockfile:
        (tmp_path / "pnpm-lock.yaml").write_text("lockfileVersion: '9.0'\n", encoding="utf-8")
    return tmp_path


def environment_ok():
    return {"node": "v22.12.0", "pnpm": "10.33.0", "npm": "10.9.0", "yarn": None}


def sync_lockfile(root, package):
    (root / "pnpm-lock.yaml").write_text("lockfileVersion: '9.0'\n", encoding="utf-8")
    return {"ok": True, "command": ["pnpm", "install", "--lockfile-only"]}


def test_clean_application_has_deterministic_empty_plan(tmp_path):
    root = make_app(tmp_path)
    first = build_plan(root, "1.1.0", environment_ok(), git_status="")
    second = build_plan(root, "1.1.0", environment_ok(), git_status="")
    assert first["ok"]
    assert first["actions"] == []
    assert first["actions"] == second["actions"]
    assert execute_plan(root, first, "1.1.0")["ok"]


def test_outdated_application_updates_framework_and_dependencies(tmp_path):
    root = make_app(tmp_path, version="1.0.0", dependencies={},
                    migration_applied=False)
    legacy = root / "src/module-runtime"
    legacy.mkdir(parents=True)
    (legacy / "legacy.ts").write_text("legacy", encoding="utf-8")
    plan = build_plan(root, "1.1.0", environment_ok(), git_status="")
    assert plan["ok"]
    assert any(a["action"] == "framework" for a in plan["actions"])
    assert any(a["action"] == "dependency" for a in plan["actions"])
    result = execute_plan(root, plan, "1.1.0", sync_lockfile)
    assert result["ok"], result
    assert not legacy.exists()
    assert json.loads((root / "package.json").read_text())["dependencies"] == CANONICAL["dependencies"]


def test_dirty_application_is_observed_but_never_mutated(tmp_path):
    root = make_app(tmp_path, version="1.0.0", dependencies={})
    before = (root / "package.json").read_text()
    plan = build_plan(root, "1.1.0", environment_ok(), git_status=" M src/app.ts")
    assert not plan["ok"]
    assert any("Working tree is dirty" in error for error in plan["errors"])
    result = execute_plan(root, plan, "1.1.0", sync_lockfile)
    assert not result["ok"]
    assert (root / "package.json").read_text() == before


def test_dependency_migration_is_explicit_and_updates_lockfile(tmp_path):
    root = make_app(tmp_path, dependencies={"@ultrst-armada/kloks": "^1.0.0"})
    plan = build_plan(root, "1.1.0", environment_ok(), git_status="")
    dependency_action = next(
        a for a in plan["actions"]
        if a["action"] == "dependency" and a["package"] == "@ultrst-armada/kloks"
    )
    assert dependency_action["package"] == "@ultrst-armada/kloks"
    assert dependency_action["to"] == CANONICAL["dependencies"]["@ultrst-armada/kloks"]
    result = execute_plan(root, plan, "1.1.0", sync_lockfile)
    assert result["ok"], result
    assert (root / "pnpm-lock.yaml").is_file()


def test_environment_violation_blocks_mutation(tmp_path):
    root = make_app(tmp_path, version="1.0.0", dependencies={})
    before = (root / "package.json").read_text()
    bad_environment = {"node": "v18.0.0", "pnpm": "9.0.0", "npm": None, "yarn": None}
    plan = build_plan(root, "1.1.0", bad_environment, git_status="")
    assert not plan["ok"]
    assert any("Node" in error for error in plan["errors"])
    assert any("pnpm@10.33.0" in error for error in plan["errors"])
    result = execute_plan(root, plan, "1.1.0", sync_lockfile)
    assert not result["applied"]
    assert (root / "package.json").read_text() == before


def test_already_current_application_verifies_without_mutation(tmp_path):
    root = make_app(tmp_path)
    plan = build_plan(root, "1.1.0", environment_ok(), git_status="")
    assert plan["ok"] and plan["actions"] == []
    result = execute_plan(root, plan, "1.1.0")
    assert result["ok"], result
    assert verify(root, "1.1.0")["ok"]


def test_failed_independent_verification_fails_update(tmp_path):
    root = make_app(tmp_path, lockfile=False)
    plan = build_plan(root, "1.1.0", environment_ok(), git_status="")
    result = execute_plan(root, plan, "1.1.0",
                          lambda _root, _package: {"ok": True, "command": ["fake-sync"]})
    assert not result["ok"]
    assert any("Canonical lockfile missing" in error for error in result["errors"])


def test_repeated_update_is_idempotent(tmp_path):
    root = make_app(tmp_path, lockfile=False)
    first_plan = build_plan(root, "1.1.0", environment_ok(), git_status="")
    first = execute_plan(root, first_plan, "1.1.0", sync_lockfile)
    assert first["ok"], first
    second_plan = build_plan(root, "1.1.0", environment_ok(), git_status="")
    assert second_plan["ok"]
    assert second_plan["actions"] == []
    second = execute_plan(root, second_plan, "1.1.0")
    assert second["ok"], second


def test_cli_routes_diagnose_plan_update_and_verify_through_maintenance():
    assert cli.maintenance_plan is build_plan
    assert cli.execute_maintenance_plan is execute_plan
    assert cli.maintenance_verify is verify
    assert cli.maintenance_inspect is inspect


def test_recorded_migration_with_remaining_legacy_path_is_reconciled(tmp_path):
    root = make_app(tmp_path, migration_applied=True)
    legacy = root / "src/module-runtime"
    legacy.mkdir(parents=True)
    (legacy / "legacy.ts").write_text("legacy", encoding="utf-8")
    plan = build_plan(root, "1.1.0", environment_ok(), git_status="")
    assert plan["ok"]
    assert any(a["action"] == "migration" for a in plan["actions"])
    result = execute_plan(root, plan, "1.1.0")
    assert result["ok"], result
    assert not legacy.exists()
