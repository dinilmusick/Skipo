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
if str(SKIPO_ROOT) not in sys.path:
    sys.path.insert(0, str(SKIPO_ROOT))
from scripts.generate_provider_packaging import generate_provider_packaging

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

    # Canonical embedded-module discovery root. Complete applications remain standalone.\n    modules_dir = target_root / "src" / "modules"\n    modules_dir.mkdir(parents=True, exist_ok=True)\n    modules_readme = modules_dir / "README.md"\n    if not modules_readme.exists():\n        modules_readme.write_text("# Embedded Skipo modules\\n\\nPlace complete module-capable Skipo applications in immediate child directories. Each must contain skipo.module.json.\\n", encoding="utf-8")\n        created.append(modules_readme)\n\n    # 1. package.json declaring unified @ultrst-armada/kloks, @ultrst-armada/floks
    pkg_json_file = target_root / "package.json"
    if not pkg_json_file.exists():
        pkg_data = {
            "name": app_name.lower(),
            "version": "1.0.0",
            "private": True,
            "type": "module",
            "dependencies": {
                "@ultrst-armada/krnl": "^1.0.11",
                "@ultrst-armada/kloks": "^1.26.0",
                "@dinilmusick/gutts": "^2.0.2",
                "@ultrst-armada/floks": "^1.13.18",
                "react": "^19.0.1",
                "react-dom": "^19.0.1",
                "@ultrst-armada/frnlts": "^0.5.5"
            },
            "devDependencies": {
                "typescript": "^5.7.0",
                "@types/node": "^22.0.0",
                "@types/react": "^19.0.0",
                "@types/react-dom": "^19.0.0"
            }
        }
        pkg_json_file.write_text(json.dumps(pkg_data, indent=2) + "\n", encoding="utf-8")
        created.append(pkg_json_file)

    # 1a. Canonical Floks workspace creation gate. Apps supply only their API callbacks.
    workspace_gate_dir = target_root / "src" / "frontend" / "components" / "gates"
    workspace_gate_dir.mkdir(parents=True, exist_ok=True)
    workspace_gate_file = workspace_gate_dir / "WorkspaceGate.tsx"
    if not workspace_gate_file.exists():
        workspace_gate_content = """import React from 'react';
import {
  WorkspaceTilesMenu,
  type WorkspaceCreateInput,
  type WorkspaceRecord,
  type WorkspaceStorageOption,
} from '@ultrst-armada/floks/ui';

export interface WorkspaceGateProps {
  workspaces: WorkspaceRecord[];
  userId?: string;
  currentUser?: { id: string; email?: string; name?: string; username?: string } | null;
  storageOptions?: WorkspaceStorageOption[];
  onManageStorage?: () => void;
  activeWorkspaceId?: string | null;
  onSelectWorkspace: (workspace: WorkspaceRecord) => void;
  onCreateWorkspace: (input: WorkspaceCreateInput) => Promise<void> | void;
  onDeleteWorkspace?: (workspaceId: string) => Promise<void> | void;
  onLogout?: () => void;
  appName?: string;
}

export function WorkspaceGate(props: WorkspaceGateProps) {
  return <WorkspaceTilesMenu
    workspaces={props.workspaces}
    userId={props.userId || props.currentUser?.id}
    currentUser={props.currentUser}
    storageOptions={props.storageOptions}
    onManageStorage={props.onManageStorage}
    activeWorkspaceId={props.activeWorkspaceId}
    onSelectWorkspace={props.onSelectWorkspace}
    onCreateWorkspace={props.onCreateWorkspace}
    onDeleteWorkspace={props.onDeleteWorkspace}
    onLogout={props.onLogout}
    appName={props.appName || 'SKIPO APP'}
    mode="working-workspace"
  />;
}
"""
        workspace_gate_file.write_text(workspace_gate_content, encoding="utf-8")
        created.append(workspace_gate_file)

    # 1b. tsconfig.json
    tsconfig_file = target_root / "tsconfig.json"
    if not tsconfig_file.exists():
        tsconfig_data = {
            "compilerOptions": {
                "target": "ES2022",
                "lib": ["ES2022", "DOM"],
                "module": "ESNext",
                "moduleResolution": "bundler",
                "jsx": "react-jsx",
                "strict": False,
                "skipLibCheck": True,
                "noEmit": True
            },
            "include": ["src/**/*"]
        }
        tsconfig_file.write_text(json.dumps(tsconfig_data, indent=2) + "\n", encoding="utf-8")
        created.append(tsconfig_file)

    # 1c. Luth-backed server-side session validation for protected application routes
    auth_guard_file = target_root / "src" / "backend" / "auth" / "luthSession.ts"
    if not auth_guard_file.exists():
        auth_guard_file.parent.mkdir(parents=True, exist_ok=True)
        auth_guard_file.write_text("""import { DEFAULT_LUTH_URL } from '@dinilmusick/gutts/auth';

export async function getLuthSession(request: Request) {
  const headers = new Headers();
  for (const name of ['authorization', 'cookie', 'origin']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  let response: Response;
  try {
    response = await fetch(DEFAULT_LUTH_URL + '/api/session', {
      method: 'GET', headers, cache: 'no-store', redirect: 'manual',
    });
  } catch { return null; }
  if (!response.ok) return null;
  const session = await response.json().catch(() => null) as any;
  if (session?.authenticated !== true || typeof session?.user?.id !== 'string' ||
      typeof session?.session?.id !== 'string') return null;
  return session;
}

export async function requireLuthSession(request: Request) {
  const session = await getLuthSession(request);
  if (session) return session;
  throw new Response(JSON.stringify({ error: 'Unauthenticated' }), {
    status: 401, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
""", encoding="utf-8")
        created.append(auth_guard_file)

    # 2b. Canonical Google Drive storage adapter, backed by Kloks.
    google_drive_storage_dir = target_root / "src" / "backend" / "storage"
    google_drive_storage_dir.mkdir(parents=True, exist_ok=True)
    google_drive_storage_file = google_drive_storage_dir / "googleDriveWorkspaceStorage.ts"
    if not google_drive_storage_file.exists():
        google_drive_storage_content = """import {
  GoogleDriveStorageService,
  refreshGoogleDriveAccessToken,
} from '@ultrst-armada/kloks/backend';

export interface GoogleDriveOAuthConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri?: string;
}

export interface GoogleDriveWorkspaceConnection {
  id: string;
  provider: 'google_drive';
  googleAccessToken?: string;
  googleAccessTokenExpiresAt?: number;
  googleRefreshToken?: string;
  googleRootFolderId?: string;
}

export interface GoogleDriveWorkspaceStorageHandle {
  storage: GoogleDriveStorageService;
  connection: GoogleDriveWorkspaceConnection;
}

export function getGoogleDriveOAuthConfigFromEnv(): GoogleDriveOAuthConfig {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || '';
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI || undefined;
  if (!clientId) {
    throw new Error('GOOGLE_DRIVE_CLIENT_ID must be configured in the server secret store.');
  }
  return { clientId, clientSecret: clientSecret || undefined, redirectUri };
}

export async function createGoogleDriveWorkspaceStorage(
  source: GoogleDriveWorkspaceConnection,
  oauth: GoogleDriveOAuthConfig = getGoogleDriveOAuthConfigFromEnv(),
): Promise<GoogleDriveWorkspaceStorageHandle> {
  if (source.provider !== 'google_drive') {
    throw new Error('A Google Drive workspace connection is required.');
  }
  if (!oauth.clientId) {
    throw new Error('Google Drive OAuth client ID is not configured.');
  }

  const connection = { ...source };
  let accessToken = connection.googleAccessToken || '';
  let expiresAt = Number(connection.googleAccessTokenExpiresAt || 0);
  const shouldRefresh = !accessToken || (expiresAt > 0 && expiresAt <= Date.now() + 60_000);

  if (shouldRefresh) {
    if (!connection.googleRefreshToken || !oauth.clientSecret) {
      throw new Error('Google Drive token refresh requires the connection refresh token and a server-owned OAuth client secret. Reconnect through SRKL or configure the secret.');
    }
    const tokenSet = await refreshGoogleDriveAccessToken(
      oauth.clientId,
      connection.googleRefreshToken,
      oauth.clientSecret,
      oauth.redirectUri,
    );
    accessToken = tokenSet.accessToken;
    expiresAt = tokenSet.expiresAt;
    connection.googleAccessToken = accessToken;
    connection.googleAccessTokenExpiresAt = expiresAt;
  }

  const storage = new GoogleDriveStorageService({
    provider: 'google_drive',
    googleClientId: oauth.clientId,
    googleRedirectUri: oauth.redirectUri,
    googleAccessToken: accessToken,
    googleAccessTokenExpiresAt: expiresAt || undefined,
    googleRootFolderId: connection.googleRootFolderId || 'root',
  });

  return { storage, connection };
}
"""
        google_drive_storage_file.write_text(google_drive_storage_content, encoding="utf-8")
        created.append(google_drive_storage_file)

    # 2c. src/backend/<AppName>Backend.ts
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
  OrchestratorADefinition,
  OrchestratorBDefinition,
}} from '@ultrst-armada/kloks/orchestrations';
import {{
  AudioHardwareServiceFacade,
  MidiServiceFacade,
  AudioMidiOrchestratorDefinition,
}} from '@ultrst-armada/kloks/audio-midi';
import {{
  StorageServiceFacade,
  WorkspaceServiceFacade,
}} from '@ultrst-armada/kloks/backend';
import {{ WorkerExecutionBoundary }} from '@ultrst-armada/krnl';
import {{ createGoogleDriveWorkspaceStorage }} from './storage/googleDriveWorkspaceStorage.js';

