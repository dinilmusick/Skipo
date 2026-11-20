"""Real Skipo Vite target manifests must match executable provider packaging."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "scripts"))
from skipo_cli import create_project


class SkipoTargetBuildManifestTests(unittest.TestCase):
    def _contract(self, app: Path, name: str) -> dict:
        return json.loads((app / "config" / "build" / "manifests" / f"{name}.json").read_text(encoding="utf-8"))

    def test_provider_manifests_match_real_source_and_outputs(self):
        app = REPO / "scaffolds" / "vite"
        full = self._contract(app, "fullstack")
        api = self._contract(app, "api")
        self.assertEqual(full["target"], "fullstack")
        self.assertEqual(api["target"], "api")
        self.assertEqual(full["schemaVersion"], 1)
        self.assertEqual(api["schemaVersion"], 1)
        self.assertEqual(full["client"], {"entrypoint": "index.html", "outdir": "dist/client"})
        self.assertIsNone(api["client"])
        self.assertEqual(
            {p["name"] for p in full["providers"]},
            {"cloudflare", "vercel", "mcp", "node"},
        )
        self.assertEqual(
            {p["name"] for p in api["providers"]},
            {"cloudflare", "vercel", "mcp"},
        )
        for profile in (api, full):
            output_paths = [p["outfile"] for p in profile["providers"]]
            self.assertEqual(len(output_paths), len(set(output_paths)))
            for provider in profile["providers"]:
                self.assertTrue((app / provider["entrypoint"]).is_file(), provider)
                self.assertFalse(provider["entrypoint"].startswith("../"), provider)
                self.assertTrue(
                    provider["outfile"].startswith(("dist/providers/", "api/")), provider
                )
        script = (app / "scripts" / "skipo-build.mjs").read_text(encoding="utf-8")
        self.assertIn("config/build/manifests", script)
        self.assertIn("--target", script)

    def test_vercel_uses_real_canonical_node_fetch_bridge(self):
        app = REPO / "scaffolds" / "vite" / "src"
        bridge = (app / "backend" / "adapters" / "nodeBridge.ts").read_text(encoding="utf-8")
        provider = (app / "providers" / "vercel.ts").read_text(encoding="utf-8")
        real = (app / "providers" / "nodeRequestAdapter.ts").read_text(encoding="utf-8")
        self.assertIn("dispatchNodeRequest as adaptNodeRequest", bridge)
        self.assertIn("new Request(", real)
        self.assertIn("await handler(request, env)", real)
        self.assertIn("from '../backend/adapters/nodeBridge.js'", provider)
        self.assertIn("return adaptNodeRequest(", provider)
        self.assertNotIn("from './nodeRequestAdapter.js'", provider)

    def test_public_commands_and_generated_app_preserve_manifests(self):
        fixture = REPO / "scaffolds" / "vite"
        package = json.loads((fixture / "package.json").read_text(encoding="utf-8"))
        self.assertEqual(package["scripts"]["build"], "node scripts/skipo-build.mjs")
        self.assertIn("--target api", package["scripts"]["build:api"])
        self.assertIn("--target fullstack", package["scripts"]["build:fullstack"])
        with tempfile.TemporaryDirectory() as root:
            destination = Path(root) / "ManifestProbe"
            self.assertEqual(create_project("ManifestProbe", destination, "vite", False), 0)
            for name in ("api", "fullstack"):
                self.assertEqual(self._contract(destination, name), self._contract(fixture, name))
            self.assertTrue((destination / "src/backend/adapters/nodeBridge.ts").is_file())
            self.assertTrue((destination / "scripts/skipo-build.mjs").is_file())


if __name__ == "__main__":
    unittest.main()
