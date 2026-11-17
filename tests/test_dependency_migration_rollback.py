"""Invalid migrations must fail in preflight with zero app mutations."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from skipo_dependency_migrations import plan_dependency_migrations, execute_dependency_migrations


def test_invalid_nested_json_target_fails_preflight_without_mutation(tmp_path):
    name = "@vendor/example"
    source = tmp_path / "src/example.ts"
    source.parent.mkdir()
    source.write_text("OldFacade", encoding="utf-8")
    config = tmp_path / "config.json"
    config.write_text(json.dumps({"provider": "legacy"}), encoding="utf-8")
    (tmp_path / "package.json").write_text(json.dumps({"dependencies": {name: "^2.0.0"}}))
    (tmp_path / "package-lock.json").write_text(json.dumps({"lockfileVersion": 3,
        "packages": {"": {"dependencies": {name: "^2.0.0"}},
                     f"node_modules/{name}": {"version": "2.0.0"}}}))
    provider = tmp_path / "node_modules" / name
    provider.mkdir(parents=True)
    (provider / "package.json").write_text(json.dumps({"name": name, "version": "2.0.0",
        "skipo": {"migrationContract": "skipo.migrations.json"}}))
    (provider / "skipo.migrations.json").write_text(json.dumps({"schemaVersion": 1,
        "package": name, "migrations": [{
            "id": "upgrade", "fromVersion": "1.0.0", "toVersion": "2.0.0",
            "transformations": [
                {"type": "replace_text", "paths": ["src/**/*.ts"],
                 "find": "OldFacade", "replace": "NewFacade"},
                {"type": "set_json", "path": "config.json", "key": "provider.mode",
                 "value": "canonical"},
            ], "verification": []}]}))
    state = tmp_path / ".skipo"
    state.mkdir()
    (state / "dependencies.json").write_text(json.dumps({name: "^1.0.0",
        "_resolved": {name: "1.0.0"}}))
    (state / "migration-state.json").write_text(json.dumps({"schemaVersion": 1,
        "applied": [], "pending": []}))
    plan = plan_dependency_migrations(tmp_path)
    assert plan["ok"], plan["errors"]
    result = execute_dependency_migrations(tmp_path, plan)
    assert not result["ok"]
    assert "Expected a JSON object" in str(result["errors"])
    assert source.read_text(encoding="utf-8") == "OldFacade"
    assert json.loads(config.read_text(encoding="utf-8")) == {"provider": "legacy"}
    assert "dependencyApplied" not in json.loads((state / "migration-state.json").read_text())
    assert not (state / "dependency-migration-journal.json").exists()