export const {camel}Worker = new WorkerExecutionBoundary('{pascal}Worker');

export const bugReportService = {{
  report: async (input: any, options?: any) => {{
    const authId = options?.session?.userId ?? options?.auth?.user?.id ?? 'authenticated_user';
    const payload = {{
      ...input,
      reporterId: authId,
      context: {{
        applicationId: '{camel}-app',
        applicationType: 'skipo' as const,
        applicationVersion: '1.0.0',
        ...input?.context,
      }},
    }};
    return {{ success: true, id: `bug-${{Date.now().toString(36)}}`, report: payload }};
  }},
}};

export const storageProviders = {{ googleDrive: {{ create: createGoogleDriveWorkspaceStorage }} }};

export const {pascal}Backend = {{
  services: {{
    serviceA: ServiceAFacade,
    serviceB: ServiceBFacade,
    audioHardware: AudioHardwareServiceFacade,
    midi: MidiServiceFacade,
    storage: StorageServiceFacade,
    workspace: WorkspaceServiceFacade,
    bugReport: bugReportService,
  }},
  storageProviders,
  orchestrations: {{
    orchestratorA: OrchestratorADefinition,
    orchestratorB: OrchestratorBDefinition,
    audioMidi: AudioMidiOrchestratorDefinition,
  }},
  worker: {camel}Worker,
  WorkerExecutionBoundary: {camel}Worker,
}};

