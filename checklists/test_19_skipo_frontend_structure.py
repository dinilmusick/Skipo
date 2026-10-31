import json
import tempfile
import unittest
from pathlib import Path

from importlib.util import spec_from_file_location, module_from_spec

import sys
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
spec = spec_from_file_location("skipo_frontend_structure", ROOT / "19_skipo_frontend_structure.py")
mod = module_from_spec(spec)
spec.loader.exec_module(mod)

class SkipoFrontendStructureTests(unittest.TestCase):
    required = [
        "src/frontend/pages/auth/page.tsx",
        "src/frontend/pages/menus/workspaces/page.tsx",
        "src/frontend/pages/main/page.tsx",
        "src/frontend/pages/main/tabs/fod/page.tsx",
        "src/frontend/pages/main/tabs/aiko/page.tsx",
        "src/frontend/pages/settings/page.tsx",
        "src/frontend/pages/settings/tabs/themes/page.tsx",
        "src/frontend/pages/settings/tabs/accounts/page.tsx",
    ]

    def make_fixture(self, complete=True):
        root = Path(tempfile.mkdtemp())
        (root / "src/frontend/pages/main/tabs/fod").mkdir(parents=True)
        (root / "src/frontend/pages/main/tabs/aiko").mkdir(parents=True)
        (root / "src/frontend/pages/settings/tabs/themes").mkdir(parents=True)
        (root / "src/frontend/pages/settings/tabs/accounts").mkdir(parents=True)
        (root / "src/frontend/pages/auth").mkdir(parents=True)
        (root / "src/frontend/pages/menus/workspaces").mkdir(parents=True)
        (root / "src/frontend/pages/main").mkdir(parents=True, exist_ok=True)
        (root / "src/frontend/pages/settings").mkdir(parents=True, exist_ok=True)
        (root / "package.json").write_text(json.dumps({"skipo":{"deploy":"fullstack"}}))
        if complete:
            for rel in self.required:
                p = root / rel
                p.parent.mkdir(parents=True, exist_ok=True)
                if "main/page" in rel:
                    p.write_text("immersive mode")
                elif "accounts/page" in rel:
                    p.write_text("SRKL sync")
                elif "fod/page" in rel:
                    p.write_text("import { FodModule } from '@ultrst-armada/floks/canvas-ui/fod';")
                elif "aiko/page" in rel:
                    p.write_text("import { AikoModule } from '@ultrst-armada/floks/canvas-ui/aiko';")
                else:
                    p.write_text("")
        return root

    def test_complete_structure_passes(self):
        result = mod.validate_skipo_frontend_structure(self.make_fixture())
        self.assertTrue(result.passed)

    def test_missing_settings_accounts_fails(self):
        root = self.make_fixture()
        (root / "src/frontend/pages/settings/tabs/accounts/page.tsx").unlink()
        result = mod.validate_skipo_frontend_structure(root)
        self.assertFalse(result.passed)
        self.assertTrue(any(v.rule_id == "missing-skipo-page" for v in result.violations))

    def test_noncanonical_page_root_fails(self):
        root = self.make_fixture()
        (root / "src/frontend/pages/legacy").mkdir()
        result = mod.validate_skipo_frontend_structure(root)
        self.assertFalse(result.passed)
        self.assertTrue(any(v.rule_id == "invalid-skipo-page-root" for v in result.violations))

if __name__ == "__main__":
    unittest.main()
