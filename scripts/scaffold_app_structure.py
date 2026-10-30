#!/usr/bin/env python3
"""
scaffold_app_structure.py - Scaffolds the extreme-minimal Skipo application composition structure.
Consumes @kloks/* and @floks/* via package.json (node_modules/) with ZERO package source duplication.
"""

from pathlib import Path
from typing import List, Tuple
import argparse
import json
import subprocess
import sys

HERE = Path(__file__).resolve().parent
SKIPO_ROOT = HERE.parent

def scaffold_structure(target_root: Path, app_name: str) -> List[Path]:
    """Generates the minimal Skipo composition tree consuming @kloks/* and @floks/* packages."""
    pascal = app_name[:1].upper() + app_name[1:]
    camel = app_name[:1].lower() + app_name[1:]
    created: List[Path] = []

    planes = [
        ("src/frontend", "Application UI composition entrypoint importing @floks/* packages."),
        ("src/backend", "Application backend facade importing @kloks/* services and orchestrators."),
        ("src/libraries", "Application-specific custom code ONLY (never copy @kloks/* or @floks/* source)."),
    ]

    for rel_path, desc in planes:
        dir_path = target_root / rel_path
        dir_path.mkdir(parents=True, exist_ok=True)
        readme_file = dir_path / "README.md"
        if not readme_file.exists():
            readme_file.write_text(f"# {dir_path.name}\n\n{desc}\n", encoding="utf-8")
            created.append(readme_file)

    # 1. package.json declaring unified @ultrst-armada/kloks, @ultrst-armada/floks
    pkg_json_file = target_root / "package.json"
    if not pkg_json_file.exists():
        pkg_data = {
            "name": app_name.lower(),
            "version": "1.0.0",
            "private": True,
            "type": "module",
            "dependencies": {
                "@ultrst-armada/krnl": "^1.0.0",
                "@ultrst-armada/kloks": "^1.20.0",
                "@dinimusick/gutts": "^1.0.0",
                "@ultrst-armada/floks": "^1.8.0",
                "react": "^19.0.1",
                "react-dom": "^19.0.1"
            },
            "pnpm": {
                "overrides": {
                    "@ultrst-armada/kloks": "file:../Kloks",
                    "@ultrst-armada/floks": "file:../Floks"
                }
            }
        }
        pkg_json_file.write_text(json.dumps(pkg_data, indent=2) + "\n", encoding="utf-8")
        created.append(pkg_json_file)

    # 2. src/backend/<AppName>Backend.ts
    backend_file = target_root / "src" / "backend" / f"{pascal}Backend.ts"
    if not backend_file.exists():
        backend_content = f"""/**
 * @file {pascal}Backend.ts
 * @description Primary application backend entrypoint composing @ultrst-armada/kloks services & orchestrators.
 */

import {{
  ServiceAFacade,
  ServiceBFacade,
}} from '@ultrst-armada/kloks/services';
import {{
  OrchestratorAFacade,
}} from '@ultrst-armada/kloks/orchestrations';
import {{
  AudioHardwareServiceFacade,
  MidiServiceFacade,
  AudioMidiOrchestratorFacade,
}} from '@ultrst-armada/kloks/audio-midi';
import {{
  AuthServiceFacade,
  StorageServiceFacade,
  WorkspaceServiceFacade,
  workingWorkspaceService,
  ExecutableBackendFacade,
  WorkerExecutionBoundary,
}} from '@ultrst-armada/kloks/backend';
import {{ FodRuntime, createFodServiceFacadeForWorkspace, scanBackendFacadeToNodes }} from '@ultrst-armada/kloks/fod';
import {{ AikoRuntime }} from '@ultrst-armada/kloks/aiko';
import {{ AIKeyServiceFacade }} from '@ultrst-armada/kloks/krnl-ai-services';
import {{ guttsFodNodeDefinitions, executeGuttsApi }} from '@dinimusick/gutts/api';

export const {camel}BackendFacade = new ExecutableBackendFacade('{pascal}Backend');
export const {camel}Worker = new WorkerExecutionBoundary('{pascal}Worker', {camel}BackendFacade);

export const createFodRuntime = (workspaceId: string) => {{
  const runtime = new FodRuntime({{ workspaceId, workspaceService: workingWorkspaceService }});
  const host = scanBackendFacadeToNodes({pascal}Backend as any);
  const guttsEndpoints = guttsFodNodeDefinitions.map((node: any) => ({{
    id: String(node.metadata.apiId),
    serviceId: '@dinimusick/gutts',
    serviceName: 'GutTS',
    operationId: String(node.metadata.apiId),
    operationName: node.label,
    description: node.description,
    invoke: (input: Record<string, unknown>) => executeGuttsApi(String(node.metadata.apiId), input),
  }}));
  runtime.setEndpoints([...host.endpoints, ...guttsEndpoints], [...host.nodes as any, ...guttsFodNodeDefinitions as any]);
  return runtime;
}};

export const FodServiceFacade = createFodServiceFacadeForWorkspace(createFodRuntime);

export const createAikoRuntime = (workspaceId: string) => {{
  const fod = createFodRuntime(workspaceId);
  const host = scanBackendFacadeToNodes({pascal}Backend as any);
  const engineUrl = process.env.AIKO_ENGINE_URL;
  const resolve = async (specId?: string) => {{
    if (!engineUrl) throw new Error('AIKO_ENGINE_URL is required for the embedded Aiko module.');
    const response = await fetch(engineUrl.replace(/\/$/, '') + '/api/module/resolve-intelligence', {{
      method: 'POST',
      headers: {{ 'Content-Type': 'application/json' }},
      body: JSON.stringify({{ specId }}),
    }});
    if (!response.ok) throw new Error('Aiko Engine intelligence resolver request failed.');
    return response.json();
  }};
  const capabilities = async () => {{
    const endpointCapabilities = host.endpoints.map((endpoint: any) => ({{
      id: String(endpoint.id), name: endpoint.operationName || endpoint.id, description: endpoint.description,
      sourceKind: 'endpoint', sourceId: String(endpoint.id), inputSchema: endpoint.inputSchema,
      execute: (input: unknown) => endpoint.invoke(input),
    }}));
    const flowCapabilities = (await fod.listFlows()).map((flow: any) => ({{
      id: String(flow.id), name: flow.name, description: flow.description,
      sourceKind: 'fod-flow', sourceId: String(flow.id), inputSchema: flow.inputSchema,
      execute: (_input: unknown) => fod.executeFlow(String(flow.id)),
    }}));
    const guttsCapabilities = guttsFodNodeDefinitions.map((node: any) => ({{
      id: String(node.metadata.apiId), name: node.label, description: node.description,
      sourceKind: 'gutts-api', sourceId: String(node.metadata.apiId), inputSchema: node.inputSchema,
      execute: (input: unknown) => executeGuttsApi(String(node.metadata.apiId), input as Record<string, unknown>),
    }}));
    return [...endpointCapabilities, ...flowCapabilities, ...guttsCapabilities];
  }};
  return new AikoRuntime({{
    capabilities,
    resolver: {{ resolve: async (specId) => resolve(specId) }},
    keys: {{
      listKeys: async () => (AIKeyServiceFacade.getKeys() as any[]).map((key: any) => ({{ id: key.id, providerId: key.providerId, label: key.label, status: key.status, isActive: key.isActive, emailGroup: key.emailGroup, expiresAt: key.expiresAt }})),
      getActiveKey: async (providerId) => (AIKeyServiceFacade.getActiveKey(providerId) as any) ?? null,
      rotateKey: async (providerId) => (AIKeyServiceFacade.rotateKey(providerId) as any) ?? null,
      addKey: async (input) => AIKeyServiceFacade.addKey(input) as any,
      syncFromAikoEngine: async () => {{
        if (!engineUrl) throw new Error('AIKO_ENGINE_URL is required for Aiko Engine key sync.');
        const response = await fetch(engineUrl.replace(/\/$/, '') + '/api/module/keys/export', {{
          headers: process.env.AIKO_MODULE_TOKEN ? {{ 'x-aiko-module-token': process.env.AIKO_MODULE_TOKEN }} : undefined,
        }});
        if (!response.ok) throw new Error('Aiko Engine key synchronization failed.');
        const payload = await response.json();
        const imported = await AIKeyServiceFacade.importKeys(payload.backup);
        return {{ synced: imported.importedCount, message: 'Aiko Engine keys synchronized.' }};
      }},
    }},
  }});
}};

export const AikoServiceFacade = {{
  id: 'kloks.aiko', name: 'AikoService', version: '1.0.0',
  runtime: 'server' as const, deployment: 'local' as const,
  execute: async (operation: string, input?: any) => {{
    const runtime = createAikoRuntime(String(input?.workspaceId || 'default'));
    if (operation === 'listAgents') return runtime.listAgents();
    if (operation === 'executeAgent') return runtime.executeAgent(String(input?.agentId), input?.query);
    if (operation === 'listKeys') return runtime.listKeys();
    if (operation === 'syncFromAikoEngine') return runtime.syncFromAikoEngine();
    throw new Error('Unsupported Aiko operation: ' + operation);
  }},
}};

export const {pascal}Backend = {{
  services: {{
    serviceA: ServiceAFacade,
    serviceB: ServiceBFacade,
    audioHardware: AudioHardwareServiceFacade,
    midi: MidiServiceFacade,
    auth: AuthServiceFacade,
    storage: StorageServiceFacade,
    workspace: WorkspaceServiceFacade,
    fod: FodServiceFacade,
    aiko: AikoServiceFacade,
  }},
  orchestrations: {{
    orchestratorA: OrchestratorAFacade,
    audioMidi: AudioMidiOrchestratorFacade,
  }},
  worker: {camel}Worker,
  WorkerExecutionBoundary: {camel}Worker,
}};

export default {pascal}Backend;
"""
        backend_file.write_text(backend_content, encoding="utf-8")
        created.append(backend_file)

    # 3. Canonical Skipo frontend page contract + component facade
    frontend_components = target_root / "src" / "frontend" / "components"
    pages_root = target_root / "src" / "frontend" / "pages"
    required_page_dirs = [
        pages_root / "auth",
        pages_root / "menus" / "workspaces",
        pages_root / "main" / "tabs",
        pages_root / "main" / "tabs" / "fod",
        pages_root / "main" / "tabs" / "aiko",
        pages_root / "settings" / "tabs" / "themes",
        pages_root / "settings" / "tabs" / "accounts",
    ]
    frontend_components.mkdir(parents=True, exist_ok=True)
    for page_dir in required_page_dirs:
        page_dir.mkdir(parents=True, exist_ok=True)

    components_file = frontend_components / "components.ts"
    if not components_file.exists():
        components_file.write_text(
            "export * from '@ultrst-armada/floks/ui';\\n"
            "export * from '@ultrst-armada/floks/canvas-ui';\\n"
            "export * from '@ultrst-armada/floks/canvas-ui/aiko';\\n",
            encoding="utf-8",
        )
        created.append(components_file)

    page_templates = {
        pages_root / "auth" / "page.tsx": (
            "export { AuthPage } from '@ultrst-armada/floks/ui';\\n"
        ),
        pages_root / "menus" / "workspaces" / "page.tsx": (
            "export { WorkspaceTilesMenu } from '@ultrst-armada/floks/ui';\\n"
        ),
        pages_root / "main" / "page.tsx": (
            "import React, { useState } from 'react';\\n"
            "import { FrnlPage } from '../../components/components.js';\\n\\n"
            "export function MainPage({ children, fod, aiko }: { children?: React.ReactNode; fod?: React.ReactNode; aiko?: React.ReactNode }) {\\n"
            "  const [immersive, setImmersive] = useState(false);\\n"
            "  const [tab, setTab] = useState<'main' | 'fod' | 'aiko' | 'settings'>('main');\\n"
            "  const content = tab === 'fod' ? fod : tab === 'aiko' ? aiko : children;\\n"
            "  return (\\n"
            "    <div data-skipo-main-page=\"true\" data-immersive={immersive}>\\n"
            "      <nav><button type=\"button\" onClick={() => setTab('main')}>Main</button><button type=\"button\" onClick={() => setTab('fod')}>FOD</button><button type=\"button\" onClick={() => setTab('aiko')}>Aiko</button><button type=\"button\" onClick={() => setTab('settings')}>Settings</button><button type=\"button\" data-skipo-immersive-toggle=\"true\" onClick={() => setImmersive((value) => !value)}>{immersive ? 'Exit immersive' : 'Immersive'}</button></nav>\\n"
            "      <FrnlPage showTopBar={!immersive} showBottomBar={!immersive}>{tab === 'settings' ? <div>Settings</div> : content}</FrnlPage>\\n"
            "    </div>\\n"
            "  );\\n"
            "}\\n\\n"
            "export default MainPage;\\n"
        ),
        pages_root / "main" / "tabs" / "README.md": (
            "# Main Tabs\\n\\nFOD is mandatory. Application-specific working UI belongs in additional tab directories under this folder.\\n"
        ),
        pages_root / "main" / "tabs" / "aiko" / "page.tsx": (
            "import { AikoModule } from '@ultrst-armada/floks/canvas-ui/aiko';\\n"
            "export default function AikoTab({ runtime, workspaceId }: { runtime: any; workspaceId: string }) { return <AikoModule runtime={runtime} workspaceId={workspaceId} />; }\\n"
        ),
        pages_root / "main" / "tabs" / "fod" / "page.tsx": (
            "import { FodModule } from '@ultrst-armada/floks/canvas-ui/fod';\\n"
            "import type { FodRuntimeLike } from '@ultrst-armada/floks/canvas-ui/fod';\\n"
            "import { guttsFodNodeDefinitions } from '@dinimusick/gutts/api';\\n\\n"
            "export default function FodTab({ runtime, workspaceId, hostNodes = [] }: { runtime: FodRuntimeLike; workspaceId: string; hostNodes?: any[] }) {\\n"
            "  return <FodModule runtime={runtime} workspaceId={workspaceId} nodeDefinitions={[...guttsFodNodeDefinitions as any, ...hostNodes]} />;\\n"
            "}\\n"
        ),
        pages_root / "settings" / "page.tsx": (
            "import React, { useState } from 'react';\\n"
            "import ThemesTab from './tabs/themes/page.js';\\n"
            "import AccountsTab from './tabs/accounts/page.js';\\n\\n"
            "export default function SettingsPage() {\\n"
            "  const [tab, setTab] = useState<'themes' | 'accounts'>('themes');\\n"
            "  return <div><nav><button onClick={() => setTab('themes')}>Themes</button><button onClick={() => setTab('accounts')}>Accounts</button></nav>{tab === 'themes' ? <ThemesTab /> : <AccountsTab />}</div>;\\n"
            "}\\n"
        ),
        pages_root / "settings" / "tabs" / "themes" / "page.tsx": (
            "export default function ThemesTab() { return null; }\\n"
        ),
        pages_root / "settings" / "tabs" / "accounts" / "page.tsx": (
            "export default function AccountsTab() { return <button type=\"button\">Sync from SRKL</button>; }\\n"
        ),
    }
    # app tab directory is created lazily so the template file has a parent.
    for page_file, content in page_templates.items():
        page_file.parent.mkdir(parents=True, exist_ok=True)
        if not page_file.exists():
            page_file.write_text(content, encoding="utf-8")
            created.append(page_file)

    app_tsx = target_root / "src" / "frontend" / "App.tsx"
    if not app_tsx.exists():
        app_tsx.write_text(
            "import MainPage from './pages/main/page.js';\\n"
            "import FodTab from './pages/main/tabs/fod/page.js';\\n"
            "import AikoTab from './pages/main/tabs/aiko/page.js';\\n"
            "import { createFodRuntime, createAikoRuntime } from '../backend/AppBackend.js';\\n\\n"
            "export function App() { const workspaceId = typeof window === 'undefined' ? 'default' : localStorage.getItem('skipo-active-workspace') || 'default'; const fodRuntime = createFodRuntime(workspaceId); const aikoRuntime = createAikoRuntime(workspaceId); return <MainPage fod={<FodTab runtime={fodRuntime} workspaceId={workspaceId} />} aiko={<AikoTab runtime={aikoRuntime} workspaceId={workspaceId} />} />; }\\n\\n"
            "export default App;\\n",
            encoding="utf-8",
        )
        created.append(app_tsx)

    # 4. src/libraries/index.ts (Skipo-specific custom code only)
    lib_index = target_root / "src" / "libraries" / "index.ts"
    if not lib_index.exists():
        lib_index.write_text("// Application-specific custom libraries only (never duplicate @ultrst-armada/kloks or @ultrst-armada/floks)\nexport {};\n", encoding="utf-8")
        created.append(lib_index)

    return created