export default {pascal}Backend;
"""
        backend_file.write_text(backend_content, encoding="utf-8")
        created.append(backend_file)

    # 2c. Canonical public backend barrel (Aspect 22 compliance)
    backend_barrel = target_root / "src" / "backend" / "index.ts"
    if not backend_barrel.exists():
        backend_barrel_content = f"""/**
 * @file index.ts
 * @description Canonical public backend barrel.
 */

export * from './{pascal}Backend.js';
export {{ default }} from './{pascal}Backend.js';
"""
        backend_barrel.write_text(backend_barrel_content, encoding="utf-8")
        created.append(backend_barrel)

    # 2d. Canonical server-side Luth session boundary for generated API handlers.
    auth_dir = target_root / "src" / "backend" / "auth"
    auth_dir.mkdir(parents=True, exist_ok=True)
    luth_session_file = auth_dir / "luthSession.ts"
    if not luth_session_file.exists():
        luth_session_content = f"""import {{ DEFAULT_LUTH_URL }} from '@dinilmusick/gutts/auth';

export type LuthGuardResult =
  | {{ authenticated: true; userId: string }}
  | {{ authenticated: false; response: Response }};

/** Verify the bearer session with Luth; never trust a caller-supplied user ID. */
export async function requireLuthSession(request: Request): Promise<LuthGuardResult> {{
  const authorization = request.headers.get('authorization');
  if (!authorization) {{
    return {{ authenticated: false, response: Response.json({{ error: 'A verified Luth session is required.' }}, {{ status: 401 }}) }};
  }}
  try {{
    const response = await fetch(`${{DEFAULT_LUTH_URL}}/api/session`, {{
      headers: {{ authorization, 'x-app-id': '{app_name.lower().replace(' ', '-')}' }},
      cache: 'no-store',
    }});
    if (!response.ok) {{
      return {{ authenticated: false, response: Response.json({{ error: 'Luth session is invalid or expired.' }}, {{ status: 401 }}) }};
    }}
    const session = await response.json() as {{ authenticated?: boolean; user?: {{ id?: string }} }};
    if (session.authenticated !== true || !session.user?.id) {{
      return {{ authenticated: false, response: Response.json({{ error: 'Luth session is invalid or expired.' }}, {{ status: 401 }}) }};
    }}
    return {{ authenticated: true, userId: session.user.id }};
  }} catch {{
    return {{ authenticated: false, response: Response.json({{ error: 'Canonical Luth authentication service unavailable.' }}, {{ status: 503 }}) }};
  }}
}}
"""
        luth_session_file.write_text(luth_session_content, encoding="utf-8")
        created.append(luth_session_file)

    # 3. Canonical Skipo frontend page contract + component facade
    frontend_components = target_root / "src" / "frontend" / "components"
    pages_root = target_root / "src" / "frontend" / "pages"
    required_page_dirs = [
        pages_root / "auth",
        pages_root / "menus" / "workspaces",
        pages_root / "main" / "tabs",
        pages_root / "settings" / "tabs" / "themes",
        pages_root / "settings" / "tabs" / "accounts",
    ]
    frontend_components.mkdir(parents=True, exist_ok=True)
    # Copy generic module/runtime infrastructure from the canonical Skipo framework.\n    module_ui_source = SKIPO_ROOT / "src" / "frontend" / "components" / "module-ui"\n    module_ui_target = frontend_components / "module-ui"\n    module_ui_target.mkdir(parents=True, exist_ok=True)\n    for source in module_ui_source.glob("*.ts*"):\n        target = module_ui_target / source.name\n        if not target.exists():\n            target.write_text(source.read_text(encoding="utf-8"), encoding="utf-8")\n            created.append(target)\n\n    for page_dir in required_page_dirs:
        page_dir.mkdir(parents=True, exist_ok=True)

    components_file = frontend_components / "components.ts"
    if not components_file.exists():
        components_file.write_text(
            "export * from '@ultrst-armada/floks/ui';\n"
            "export { InfiniteCanvas, DockBar, FrnlEditableNodeGraph } from '@ultrst-armada/floks/canvas-ui';\n"
            "export { ModuleUIHost, registerSkipoModuleUI } from './module-ui/index.js';\n"
            "export type { ModuleUIExport, ModuleSurfaceProps, ModuleSurfaceType, SkipoModuleUIContribution } from './module-ui/index.js';\n",
            encoding="utf-8",
        )
        created.append(components_file)

    # Generic backend/module framework files are copied verbatim from the canonical framework.\n    for relative_dir in ("module-contract", "modules/runtime", "backend/external"):\n        source_dir = SKIPO_ROOT / "src" / relative_dir\n        target_dir = target_root / "src" / relative_dir\n        if source_dir.is_dir():\n            for source in source_dir.rglob("*"):\n                if source.is_file():\n                    target = target_dir / source.relative_to(source_dir)\n                    target.parent.mkdir(parents=True, exist_ok=True)\n                    if not target.exists():\n                        target.write_text(source.read_text(encoding="utf-8"), encoding="utf-8")\n                        created.append(target)\n    for relative_file in (\n        "schemas/skipo.module.schema.json",\n        "src/backend/BackendFacade.ts", "src/backend/BackendFacadeTypes.ts",\n        "src/backend/BackendCapabilityCatalog.ts", "src/backend/ModuleBackendAdapter.ts",\n        "src/backend/ModuleBackendAdapterTypes.ts", "src/backend/externalInterfaces.ts",\n    ):\n        source = SKIPO_ROOT / relative_file\n        target = target_root / relative_file\n        if source.is_file() and not target.exists():\n            target.parent.mkdir(parents=True, exist_ok=True)\n            target.write_text(source.read_text(encoding="utf-8"), encoding="utf-8")\n            created.append(target)\n\n    page_templates = {
        pages_root / "auth" / "LuthAuthPage.tsx": """'use client';

