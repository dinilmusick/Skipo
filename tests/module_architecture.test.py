from pathlib import Path
import importlib.util
import json
import tempfile
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "checklists"))
SPEC = importlib.util.spec_from_file_location("module_architecture", ROOT / "checklists/24_module_architecture.py")
architecture = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(architecture)

def test_canonical_generic_module_surfaces_exist():
    assert (ROOT / "src/module-contract").is_dir()
    assert (ROOT / "src/module-runtime/ModuleHost.ts").is_file()
    assert (ROOT / "src/backend/ModuleBackendAdapter.ts").is_file()
    assert (ROOT / "src/frontend/components/module-ui/ModuleUIHost.tsx").is_file()

def test_no_aiko_module_is_present():
    assert not (ROOT / "src/modules/aiko").exists()

def test_fixture_manifest_is_standalone_and_generic():
    manifest = json.loads((ROOT / "tests/fixtures/generic-skipo-module/skipo.module.json").read_text())
    assert manifest["application"]["standalone"] is True
    assert manifest["application"]["moduleCapable"] is True
    assert manifest["module"]["id"] == "generic.inventory"
    assert "aiko" not in json.dumps(manifest).lower()

def test_architecture_rejects_direct_network_and_parent_imports():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "src/module-contract").mkdir(parents=True)
        (root / "src/module-runtime").mkdir(parents=True)
        (root / "src/backend").mkdir(parents=True)
        (root / "src/frontend/components/module-ui").mkdir(parents=True)
        (root / "src/module-runtime/ModuleHost.ts").write_text("host")
        (root / "src/backend/ModuleBackendAdapter.ts").write_text("adapter")
        (root / "src/frontend/components/module-ui/ModuleUIHost.tsx").write_text("ui")
        candidate = root / "src/modules/demo"; candidate.mkdir(parents=True)
        (candidate / "skipo.module.json").write_text(json.dumps({
            "module":{"id":"demo"},"application":{"standalone":True,"moduleCapable":True},"capabilities":[],"ui":{"exports":[]}
        }))
        (candidate / "entry.ts").write_text("import x from '../../../src/backend/BackendFacade.js'; fetch('/api/x');")
        result = architecture.validate_module_architecture(root)
        assert not result.passed
        messages = "\n".join(v.message for v in result.violations)
        assert "bypass" in messages or "network" in messages