def run_validators(target_root: Path) -> Tuple[bool, str]:
    errors: List[str] = []
    val_01 = SKIPO_ROOT / "checklists" / "01_structure_governance.py"
    if val_01.exists():
        res = subprocess.run(["python3", str(val_01), str(target_root)], capture_output=True, text=True)
        if res.returncode != 0:
            errors.append(f"[ASPECT 01 VIOLATION]\n{res.stdout or res.stderr}")

    val_19 = SKIPO_ROOT / "checklists" / "19_skipo_frontend_structure.py"
    if val_19.exists():
        res = subprocess.run(["python3", str(val_19), str(target_root)], capture_output=True, text=True)
        if res.returncode != 0:
            errors.append(f"[ASPECT 19 VIOLATION]\n{res.stdout or res.stderr}")

    val_15 = SKIPO_ROOT / "checklists" / "15_contract_boundary_enforcement.py"
    if val_15.exists():
        res = subprocess.run(["python3", str(val_15), str(target_root)], capture_output=True, text=True)
        if res.returncode != 0:
            errors.append(f"[ASPECT 15 VIOLATION]\n{res.stdout or res.stderr}")

    # If tsconfig.json and node_modules exist, run TypeScript typecheck
    tsconfig = target_root / "tsconfig.json"
    if tsconfig.exists() and (target_root / "node_modules").exists():
        res = subprocess.run(["pnpm", "exec", "tsc", "--noEmit"], cwd=str(target_root), capture_output=True, text=True)
        if res.returncode != 0:
            errors.append(f"[TYPECHECK VIOLATION]\n{res.stdout or res.stderr}")

    return len(errors) == 0, "\n\n".join(errors)

