#!/usr/bin/env python3
"""
scaffold_regression.py - Regression test runner for Skipo scaffolds and contracts.
Validates:
a) No file in scaffolds references generic DATABASE_URL.
b) All external UI imports resolve to approved package exports.
c) LoginGate and WorkspaceGate exist and import canonical FLOKS components.
d) UI contracts enforce REQUIRED vs OPTIONAL rules.
e) Full system validator passes cleanly with exit 0.
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKIPO_ROOT = HERE.parent


class ScaffoldRegressionTest(unittest.TestCase):

    def test_canonical_scaffolds_no_database_url(self):
        """Scaffolds must NEVER reference generic DATABASE_URL."""
        for scaffold_name in ["vite", "nextjs"]:
            scaffold_dir = SKIPO_ROOT / "scaffolds" / scaffold_name
            self.assertTrue(scaffold_dir.exists(), f"Scaffold {scaffold_name} missing")
            for root, _, files in os.walk(scaffold_dir):
                for f in files:
                    if f.endswith((".ts", ".tsx", ".js", ".jsx", ".env", ".example")):
                        fp = Path(root) / f
                        text = fp.read_text(encoding="utf-8", errors="ignore")
                        for i, line in enumerate(text.splitlines(), start=1):
                            if "DATABASE_URL" in line and not line.strip().startswith(("//", "#")):
                                if "obsolete" in line.lower() and "forbidden" in line.lower():
                                    continue
                                clean = re.sub(r"SYSTEM_DATABASE_URL(?:_[123])?", "", line)
                                self.assertNotIn(
                                    "DATABASE_URL",
                                    clean,
                                    f"Forbidden DATABASE_URL at {fp.relative_to(SKIPO_ROOT)}:{i}",
                                )

    def test_frontend_plane_is_pages_and_components_only(self):
        """Scaffolds must keep the frontend root limited to pages/ and components/."""
        for scaffold_name in ["vite", "nextjs"]:
            frontend = SKIPO_ROOT / "scaffolds" / scaffold_name / "src" / "frontend"
            children = sorted(
                entry.name for entry in frontend.iterdir()
                if entry.is_dir() and not entry.name.startswith(".")
            )
            self.assertEqual(children, ["components", "pages"])
            self.assertFalse((SKIPO_ROOT / "scaffolds" / scaffold_name / "src" / "frontend-state").exists())
            self.assertTrue((frontend / "components" / "components.ts").exists())
            page = frontend / "pages" / "home" / "page.tsx"
            self.assertTrue(page.exists())
            self.assertIn("components/components.js", page.read_text(encoding="utf-8"))
            self.assertTrue((frontend / "pages" / "home" / "orchestrations").exists())

    def test_fetch_provider_contract_exists_without_aiko_or_audio_runtime(self):
        """Templates expose one Fetch app and keep Node startup out of edge adapters."""
        for scaffold_name in ["vite", "nextjs"]:
            base = SKIPO_ROOT / "scaffolds" / scaffold_name
            app = base / "src/app.ts"
            cloudflare = base / "src/providers/cloudflare.ts"
            vercel = base / "src/providers/vercel.ts"
            node = base / "src/providers/node.ts"
            backend = base / "src/backend/AppBackend.ts"
            universal_backend = base / "src/backend/UniversalBackend.ts"
            main_page = base / "src/frontend/pages/main/page.tsx"
            fetch_adapter = base / "src/backend/adapters/httpsAdapter.ts"
            accounts_page = base / "src/frontend/pages/settings/tabs/accounts/page.tsx"
            provider_manifest = base / "skipo.providers.json"
            vercel_config = base / "vercel.json"
            pnpm_workspace = base / "pnpm-workspace.yaml"

            for required in (app, cloudflare, vercel, node, backend, universal_backend, main_page, fetch_adapter, accounts_page, provider_manifest, vercel_config, pnpm_workspace):
                self.assertTrue(required.is_file(), f"Missing provider contract file: {required.relative_to(SKIPO_ROOT)}")

            app_source = app.read_text(encoding="utf-8")
            cloudflare_source = cloudflare.read_text(encoding="utf-8")
            vercel_source = vercel.read_text(encoding="utf-8")
            node_source = node.read_text(encoding="utf-8")
            backend_source = backend.read_text(encoding="utf-8")
            universal_backend_source = universal_backend.read_text(encoding="utf-8")
            main_source = main_page.read_text(encoding="utf-8")
            fetch_adapter_source = fetch_adapter.read_text(encoding="utf-8")
            accounts_source = accounts_page.read_text(encoding="utf-8")
            providers = json.loads(provider_manifest.read_text(encoding="utf-8"))
            vercel = json.loads(vercel_config.read_text(encoding="utf-8"))
            pnpm_config = pnpm_workspace.read_text(encoding="utf-8")

            self.assertIn("export async function fetch(", app_source)
            self.assertIn("request: Request", app_source)
            self.assertIn("Promise<Response>", app_source)
            self.assertIn("externalInterfaces.mcp(request)", app_source)
            self.assertIn("externalInterfaces.http(request)", app_source)
            self.assertIn("externalInterfaces.mcp(request)", fetch_adapter_source)
            self.assertIn("externalInterfaces.http(request)", fetch_adapter_source)
            self.assertNotIn("Sync from SRKL", accounts_source)
            self.assertIn("connected identity", accounts_source)
            self.assertEqual(providers["providers"]["vercel"]["output"], "api/[...path].js")
            self.assertEqual(providers["providers"]["vercel"]["additionalOutputs"], ["api/mcp.js"])
            self.assertEqual({"/api/:path*": "/api/[...path]", "/mcp": "/api/mcp"}, {r["source"]: r["destination"] for r in vercel["rewrites"]})
            self.assertIn("allowBuilds:", pnpm_config)
            self.assertIn("  esbuild: true", pnpm_config)
            self.assertIn("  msgpackr-extract: true", pnpm_config)
            self.assertNotIn("node:", cloudflare_source)
            self.assertNotIn("node:", vercel_source)
            self.assertIn("node:http", node_source)
            self.assertNotIn("Aiko", backend_source + main_source)
            self.assertNotIn("FOD", backend_source + main_source)
            self.assertNotIn("audio-midi", backend_source + universal_backend_source)
            self.assertNotIn("@ultrst-armada/kloks/services", universal_backend_source)
            self.assertNotIn("ServiceAFacade", universal_backend_source)
            self.assertNotIn("ServiceBFacade", universal_backend_source)
            self.assertNotIn("AudioHardwareServiceFacade", backend_source)
            self.assertNotIn("MidiServiceFacade", backend_source)

            self.assertFalse((base / "src/backend/aikoRuntime.ts").exists())
            self.assertFalse((base / "src/frontend/pages/main/tabs/aiko").exists())
            self.assertFalse((base / "src/frontend/pages/main/tabs/fod").exists())
        self.assertFalse((SKIPO_ROOT / "scaffolds/nextjs/app/api/aiko").exists())
        self.assertFalse((SKIPO_ROOT / "scaffolds/vite/src/backend/adapters/aikoRoutes.ts").exists())

    def test_gates_import_canonical_floks(self):
        """LoginGate & WorkspaceGate must exist and import @ultrst-armada/floks/ui."""
        for scaffold_name in ["vite", "nextjs"]:
            gates_dir = SKIPO_ROOT / "scaffolds" / scaffold_name / "src" / "frontend" / "components" / "gates"
            login_gate = gates_dir / "LoginGate.tsx"
            ws_gate = gates_dir / "WorkspaceGate.tsx"
            self.assertTrue(login_gate.exists(), f"LoginGate missing in {scaffold_name}")
            self.assertTrue(ws_gate.exists(), f"WorkspaceGate missing in {scaffold_name}")

            login_content = login_gate.read_text(encoding="utf-8")
            self.assertTrue(
                "@ultrst-armada/floks/auth" in login_content or "@ultrst-armada/floks/ui" in login_content,
                f"Expected @ultrst-armada/floks/auth or @ultrst-armada/floks/ui in {scaffold_name} LoginGate"
            )
            self.assertIn("AuthPage", login_content)
            self.assertNotIn("@floks/ui", login_content)

            ws_content = ws_gate.read_text(encoding="utf-8")
            self.assertIn("@ultrst-armada/floks/ui", ws_content)
            self.assertIn("WorkspaceTilesMenu", ws_content)
            self.assertNotIn("@floks/ui", ws_content)

    def test_ui_contract_validator_aspect_13(self):
        """Aspect 13 validator passes on both scaffolds."""
        cmd = [sys.executable, str(SKIPO_ROOT / "checklists" / "13_ui_contract_validator.py")]
        for scaffold_name in ["vite", "nextjs"]:
            res = subprocess.run(
                cmd + [str(SKIPO_ROOT / "scaffolds" / scaffold_name)],
                capture_output=True,
                text=True,
            )
            self.assertEqual(
                res.returncode,
                0,
                f"Aspect 13 failed on {scaffold_name}: {res.stdout}\n{res.stderr}",
            )

    def test_package_export_validator_aspect_14(self):
        """Aspect 14 validator passes on both scaffolds."""
        cmd = [sys.executable, str(SKIPO_ROOT / "checklists" / "14_package_export_validator.py")]
        for scaffold_name in ["vite", "nextjs"]:
            res = subprocess.run(
                cmd + [str(SKIPO_ROOT / "scaffolds" / scaffold_name)],
                capture_output=True,
                text=True,
            )
            self.assertEqual(
                res.returncode,
                0,
                f"Aspect 14 failed on {scaffold_name}: {res.stdout}\n{res.stderr}",
            )

    def test_negative_regression_database_url_rejection(self):
        """Full system validator rejects scaffold if raw DATABASE_URL is introduced."""
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            shutil.copytree(SKIPO_ROOT / "scaffolds" / "vite", tmp_path / "app")
            bad_file = tmp_path / "app" / "src" / "backend" / "bad.ts"
            bad_file.write_text("export const db = process.env.DATABASE_URL;\n", encoding="utf-8")
            cmd = [
                sys.executable,
                str(SKIPO_ROOT / "checklists" / "07_backend_storage_isolation.py"),
                str(tmp_path / "app"),
            ]
            res = subprocess.run(cmd, capture_output=True, text=True)
            self.assertNotEqual(res.returncode, 0, "Validator must reject DATABASE_URL")

    def test_negative_regression_banned_floks_import(self):
        """Aspect 13 rejects obsolete @floks/ui import."""
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            shutil.copytree(SKIPO_ROOT / "scaffolds" / "vite", tmp_path / "app")
            bad_file = tmp_path / "app" / "src" / "frontend" / "bad.tsx"
            bad_file.write_text(
                "import { AuthPage } from '@floks/ui';\nexport const x = AuthPage;\n",
                encoding="utf-8",
            )
            cmd = [
                sys.executable,
                str(SKIPO_ROOT / "checklists" / "13_ui_contract_validator.py"),
                str(tmp_path / "app"),
            ]
            res = subprocess.run(cmd, capture_output=True, text=True)
            self.assertNotEqual(res.returncode, 0, "Validator must reject obsolete @floks/ui import")


if __name__ == "__main__":
    unittest.main()
