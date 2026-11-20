from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "scaffold_app_structure.py"
VITE = ROOT / "scaffolds" / "vite" / "src" / "frontend" / "App.tsx"


def test_vite_scaffold_discovery_precedes_auth_and_authorized_services():
    source = VITE.read_text(encoding="utf-8")
    assert "createApplicationUniversalInitializationClient" in source
    assert "initializer.discover()" in source
    assert "initializer.configuration()" in source
    assert source.index("initializer.discover()") < source.index("<LuthAuthPage")
    assert "phase === 'ready'" in source
    assert "Retry initialization" in source
    assert "@ultrst-armada/kloks/auth" in source
    assert "SYSTEM_DATABASE_URL" not in source
    assert "getAuthHeaders()" not in source
    entry = (ROOT / "scaffolds/vite/src/app.ts").read_text(encoding="utf-8")
    assert "createCanonicalApplicationOAuthBff" in entry
    assert "'/api/initialization/config'" in entry


def test_generic_generator_requires_discovery_and_scoped_configuration(tmp_path):
    target = tmp_path / "UniversalDemo"
    completed = subprocess.run(
        [sys.executable, str(SCRIPT), str(target), "--name", "UniversalDemo"],
        cwd=ROOT, capture_output=True, text=True,
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
    source = (target / "src/frontend/App.tsx").read_text(encoding="utf-8")
    assert "createApplicationUniversalInitializationClient" in source
    assert "initializer.discover()" in source
    assert "initializer.configuration()" in source
    assert "Application registration denied." in source
    assert "Application access denied." in source
    assert "Retry initialization" in source
    assert "appId = 'universaldemo'" in source
    assert "SYSTEM_DATABASE_URL" not in source
    assert "getAuthHeaders()" not in source
    generated_entry = (target / "src/app.ts").read_text(encoding="utf-8")
    generated_transport = (target / "src/frontend/pages/auth/luthFetch.ts").read_text(encoding="utf-8")
    assert "createCanonicalApplicationOAuthBff" in generated_entry\n    assert "externalInterfaces.mcp(request)" in generated_entry\n    assert "externalInterfaces.http(request)" in generated_entry
    assert '/api/initialization/config' in generated_entry
    assert "headers.delete('Authorization')" in generated_transport
    assert "getAuthHeaders()" not in generated_transport


def test_scaffold_client_is_browser_only_and_legacy_bff_boundary_is_untouched():
    source = SCRIPT.read_text(encoding="utf-8")
    assert "createApplicationUniversalInitializationClient" in source
    assert "createApplicationUniversalInitializationClient" in source
    assert "authorize: async () => authClient?.getAuthHeaders()" not in source
    assert "LuthAuthPage as FloksLuthAuthPage" in source
    assert "createCanonicalApplicationOAuthBff" in (ROOT / "scripts/generate_provider_packaging.py").read_text(encoding="utf-8")

def test_capability_registry_versions_match_generated_published_dependencies():
    registry = json.loads((ROOT / "architecture/capabilities/registry.json").read_text(encoding="utf-8"))
    scaffold = json.loads((ROOT / "scaffolds/vite/package.json").read_text(encoding="utf-8"))
    root_package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    assert registry["applicationState"]["framework"]["version"] == root_package["version"]
    canonical = registry["applicationState"]["dependencies"]
    for name in ("@dinilmusick/gutts", "@ultrst-armada/kloks"):
        assert canonical[name] == scaffold["dependencies"][name], name
    for capability in registry["capabilities"].values():
        if "@ultrst-armada/kloks" in capability.get("dependencies", {}):
            assert capability["dependencies"]["@ultrst-armada/kloks"] == scaffold["dependencies"]["@ultrst-armada/kloks"]