import React from 'react';
import { LuthAuthPage as FloksLuthAuthPage } from '@ultrst-armada/floks/auth';

export function LuthAuthPage({ applicationId, appName, onAuthenticated }: {
  applicationId: string;
  appName: string;
  onAuthenticated?: (user: unknown) => void;
}) {
  return <FloksLuthAuthPage ecosystemId="ultrst-armada"
    applicationId={applicationId} appName={appName}
    onAuthenticated={onAuthenticated as any} />;
}

export default LuthAuthPage;
""",
        pages_root / "auth" / "luthFetch.ts": """'use client';

import { createLuthAuthClient } from '@dinilmusick/gutts/auth';

const luthClient = createLuthAuthClient({
  ecosystemId: 'ultrst-armada',
  applicationId: "__SKIPO_APPLICATION_ID__",
  autoRegister: true,
});

/** Attach the canonical Luth bearer token to protected application API requests. */
export async function luthFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  new Headers(luthClient.getAuthHeaders()).forEach((value, key) => headers.set(key, value));
  return fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
    cache: init.cache ?? 'no-store',
  });
}
""",
        pages_root / "auth" / "page.tsx": (
            "import React from 'react';\n"
            "import { LuthAuthPage } from './LuthAuthPage.js';\n\n"
            f"export function AuthPage(props: {{ onAuthenticated?: (user: unknown) => void }}) {{\n"
            f"  return <LuthAuthPage applicationId=\"{app_name.lower().replace(' ', '-')}\" appName=\"{pascal}\" onAuthenticated={{props.onAuthenticated}} />;\n"
            "}\n\n"
            "export default AuthPage;\n"
        ),
        pages_root / "menus" / "workspaces" / "page.tsx": (
            "export { WorkspaceTilesMenu } from '@ultrst-armada/floks/ui';\n"
        ),
        pages_root / "main" / "page.tsx": """import React, { useState } from 'react';
