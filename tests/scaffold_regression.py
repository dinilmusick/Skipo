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

    def test_legacy_aiko_fod_integrations_are_absent_from_app_templates(self):
        """Canonical generic app templates do not embed the removed Aiko/FOD integrations."""
        for scaffold_name in ["vite", "nextjs"]:
            base = SKIPO_ROOT / "scaffolds" / scaffold_name
            self.assertFalse((base / "src/frontend/pages/main/tabs/fod/page.tsx").exists())
            self.assertFalse((base / "src/frontend/pages/main/tabs/aiko/page.tsx").exists())
            self.assertFalse((base / "src/backend/aikoRuntime.ts").exists())
            self.assertFalse((base / "src/backend/adapters/aikoRoutes.ts").exists())
            self.assertNotIn("Aiko", (base / "src/frontend/pages/main/page.tsx").read_text(encoding="utf-8"))
        self.assertFalse((SKIPO_ROOT / "scaffolds/nextjs/app/api/aiko/route.ts").exists())

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
