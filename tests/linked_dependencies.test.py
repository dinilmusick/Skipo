import json
import tempfile
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from skipo_builder import PackageCatalog, SkipoBuilder


def write_manifest(root: Path, package: str, filename: str, payload: dict) -> None:
    path = root / package / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def make_builder(root: Path) -> SkipoBuilder:
    builder = SkipoBuilder.__new__(SkipoBuilder)
    builder.project_root = root / "Skipo"
    builder.catalog = PackageCatalog(root / "Kloks", root / "Floks")
    return builder


def test_component_required_service_blocks_missing_backend():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        write_manifest(root / "Kloks", "packages/node", "kloks.manifest.json", {
            "services": [{"id": "node-graph", "backend": {"facade": "NodeGraphEngineServiceFacade"}}]
        })
        write_manifest(root / "Floks", "packages/canvas", "floks.manifest.json", {
            "components": [{"id": "FrnlEditableNodeGraph", "requiredServices": ["node-graph"]}]
        })
        components = root / "Skipo/src/frontend/components"
        components.mkdir(parents=True)
        (components / "components.ts").write_text(
            "export { FrnlEditableNodeGraph } from '@floks/canvas';", encoding="utf-8"
        )
        backend = root / "Skipo/src/backend"
        backend.mkdir(parents=True)
        (backend / "AppBackend.ts").write_text("export const AppBackend = {};", encoding="utf-8")

        result = make_builder(root).validate_linked_dependencies()
        assert not result["valid"]
        assert any("node-graph" in error for error in result["errors"])


def test_service_default_frontend_missing_is_warning_not_error():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        write_manifest(root / "Kloks", "packages/node", "kloks.manifest.json", {
            "services": [{
                "id": "node-graph",
                "backend": {"facade": "NodeGraphEngineServiceFacade"},
                "defaultFrontend": {"component": "FrnlEditableNodeGraph"},
            }]
        })
        write_manifest(root / "Floks", "packages/canvas", "floks.manifest.json", {
            "components": [{"id": "FrnlEditableNodeGraph"}]
        })
        components = root / "Skipo/src/frontend/components"
        components.mkdir(parents=True)
        (components / "components.ts").write_text(
            "export { Other } from '@floks/ui';", encoding="utf-8"
        )
        backend = root / "Skipo/src/backend"
        backend.mkdir(parents=True)
        (backend / "AppBackend.ts").write_text(
            "NodeGraphEngineServiceFacade", encoding="utf-8"
        )

        result = make_builder(root).validate_linked_dependencies()
        assert result["valid"]
        assert any("recommends FLOKS component" in warning for warning in result["warnings"])
