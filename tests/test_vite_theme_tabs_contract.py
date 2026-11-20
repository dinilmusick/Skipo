"""The generated Vite shell must consume Floks tokens and preserve app tab ownership."""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "scripts"))
from skipo_cli import create_project

CSS = REPO / "scaffolds/vite/src/index.css"
TAB_README = REPO / "scaffolds/vite/src/frontend/pages/main/tabs/README.md"


def test_canonical_floks_tokens_are_not_shadowed_by_template_palette():
    text = CSS.read_text(encoding="utf-8")
    assert '@ultrst-armada/floks/ui/theme/tokens.css' in text
    assert not re.search(r"#[\da-fA-F]{3,8}\b", text), "Template may not ship hardcoded colour literals"
    for name in ("bg", "text", "accent", "border-color"):
        assert not re.search(rf"--skipo-{name}\s*:", text), f"Only Floks may define --skipo-{name}"
    for required in ("var(--skipo-bg)", "var(--skipo-text)", "var(--skipo-font)",
                     "scrollbar-width: thin", "scrollbar-color: var(--skipo-accent)",
                     "::-webkit-scrollbar-thumb", "::-webkit-scrollbar-track"):
        assert required in text


def test_empty_main_tab_root_survives_generated_vite_app(tmp_path, capsys):
    target = tmp_path / "TabsFixture"
    assert create_project("TabsFixture", target, "vite", False) == 0
    assert TAB_README.is_file()
    assert (target / "src/frontend/pages/main/tabs/README.md").read_bytes() == TAB_README.read_bytes()
    css = (target / "src/index.css").read_text(encoding="utf-8")
    assert css == CSS.read_text(encoding="utf-8")
    assert (target / "src/frontend/pages/main/tabRegistry.tsx").is_file()
    assert b"\r\n" not in (target / "src/frontend/pages/settings/tabs/accounts/page.tsx").read_bytes()
    assert not re.search(r"#[\da-fA-F]{3,8}\b", css)


def test_one_component_per_file_preserves_registry_api():
    folder = REPO / "scaffolds/vite/src/frontend/pages/main"
    registry = (folder / "tabRegistry.tsx").read_text(encoding="utf-8")
    assert "export const mainPageTabs" in registry
    assert "export { MainTabContent } from './MainTabContent.js'" in registry
    assert "export { MainPageToolbar } from './MainPageToolbar.js'" in registry
    assert "function MainTabContent(" not in registry
    assert "function MainPageToolbar(" not in registry
    for component in ("MainTabContent", "MainPageToolbar"):
        content = (folder / f"{component}.tsx").read_text(encoding="utf-8")
        assert len(re.findall(r"\bexport function [A-Z]", content)) == 1
        assert f"export function {component}(" in content
        assert "from './tabRegistry.js'" in content