def main():
    parser = argparse.ArgumentParser(description="Scaffold minimal Skipo app composition structure")
    parser.add_argument("target", nargs="?", default="", help="Target root directory")
    parser.add_argument("--name", "-n", default="", help="Application name")
    parser.add_argument("--no-delete-on-fail", action="store_true", help="Do not delete on validation failure")
    args = parser.parse_args()

    target_root = Path(args.target).resolve() if args.target else Path.cwd().resolve()
    app_name = args.name or target_root.name.replace("-", " ").title().replace(" ", "") or "SkipoApp"

    print("=" * 80)
    print(f"  SKIPO MINIMAL PACKAGE-COMPOSITION SCAFFOLD")
    print(f"  Target Root:  {target_root}")
    print(f"  App Name:     {app_name}")
    print("=" * 80)

    created = scaffold_structure(target_root, app_name)
    print(f"  ✔ Created {len(created)} minimal composition files consuming @kloks/* and @floks/*")

    passed, error_output = run_validators(target_root)
    if passed:
        print("  🎉 VALIDATION PASSED: 100% compliant with Skipo Package Composition Architecture!")
        print("=" * 80 + "\n")
        sys.exit(0)
    else:
        print(error_output)
        if not args.no_delete_on_fail:
            for f in created:
                if f.exists():
                    f.unlink()
        sys.exit(1)

if __name__ == "__main__":
    main()