import { frnlPage as FrnlPage } from '../../components/components.js';
import { ModuleUIHost } from '../../components/module-ui/ModuleUIHost.js';

export function MainPage({ children }: { children?: React.ReactNode }) {
  const [immersive, setImmersive] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <div data-skipo-main-page="true" data-immersive={immersive}>
      <nav>
        <button type="button" onClick={() => setSettingsOpen((value) => !value)}>Settings</button>
        <button type="button" data-skipo-immersive-toggle="true" onClick={() => setImmersive((value) => !value)}>
          {immersive ? 'Exit immersive' : 'Immersive'}
        </button>
      </nav>
      <FrnlPage showTopBar={!immersive} showBottomBar={!immersive}>
        {settingsOpen ? <div>Settings</div> : children}
      </FrnlPage>
      <ModuleUIHost />
    </div>
  );
}

export default MainPage;
""",
        pages_root / "main" / "tabs" / "README.md": (
            "# Main Tabs\\n\\nApplication-specific working UI belongs in additional tab directories under this folder.\\n"
        ),
        pages_root / "settings" / "page.tsx": (
            "import React, { useState } from 'react';\n"
            "import ThemesTab from './tabs/themes/page.js';\n"
            "import AccountsTab from './tabs/accounts/page.js';\n\n"
            "export default function SettingsPage() {\n"
            "  const [tab, setTab] = useState<'themes' | 'accounts'>('themes');\n"
            "  return <div><nav><button onClick={() => setTab('themes')}>Themes</button><button onClick={() => setTab('accounts')}>Accounts</button></nav>{tab === 'themes' ? <ThemesTab /> : <AccountsTab />}</div>;\n"
            "}\n"
        ),
        pages_root / "settings" / "tabs" / "themes" / "page.tsx": (
            "export default function ThemesTab() { return null; }\n"
        ),
        pages_root / "settings" / "tabs" / "accounts" / "page.tsx": (
            "export default function AccountsTab() { return <button type=\"button\">Sync from SRKL</button>; }\n"
        ),
    }
    # app tab directory is created lazily so the template file has a parent.
    for page_file, content in page_templates.items():
        page_file.parent.mkdir(parents=True, exist_ok=True)
        if page_file.name == "luthFetch.ts":
            content = content.replace("__SKIPO_APPLICATION_ID__", app_name.lower().replace(" ", "-"))
        if not page_file.exists():
            page_file.write_text(content, encoding="utf-8")
            created.append(page_file)

    app_tsx = target_root / "src" / "frontend" / "App.tsx"
    if not app_tsx.exists():
        app_tsx.write_text(
            """import MainPage from './pages/main/page.js';
