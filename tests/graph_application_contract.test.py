#!/usr/bin/env python3
import shutil
import tempfile
import unittest
from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("aspect_23", ROOT / "checklists" / "23_graph_application_contract.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
validate = MODULE.validate_graph_application_contract


class GraphApplicationContractTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="skipo_graph_contract_"))
        base = self.root / "src"
        for rel in (
            "frontend/pages/main/tabs/Garden",
            "frontend/pages/main/tabs/Garden/GardenGraph",
            "backend/services/GardenGraph/graph-definitions/editable-node-graph/connection-types",
            "backend/services/GardenGraph/graph-definitions/editable-node-graph/nodes",
            "backend/services/GardenGraph/graph-definitions/editable-node-graph/facades",
            "libraries",
        ):
            (base / rel).mkdir(parents=True, exist_ok=True)

        (base / "frontend/pages/main/tabs/Garden/Garden.tsx").write_text(
            "import { GardenGraph } from './GardenGraph/GardenGraph'; export const Garden=()=>GardenGraph;"
        )
        (base / "frontend/pages/main/tabs/Garden/GardenGraph/GardenGraph.tsx").write_text(
            "export const GardenGraph = () => null;"
        )

        domain = base / "backend/services/GardenGraph/graph-definitions/editable-node-graph"
        (domain / "connection-types/string.ts").write_text(
            "import type { GardenString } from '../../../../../../libraries/GardenConcepts'; export const gardenString = {};"
        )
        (domain / "nodes/flower-pot.ts").write_text(
            "import { gardenString } from '../facades/connection-types'; export const flowerPot = { inputs: [gardenString] };"
        )
        (domain / "facades/connection-types.ts").write_text(
            "export { gardenString } from '../connection-types/string';"
        )
        (domain / "facades/nodes.ts").write_text(
            "import { gardenString } from './connection-types'; export { flowerPot } from '../nodes/flower-pot';"
        )
        (domain / "facades/graph.ts").write_text(
            "import { gardenString } from './connection-types'; import { flowerPot } from './nodes'; export const gardenGraph = { gardenString, flowerPot };"
        )

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def test_valid_graph_and_tab_contract(self):
        result = validate(self.root)
        self.assertTrue(result.passed, [v.message for v in result.violations])

    def test_backend_graph_visual_payload_is_rejected(self):
        path = self.root / "src/backend/services/GardenGraph/graph-definitions/editable-node-graph/nodes/flower-pot.ts"
        path.write_text("export const flowerPot = { assetRef: '/pot.svg' };")
        result = validate(self.root)
        self.assertFalse(result.passed)
        self.assertIn("23.4-backend-visual-payload", {v.rule_id for v in result.violations})

    def test_semantic_type_must_live_in_libraries(self):
        path = self.root / "src/backend/services/GardenGraph/graph-definitions/editable-node-graph/nodes/flower-pot.ts"
        path.write_text("export interface FlowerPot { size: number }; export const flowerPot = {};")
        result = validate(self.root)
        self.assertFalse(result.passed)
        self.assertIn("23.3-semantic-types-outside-libraries", {v.rule_id for v in result.violations})

    def test_tab_interface_contract_is_blocking(self):
        path = self.root / "src/frontend/pages/main/tabs/Garden/GardenGraph/GardenGraph.tsx"
        path.unlink()
        result = validate(self.root)
        self.assertFalse(result.passed)
        self.assertIn("23.10-interface-component-name", {v.rule_id for v in result.violations})


if __name__ == "__main__":
    unittest.main()
