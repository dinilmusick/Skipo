from pathlib import Path
import re

from scripts.scaffold_app_structure import scaffold_structure

ROOT = Path(__file__).resolve().parents[1]

LEGACY_PATTERNS = (
    r"@ultrst-armada/kloks/aiko",
    r"@ultrst-armada/kloks/fod",
    r"@ultrst-armada/floks/canvas-ui/aiko",
    r"@ultrst-armada/floks/canvas-ui/fod",
    r"@dinilmusick/gutts/api",
    r"createAikoRuntime|createSkipoAikoRuntime|AikoServiceFacade",
    r"createFodRuntime|FodServiceFacade|FodRuntime|handleFodRoutes",
    r"AikoDirectChat|AikoModule|FodModule",
    r"AIKO_ENGINE_URL|AIKO_MODULE_TOKEN",
    r"/api/aiko|/api/fod",
    r"data-skipo-aiko-chat-trigger|data-skipo-aiko-direct-chat",
    r"\bAiko\b|\bFOD\b",
)
LEGACY_RE = re.compile("|".join(f"(?:{pattern})" for pattern in LEGACY_PATTERNS), re.IGNORECASE)


def _text_files(*roots):
    if not roots:
        roots = (".",)
    for root in roots:
        path = ROOT / root
        if path.is_file():
            yield path
        elif path.is_dir():
            for item in path.rglob("*"):
                if not item.is_file():
                    continue
                relative = item.relative_to(ROOT)
                if any(part in {".git", "node_modules", ".venv", "dist", "build", "__pycache__", "tests"} for part in relative.parts):
                    continue
                yield item


def test_generated_scaffold_does_not_register_aiko_or_fod_tabs(tmp_path):
    target = tmp_path / "DemoApp"
    scaffold_structure(target, "DemoApp")

    assert not (target / "src/frontend/pages/main/tabs/aiko").exists()
    assert not (target / "src/frontend/pages/main/tabs/fod").exists()
    backend = (target / "src/backend/DemoAppBackend.ts").read_text()
    components = (target / "src/frontend/components/components.ts").read_text()
    app = (target / "src/frontend/App.tsx").read_text()
    main = (target / "src/frontend/pages/main/page.tsx").read_text()
    assert "Aiko" not in backend + app + main
    assert "FOD" not in backend + app + main
    assert "AikoModule" not in components
    assert "FodModule" not in components
    assert not (target / "src/backend/aikoRuntime.ts").exists()
    assert not (target / "src/backend/adapters/aikoRoutes.ts").exists()


def test_vite_and_nextjs_templates_have_no_legacy_tabs_or_routes():
    for name in ("vite", "nextjs"):
        base = ROOT / "scaffolds" / name
        assert not (base / "src/frontend/pages/main/tabs/aiko").exists()
        assert not (base / "src/frontend/pages/main/tabs/fod").exists()
        assert not (base / "src/backend/aikoRuntime.ts").exists()
        assert "Aiko" not in (base / "src/frontend/App.tsx").read_text()
        assert "FOD" not in (base / "src/frontend/pages/main/page.tsx").read_text()
    assert not (ROOT / "scaffolds/nextjs/app/api/aiko").exists()
    assert not (ROOT / "scaffolds/vite/src/backend/adapters/aikoRoutes.ts").exists()
    assert not (ROOT / "scaffolds/vite/src/backend/adapters/fodRoutes.ts").exists()
    assert not (ROOT / "scaffolds/nextjs/app/api/fod").exists()


def test_no_legacy_workspace_menu_or_top_right_shortcut_remains():
    files = list(_text_files("src", "scaffolds", "scripts", "generators", "checklists", "README.md", "package.json"))
    offenders = []
    for path in files:
        if path.suffix.lower() not in {".ts", ".tsx", ".js", ".jsx", ".py", ".json", ".md"}:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        if LEGACY_RE.search(text):
            offenders.append(str(path.relative_to(ROOT)))
    assert not offenders, "Legacy Aiko/FOD integration references remain: " + ", ".join(offenders)


def test_no_obsolete_aiko_or_fod_runtime_imports_remain():
    for path in _text_files("src", "scaffolds", "scripts", "generators", "checklists", "README.md", "package.json"):
        if path.suffix.lower() not in {".ts", ".tsx", ".js", ".jsx", ".py"}:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        assert not LEGACY_RE.search(text), f"Obsolete integration reference in {path.relative_to(ROOT)}"


def test_frontend_architecture_checklist_does_not_require_legacy_modules():
    source = (ROOT / "checklists/19_skipo_frontend_structure.py").read_text()
    assert "tabs/fod" not in source
    assert "tabs/aiko" not in source
    assert "AikoDirectChat" not in source
    assert "FodModule" not in source

def test_no_replacement_aiko_module_or_fod_reimplementation_was_added():
    assert not (ROOT / "src/modules/aiko").exists()
    assert not (ROOT / "scaffolds/vite/src/modules/aiko").exists()
    assert not (ROOT / "scaffolds/nextjs/src/modules/aiko").exists()
    for name in ("vite", "nextjs"):
        base = ROOT / "scaffolds" / name
        assert not (base / "src/frontend/components/aiko").exists()
        assert not (base / "src/frontend/components/fod").exists()