import { FrnlSemanticInputProvider } from '@ultrst-armada/frnlts';

export function App() {
  const workspaceId = typeof window === 'undefined' ? 'default' : localStorage.getItem('skipo-active-workspace') || 'default';
  return <FrnlSemanticInputProvider value={{ workspace: workspaceId }}><MainPage /></FrnlSemanticInputProvider>;
}

export default App;
""",
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

    val_22 = SKIPO_ROOT / "checklists" / "22_import_direction_governance.py"
    if val_22.exists():
        res = subprocess.run(["python3", str(val_22), str(target_root)], capture_output=True, text=True)
        if res.returncode != 0:
            errors.append(f"[ASPECT 22 VIOLATION]\n{res.stdout or res.stderr}")

    val_23 = SKIPO_ROOT / "checklists" / "23_graph_application_contract.py"
    if val_23.exists():
        res = subprocess.run(["python3", str(val_23), str(target_root)], capture_output=True, text=True)
        if res.returncode != 0:
            errors.append(f"[ASPECT 23 VIOLATION]\n{res.stdout or res.stderr}")

    # If tsconfig.json and node_modules exist, run TypeScript typecheck
    tsconfig = target_root / "tsconfig.json"
    if tsconfig.exists() and (target_root / "node_modules").exists():
        cmd = ["npx", "tsc", "--noEmit"] if (target_root / "package-lock.json").exists() else ["pnpm", "exec", "tsc", "--noEmit"]
        res = subprocess.run(cmd, cwd=str(target_root), capture_output=True, text=True)
        if res.returncode != 0 and cmd[0] == "pnpm":
            res = subprocess.run(["npx", "tsc", "--noEmit"], cwd=str(target_root), capture_output=True, text=True)
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
