import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import skipo_capabilities
import skipo_reconciliation


def project(root, *, installed=None, dependencies=None, generated=None, version="1.1.0"):
    (root / "package.json").write_text(json.dumps({"name": "demo", "dependencies": dependencies or {}}, indent=2) + "\n")
    state = root / ".skipo"
    state.mkdir()
    (state / "project.json").write_text(json.dumps({"framework": "skipo", "skipo_version": version}, indent=2) + "\n")
    (state / "capabilities.json").write_text(json.dumps({
        "schemaVersion": 1, "installed": installed or {}, "generated": generated or []
    }, indent=2) + "\n")
    (state / "dependencies.json").write_text(json.dumps({}, indent=2) + "\n")
    (state / "overrides.json").write_text(json.dumps({"schemaVersion": 1, "capabilities": {}}, indent=2) + "\n")
    (state / "migration-state.json").write_text(json.dumps({"schemaVersion": 1, "applied": [], "pending": []}, indent=2) + "\n")


def snapshot(root):
    return {
        p.relative_to(root).as_posix(): p.read_bytes()
        for p in sorted(root.rglob("*"))
        if p.is_file()
    }


def test_clean_state_remains_byte_for_byte_unchanged():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        project(root)
        before = snapshot(root)
        result = skipo_reconciliation.reconcile(root, apply=True, framework_version="1.1.0")
        assert result["ok"], result
        assert result["actions"] == []
        assert snapshot(root) == before


def test_known_dirty_state_is_repaired_deterministically():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        project(root, installed={"workspace": {"kind": "capability"}})
        obsolete = root / "src/frontend/components/WorkspaceCreateDialog.tsx"
        obsolete.parent.mkdir(parents=True)
        obsolete.write_text("export function WorkspaceCreateDialog(){ return null }")
        result = skipo_reconciliation.reconcile(root, apply=True, framework_version="1.1.0")
        assert result["ok"], result
        assert not obsolete.exists()
        assert (root / "src/libraries/skipo/workspace.ts").read_text() == (
            "export { WorkspaceTilesMenu } from '@ultrst-armada/floks/ui';\n"
            "export { WorkspaceServiceFacade, WorkspaceBackendFacade } from '@ultrst-armada/kloks/backend';\n"
        )
        package = json.loads((root / "package.json").read_text())
        assert package["dependencies"]["@ultrst-armada/floks"] == "^2.0.0"
        assert package["dependencies"]["@ultrst-armada/kloks"] == "^2.0.4"
        assert skipo_capabilities.verify(root)["ok"]


def test_repeated_repair_is_idempotent():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        project(root, installed={"workspace": {"kind": "capability"}})
        first = skipo_reconciliation.reconcile(root, apply=True, framework_version="1.1.0")
        assert first["ok"], first
        after_first = snapshot(root)
        second = skipo_reconciliation.reconcile(root, apply=True, framework_version="1.1.0")
        assert second["ok"], second
        assert second["actions"] == []
        assert snapshot(root) == after_first


def test_ambiguous_or_unowned_repairs_fail_closed_without_partial_writes():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        project(
            root,
            installed={"workspace": {"kind": "capability"}},
            dependencies={"@ultrst-armada/floks": "^1.0.0"},
        )
        generated = root / "src/libraries/skipo/workspace.ts"
        generated.parent.mkdir(parents=True)
        generated.write_text("application-owned implementation")
        before = snapshot(root)
        result = skipo_reconciliation.reconcile(root, apply=True, framework_version="1.1.0")
        assert not result["ok"]
        assert result["applied"] is False
        assert result["conflicts"]
        assert snapshot(root) == before


def test_only_explicitly_classified_obsolete_implementations_are_removed():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        project(root)
        explicit = root / "src/frontend/components/WorkspaceCreateDialog.tsx"
        explicit.parent.mkdir(parents=True)
        explicit.write_text("export function WorkspaceCreateDialog(){ return null }")
        application = root / "src/frontend/pages/home/page.tsx"
        application.parent.mkdir(parents=True)
        application.write_text("export function Home(){ return <WorkspaceTilesMenu /> }")
        result = skipo_reconciliation.reconcile(root, apply=True, framework_version="1.1.0")
        assert result["ok"], result
        assert not explicit.exists()
        assert application.exists()


def test_verification_failure_is_reported_after_repair():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        project(root, installed={"workspace": {"kind": "capability"}})
        original = skipo_reconciliation.capabilities.verify
        skipo_reconciliation.capabilities.verify = lambda _root: {
            "ok": False, "errors": ["simulated post-repair invariant failure"]
        }
        try:
            result = skipo_reconciliation.reconcile(root, apply=True, framework_version="1.1.0")
        finally:
            skipo_reconciliation.capabilities.verify = original
        assert not result["ok"]
        assert result["verification"]["errors"] == ["simulated post-repair invariant failure"]
