"""Generated capability integration contracts; run: python -m pytest -q tests/functional_capability_generation.test.py."""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = json.loads((ROOT / 'architecture/capabilities/registry.json').read_text())


def test_generated_workspace_page_is_not_a_placeholder(tmp_path):
    (tmp_path / 'package.json').write_text('{"name":"generated","dependencies":{}}')
    result = subprocess.run(
        [sys.executable, str(ROOT / 'scripts/skipo_cli.py'), 'add', 'workspace', str(tmp_path)],
        text=True, capture_output=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    page = (tmp_path / 'src/frontend/pages/menus/workspaces/page.tsx').read_text()
    assert 'WorkspaceGate' in page
    assert 'onSelectWorkspace' in page
    assert 'workspaces={[]' not in page
    assert 'MainPage' in page


def test_generated_scaffold_capabilities_match_registry():
    capabilities = REGISTRY['capabilities']
    scaffold = "vite"
    base = ROOT / 'scaffolds' / scaffold
    for kind, path in (
        ('workspace', 'src/frontend/pages/menus/workspaces/page.tsx'),
        ('settings', 'src/frontend/pages/settings/page.tsx'),
    ):
        expected = next(item['content'] for item in capabilities[kind]['generated'] if item['path'] == path)
        assert (base / path).read_text() == expected
    gate = (base / 'src/frontend/components/gates/WorkspaceGate.tsx').read_text()
    assert 'createKloksWorkspaceStorageService' in gate
    assert "requestJson('/api/auth/workspaces')" in gate
    assert "requestJson('/api/auth/storage/invoke'" in gate
    assert 'setRecords(result.workspaces.map(workspaceRecord))' in gate


def test_production_flows_fail_closed_without_a_verified_principal():
    vite_route = (ROOT / 'scaffolds/vite/src/app.ts').read_text()
    adapter = (ROOT / 'scaffolds/vite/src/backend/adapters/httpsAdapter.ts').read_text()
    assert 'authenticateLuthRequest(request)' in vite_route
    assert "headers.get('x-user-id')" in vite_route
    assert "fetch as fetchHandler" in adapter
    scaffold = "vite"
    backend = (ROOT / 'scaffolds' / scaffold / 'src/backend/storage/canonicalCapabilityRoutes.ts').read_text()
    assert "WorkspaceServiceFacade.execute('createWorkspace'" in backend
    assert "StorageServiceFacade.execute(operation" in backend
    assert 'getConnectionsWithSecrets' not in backend


def test_create_only_supports_vite(tmp_path):
    cli = [sys.executable, str(ROOT / 'scripts/skipo_cli.py'), 'create', 'Smoke']
    retired = tmp_path / 'retired'
    result = subprocess.run([*cli, str(retired), '--framework', 'nextjs'], text=True, capture_output=True)
    assert result.returncode == 2
    assert not retired.exists()

    generated = tmp_path / 'generated'
    result = subprocess.run([*cli, str(generated)], text=True, capture_output=True)
    assert result.returncode == 0, result.stdout + result.stderr
    assert json.loads(result.stdout)['framework'] == 'vite'
    assert (generated / 'vite.config.ts').is_file()
    assert (generated / 'pnpm-lock.yaml').is_file()
    assert not list(generated.glob('next.config.*'))
