#!/usr/bin/env python3
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("graph_assets", ROOT / "scripts" / "generate_graph_assets.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class GraphAssetGeneratorTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="skipo_graph_assets_"))
        self.manifest = self.root / "graph.json"
        self.manifest.write_text(json.dumps({
            "graph": {
                "id": "garden.graph",
                "name": "Garden Graph",
                "connectionTypes": [{"id": "water"}],
                "nodes": [{"id": "flower-pot"}]
            }
        }), encoding="utf-8")

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def test_generation_uses_canonical_tab_and_interface_paths(self):
        files = MODULE.generate(self.manifest, self.root, "Garden", "GardenGraph")
        target = self.root / "src/frontend/pages/main/tabs/Garden/GardenGraph"
        self.assertIn(target / "GardenGraph.tsx", files)
        self.assertTrue((target / "GardenGraph.tsx").is_file())
        self.assertTrue((target / "graph-assets.manifest.json").is_file())
        text = (target / "GardenGraph.tsx").read_text(encoding="utf-8")
        self.assertIn("nodes: GraphNode[]", text)
        self.assertIn("edges: GraphEdge[]", text)
        self.assertNotIn("assetRef", text)

    def test_noncanonical_names_are_rejected(self):
        with self.assertRaises(ValueError):
            MODULE.generate(self.manifest, self.root, "garden", "GardenGraph")


    def test_regeneration_is_idempotent_and_updates_only_owned_metadata(self):
        files = MODULE.generate(self.manifest, self.root, "Garden", "GardenGraph")
        before = {path: path.read_text() for path in files}
        self.assertEqual(MODULE.generate(self.manifest, self.root, "Garden", "GardenGraph"), files)
        self.assertEqual({path: path.read_text() for path in files}, before)
        graph = json.loads(self.manifest.read_text())
        graph["graph"]["nodes"].append({"id": "water-source"})
        self.manifest.write_text(json.dumps(graph))
        MODULE.generate(self.manifest, self.root, "Garden", "GardenGraph")
        self.assertEqual(files[0].read_text(), before[files[0]])
        self.assertEqual(files[1].read_text(), before[files[1]])
        self.assertIn("water-source", files[2].read_text())

    def test_user_edited_interface_is_not_overwritten_or_partially_updated(self):
        files = MODULE.generate(self.manifest, self.root, "Garden", "GardenGraph")
        files[0].write_text("// app-owned graph logic")
        saved = {file: file.read_text() for file in files}
        graph = json.loads(self.manifest.read_text())
        graph["graph"]["nodes"].append({"id": "changed"})
        self.manifest.write_text(json.dumps(graph))
        with self.assertRaisesRegex(ValueError, "modified graph interface"):
            MODULE.generate(self.manifest, self.root, "Garden", "GardenGraph")
        self.assertEqual({file: file.read_text() for file in files}, saved)

    def test_app_owned_metadata_is_not_overwritten(self):
        files = MODULE.generate(self.manifest, self.root, "Garden", "GardenGraph")
        own = {"generatedBy": "app-owner", "graphId": "garden.graph"}
        files[2].write_text(json.dumps(own))
        with self.assertRaisesRegex(ValueError, "non-generated graph asset metadata"):
            MODULE.generate(self.manifest, self.root, "Garden", "GardenGraph")
        self.assertEqual(json.loads(files[2].read_text()), own)

    def test_malformed_graph_is_rejected_before_any_output(self):
        graph = json.loads(self.manifest.read_text())
        graph["graph"]["connectionTypes"] = ["malformed-id"]
        self.manifest.write_text(json.dumps(graph))
        with self.assertRaisesRegex(ValueError, "connectionTypes"):
            MODULE.generate(self.manifest, self.root, "Garden", "GardenGraph")
        self.assertFalse((self.root / "src/frontend").exists())

    def test_interrupted_write_is_rolled_back(self):
        target = self.root / "src/frontend/pages/main/tabs/Garden/GardenGraph"
        metadata = target / "graph-assets.manifest.json"
        real_write = Path.write_text
        triggered = False

        def fail_once(file, data, *args, **kwargs):
            nonlocal triggered
            if file == metadata and not triggered:
                triggered = True
                real_write(file, "partial", *args, **kwargs)
                raise OSError("simulated interrupted write")
            return real_write(file, data, *args, **kwargs)

        with patch.object(Path, "write_text", fail_once):
            with self.assertRaisesRegex(OSError, "rolled back"):
                MODULE.generate(self.manifest, self.root, "Garden", "GardenGraph")
        self.assertTrue(triggered)
        self.assertFalse((target / "GardenGraph.tsx").exists())
        self.assertFalse(metadata.exists())
        self.assertFalse((target.parent / "Garden.tsx").exists())

    def test_symlinked_destination_cannot_escape_root(self):
        other = self.root / "outside"
        other.mkdir()
        tab_parent = self.root / "src/frontend/pages/main"
        tab_parent.mkdir(parents=True)
        try:
            (tab_parent / "tabs").symlink_to(other, target_is_directory=True)
        except (OSError, NotImplementedError):
            self.skipTest("Symlinks unsupported")
        with self.assertRaisesRegex(ValueError, "escapes the application root"):
            MODULE.generate(self.manifest, self.root, "Garden", "GardenGraph")
        self.assertFalse((other / "Garden").exists())


if __name__ == "__main__":
    unittest.main()
