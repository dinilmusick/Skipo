"""Regression: generated app instructions must describe real files and authority."""
from __future__ import annotations

import sys
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1] / "scaffolds" / "vite"
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from skipo_cli import create_project

DOCS = (
    "README.md",
    "SCAFFOLD_GUIDE.md",
    "SKILL.md",
    "architecture/app-architecture/SKILL.md",
    "architecture/workspace-architectures/SKILL.md",
)
REQUIRED = (
    "Canonical Application Contract",
    "architecture/app-architecture/SKILL.md",
    "architecture/workspace-architectures/SKILL.md",
)


def test_template_has_truthful_canonical_agent_contract():
    for item in DOCS:
        assert (SOURCE / item).is_file(), item
    readme = (SOURCE / "README.md").read_text(encoding="utf-8")
    guide = (SOURCE / "SCAFFOLD_GUIDE.md").read_text(encoding="utf-8")
    for marker in REQUIRED:
        assert marker in readme
    assert "skipo create MyApp" in readme
    assert "skipo service create" in readme
    assert "src/frontend/pages/main/tabs/" in readme
    assert "Kloks" in guide and "Luth" in guide and "Floks" in guide
    for body in (readme, guide):
        for obsolete in ("Skipo/scripts/rename_app.py",
                         "services/core/authCore.ts",
                         "services/core/unifiedDb.ts",
                         "@skipo/ui",
                         "ALREADY PRE-WIRED AND FULLY SOLVED"):
            assert obsolete not in body, obsolete


def test_real_generated_app_contains_referenced_docs_and_links(tmp_path):
    app = tmp_path / "DocsFixture"
    assert create_project("DocsFixture", app, "vite", False) == 0
    for item in DOCS:
        assert (app / item).is_file(), item
    readme = (app / "README.md").read_text(encoding="utf-8")
    assert "DocsFixture" in readme
    for item in ("SKILL.md",
                 "architecture/app-architecture/SKILL.md",
                 "architecture/workspace-architectures/SKILL.md"):
        assert item in readme
    assert (app / "skipo.providers.json").is_file()
    assert (app / "src/app.ts").is_file()
    assert (app / "src/frontend/pages/main/tabs/README.md").is_file()


def test_cross_linked_application_and_workspace_skills_are_substantive():
    agent = (SOURCE / "SKILL.md").read_text(encoding="utf-8")
    architecture = (SOURCE / "architecture/app-architecture/SKILL.md").read_text(encoding="utf-8")
    workspace = (SOURCE / "architecture/workspace-architectures/SKILL.md").read_text(encoding="utf-8")
    assert "BLOCKING VERIFICATION GATE" in agent
    for marker in ("SKIPO APPLICATION CONTRACT", "assistant.py advise",
                   "python3 assistant.py validate .", "Workspace Storage Architecture",
                   "../workspace-architectures/SKILL.md"):
        assert marker in architecture
    for marker in ("Unified Workspace & Storage Architecture", "Backblaze B2",
                   "Google Drive", "mermaid", "../app-architecture/SKILL.md"):
        assert marker in workspace
    assert "not a guaranteed file inside an installed generated app" in architecture
    assert "not proof of a live OAuth" in workspace
