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
                "@ultrst-armada/krnl": "^1.0.11",
                "@ultrst-armada/kloks": "^1.24.9",
                "@dinilmusick/gutts": "^1.4.3",
                "@ultrst-armada/floks": "^1.13.15",
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
        auth_guard_file.write_text("""import { DEFAULT_LUTH_URL } from '@ultrst-armada/kloks/auth';

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

    # 2. src/backend/aikoRuntime.ts
    aiko_runtime_file = target_root / "src" / "backend" / "aikoRuntime.ts"
    if not aiko_runtime_file.exists():
        aiko_runtime_content = """import { AikoRuntime } from '@ultrst-armada/kloks/aiko';
import type { AikoCapability, AikoSourceKind } from '@ultrst-armada/kloks/aiko';
import { AIKeyServiceFacade } from '@ultrst-armada/kloks/krnl-ai-services';
import { guttsFodNodeDefinitions, executeGuttsApi } from '@dinilmusick/gutts/api';
import { scanBackendFacadeToNodes } from '@ultrst-armada/kloks/fod';

export function createAikoRuntime(
  workspaceId: string,
  input: {
    fod: any;
    backend: any;
  },
) {
  const { fod, backend } = input;
  const host = scanBackendFacadeToNodes(backend);
  const engineUrl = typeof process !== 'undefined' ? process.env.AIKO_ENGINE_URL : undefined;

  const resolve = async (specId?: string, context?: any) => {
    if (!engineUrl) throw new Error('AIKO_ENGINE_URL is required for the embedded Aiko module.');
    const response = await fetch(engineUrl.replace(/\\/$/, '') + '/api/module/resolve-intelligence', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(typeof process !== 'undefined' && process.env.AIKO_MODULE_TOKEN
          ? { 'x-aiko-module-token': process.env.AIKO_MODULE_TOKEN }
          : {}),
      },
      body: JSON.stringify({ specId, ...context }),
    });
    if (!response.ok) throw new Error('Aiko Engine intelligence resolver request failed.');
    return response.json();
  };

  const capabilities = async (): Promise<AikoCapability[]> => {
    const endpointCapabilities: AikoCapability[] = (host?.endpoints ?? [])
      .filter((endpoint: any) => !String(endpoint.id).toLowerCase().includes('aiko') && !String(endpoint.serviceId).toLowerCase().includes('aiko') && !String(endpoint.serviceName).toLowerCase().includes('aiko'))
      .map((endpoint: any) => ({
        id: String(endpoint.id),
        name: endpoint.operationName || endpoint.id,
        description: endpoint.description,
        sourceKind: 'endpoint' as AikoSourceKind,
        sourceId: String(endpoint.id),
        inputSchema: endpoint.inputSchema,
        execute: (input: unknown) => endpoint.invoke(input),
      }));

    const flowCapabilities: AikoCapability[] = (await fod.listFlows()).map((flow: any) => ({
      id: String(flow.id),
      name: flow.name,
      description: flow.description,
      sourceKind: 'fod-flow' as AikoSourceKind,
      sourceId: String(flow.id),
      inputSchema: flow.inputSchema,
      execute: async (input: unknown) => {
        const result = await fod.executeFlow(String(flow.id), input);
        if (!result.success) throw new Error(result.errors?.[0]?.message || 'Flow execution failed');
        return result.output;
      },
    }));

    const guttsCapabilities: AikoCapability[] = guttsFodNodeDefinitions.map((node: any) => ({
      id: String(node.metadata.apiId),
      name: node.label,
      description: node.description,
      sourceKind: 'gutts-api' as AikoSourceKind,
      sourceId: String(node.metadata.apiId),
      inputSchema: node.inputSchema,
      execute: (input: unknown) => executeGuttsApi(String(node.metadata.apiId), input as Record<string, unknown>),
    }));

    return [...endpointCapabilities, ...flowCapabilities, ...guttsCapabilities];
  };

  const resolveNaturalLanguage = async (agent: any, inputText: string) => {
    if (!engineUrl) throw new Error('AIKO_ENGINE_URL is required for natural-language Aiko execution.');
    const response = await fetch(engineUrl.replace(/\\/$/, '') + '/api/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: inputText }],
        intelligenceSpec: agent.intelligenceSpec,
        tools: [{ type: 'function', function: {
          name: agent.tool.id,
          description: agent.tool.description || agent.tool.name,
          parameters: agent.tool.inputSchema || { type: 'object' },
        }}],
        tool_choice: { type: 'function', function: { name: agent.tool.id } },
      }),
    });
    if (!response.ok) throw new Error('Aiko Engine natural-language resolution failed.');
    const payload = await response.json();
    const argumentsText = payload.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argumentsText) throw new Error('Aiko Engine did not return a structured tool payload.');
    return JSON.parse(argumentsText);
  };

  const applicationAgent = {
    schemaVersion: '1.0.0' as const,
    id: 'skipo-application-agent',
    name: 'Application Agent',
    description: 'Universal conversational application router',
    agentType: 'AIKO' as const,
    intelligenceSpec: { mode: 'application-router' },
    sourceKind: 'custom' as const,
    sourceId: 'application',
    custom: true,
    tool: {
      id: 'skipo.application',
      name: 'Application Agent',
      description: 'Route a natural-language request to an application capability.',
      sourceKind: 'custom' as const,
      sourceId: 'application',
      inputSchema: { type: 'object', properties: { capabilityId: { type: 'string' }, input: {} }, required: ['capabilityId', 'input'] },
      execute: async (value: unknown) => {
        const request = value as { capabilityId?: string; input?: unknown };
        const capability = (await capabilities()).find(item => item.id === request.capabilityId);
        if (!capability) throw new Error('Application Agent resolved an unknown capability: ' + request.capabilityId);
        return capability.execute(request.input);
      },
    },
  };

  return new AikoRuntime({
    customAgents: [applicationAgent],
    capabilities,
    resolver: { resolve },
    resolveNaturalLanguage,
    keys: {
      listKeys: async () => (AIKeyServiceFacade.getKeys() as any[]).map((key: any) => ({
        id: key.id, providerId: key.providerId, label: key.label, status: key.status,
        isActive: key.isActive, emailGroup: key.emailGroup, expiresAt: key.expiresAt,
      })),
      getActiveKey: async (providerId: string) => {
        const facade: any = AIKeyServiceFacade;
        if (typeof facade.getActiveKey === 'function') return facade.getActiveKey(providerId) ?? null;
        const { keyStore } = await import('@ultrst-armada/kloks/ai-keys');
        return keyStore.getActiveKey(providerId) ?? null;
      },
      rotateKey: async (providerId: string) => {
        const facade: any = AIKeyServiceFacade;
        if (typeof facade.rotateKey === 'function') return facade.rotateKey(providerId) ?? null;
        const { keyStore } = await import('@ultrst-armada/kloks/ai-keys');
        return keyStore.getNextKey(providerId) ?? null;
      },
      addKey: async (input: any) => AIKeyServiceFacade.addKey(input) as any,
      syncFromAikoEngine: async () => {
        if (!engineUrl) throw new Error('AIKO_ENGINE_URL is required for Aiko Engine key sync.');
        const response = await fetch(engineUrl.replace(/\\/$/, '') + '/api/module/keys/export', {
          headers: typeof process !== 'undefined' && process.env.AIKO_MODULE_TOKEN
            ? { 'x-aiko-module-token': process.env.AIKO_MODULE_TOKEN } : undefined,
        });
        if (!response.ok) throw new Error('Aiko Engine key synchronization failed.');
        const payload = await response.json();
        const importer = (AIKeyServiceFacade as any).importKeys
          ? (AIKeyServiceFacade as any).importKeys.bind(AIKeyServiceFacade)
          : (await import('@ultrst-armada/kloks/ai-keys')).keyStore.importKeys.bind(
              (await import('@ultrst-armada/kloks/ai-keys')).keyStore,
            );
        const imported = await importer(payload.backup);
        return { synced: imported.importedCount, message: 'Aiko Engine keys synchronized.' };
      },
    },
  });
}

export function createAikoServiceFacade(createRuntime: (workspaceId: string) => any) {
  return {
    id: 'kloks.aiko',
    name: 'AikoService',
    version: '1.0.0',
    runtime: 'server' as const,
    deployment: 'local' as const,
    execute: async (operation: string, input?: any) => {
      const runtime = createRuntime(String(input?.workspaceId || 'default'));
      if (operation === 'listAgents') return runtime.listAgents();
      if (operation === 'executeAgent') return runtime.executeAgent(String(input?.agentId), input?.query);
      if (operation === 'listKeys') return runtime.listKeys();
      if (operation === 'syncFromAikoEngine') return runtime.syncFromAikoEngine();
      if (operation === 'listCapabilities') return runtime.listCapabilities();
      if (operation === 'createCustomAgent') return runtime.createCustomAgent(String(input?.name), input?.capabilityIds, input?.specId);
      throw new Error('Unsupported Aiko operation: ' + operation);
    },
  };
}
"""
        aiko_runtime_file.write_text(aiko_runtime_content, encoding="utf-8")
        created.append(aiko_runtime_file)

    # 2b. src/backend/<AppName>Backend.ts
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
  workingWorkspaceService,
}} from '@ultrst-armada/kloks/backend';
import {{ WorkerExecutionBoundary }} from '@ultrst-armada/krnl';
import {{ FodRuntime, createFodServiceFacadeForWorkspace, scanBackendFacadeToNodes }} from '@ultrst-armada/kloks/fod';
import {{ guttsFodNodeDefinitions, executeGuttsApi }} from '@dinilmusick/gutts/api';
import {{ createAikoRuntime as buildAikoRuntime, createAikoServiceFacade }} from './aikoRuntime.js';

export const {camel}Worker = new WorkerExecutionBoundary('{pascal}Worker');

export const createFodRuntime = (workspaceId: string) => {{
  const runtime = new FodRuntime({{ workspaceId, workspaceService: workingWorkspaceService }});
  const host = scanBackendFacadeToNodes({pascal}Backend as any);
  const guttsEndpoints = guttsFodNodeDefinitions.map((node: any) => ({{
    id: String(node.metadata.apiId),
    serviceId: '@dinilmusick/gutts',
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

export const createAikoRuntime = (workspaceId: string) => {{
  const rt = buildAikoRuntime(workspaceId, {{
    fod: createFodRuntime(workspaceId),
    backend: {pascal}Backend,
  }}) as any;
  rt.reportBug = (report: any) => bugReportService.report(report);
  return rt;
}};

export const AikoServiceFacade = createAikoServiceFacade(createAikoRuntime);

export const {pascal}Backend = {{
  services: {{
    serviceA: ServiceAFacade,
    serviceB: ServiceBFacade,
    audioHardware: AudioHardwareServiceFacade,
    midi: MidiServiceFacade,
    storage: StorageServiceFacade,
    workspace: WorkspaceServiceFacade,
    fod: FodServiceFacade,
    aiko: AikoServiceFacade,
    bugReport: bugReportService,
  }},
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
export * from './aikoRuntime.js';
export {{ default }} from './{pascal}Backend.js';
"""
        backend_barrel.write_text(backend_barrel_content, encoding="utf-8")
        created.append(backend_barrel)

    # 2d. Canonical server-side Luth session boundary for generated API handlers.
    auth_dir = target_root / "src" / "backend" / "auth"
    auth_dir.mkdir(parents=True, exist_ok=True)
    luth_session_file = auth_dir / "luthSession.ts"
    if not luth_session_file.exists():
        luth_session_content = f"""import {{ DEFAULT_LUTH_URL }} from '@ultrst-armada/kloks/auth';

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

    # 2e. src/backend/adapters/aikoRoutes.ts (Aiko API route adapter)
    adapters_dir = target_root / "src" / "backend" / "adapters"
    adapters_dir.mkdir(parents=True, exist_ok=True)
    aiko_routes_file = adapters_dir / "aikoRoutes.ts"
    if not aiko_routes_file.exists():
        aiko_routes_content = """import { createAikoRuntime } from '../index.js';
import { requireLuthSession } from '../auth/luthSession.js';

export async function handleAikoRoutes(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== '/api/aiko') return null;
  const auth = await requireLuthSession(request);
  if (!auth.authenticated) return auth.response;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    const body = (await request.json()) as any;
    const runtime = createAikoRuntime(String(body.workspaceId || 'default'));
    let result: unknown;
    switch (String(body.action)) {
      case 'listAgents':
        result = await runtime.listAgents();
        break;
      case 'executeAgent':
        result = await runtime.executeAgent(String(body.agentId), body.query);
        break;
      case 'listKeys':
        result = await runtime.listKeys();
        break;
      case 'getActiveKey':
        result = await runtime.getActiveKey(String(body.providerId));
        break;
      case 'rotateKey':
        result = await runtime.rotateKey(String(body.providerId));
        break;
      case 'addKey':
        result = await runtime.addKey(body.input);
        break;
      case 'syncFromAikoEngine':
        result = await runtime.syncFromAikoEngine();
        break;
      case 'listCapabilities':
        result = await runtime.listCapabilities();
        break;
      case 'createCustomAgent':
        result = await runtime.createCustomAgent(String(body.name), body.capabilityIds || [], body.specId);
        break;
      default:
        return new Response(JSON.stringify({ error: 'Unsupported Aiko action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
"""
        aiko_routes_file.write_text(aiko_routes_content, encoding="utf-8")
        created.append(aiko_routes_file)

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
    (frontend_components / "aiko").mkdir(parents=True, exist_ok=True)
    for page_dir in required_page_dirs:
        page_dir.mkdir(parents=True, exist_ok=True)

    components_file = frontend_components / "components.ts"
    if not components_file.exists():
        components_file.write_text(
            "export * from '@ultrst-armada/floks/ui';\n"
            "export * from '@ultrst-armada/floks/canvas-ui';\n"
            "export * from '@ultrst-armada/floks/canvas-ui/aiko';\n"
            "export { AikoDirectChat } from './aiko/AikoDirectChat.js';\n",
            encoding="utf-8",
        )
        created.append(components_file)

    page_templates = {
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

import { createLuthAuthClient } from '@ultrst-armada/kloks/auth';

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
        pages_root / "main" / "page.tsx": (
            "import React, { useState } from 'react';\n"
            "import { frnlPage as FrnlPage } from '../../components/components.js';\n\n"
            "export function MainPage({ children, fod, aiko }: { children?: React.ReactNode; fod?: React.ReactNode; aiko?: React.ReactNode }) {\n"
            "  const [immersive, setImmersive] = useState(false);\n"
            "  const [tab, setTab] = useState<'main' | 'fod' | 'aiko' | 'settings'>('main');\n"
            "  const content = tab === 'fod' ? fod : tab === 'aiko' ? aiko : children;\n"
            "  return (\n"
            "    <div data-skipo-main-page=\"true\" data-immersive={immersive}>\n"
            "      <nav><button type=\"button\" onClick={() => setTab('main')}>Main</button><button type=\"button\" onClick={() => setTab('fod')}>FOD</button><button type=\"button\" onClick={() => setTab('aiko')}>Aiko</button><button type=\"button\" onClick={() => setTab('settings')}>Settings</button><button type=\"button\" data-skipo-immersive-toggle=\"true\" onClick={() => setImmersive((value) => !value)}>{immersive ? 'Exit immersive' : 'Immersive'}</button></nav>\n"
            "      <FrnlPage showTopBar={!immersive} showBottomBar={!immersive}>{tab === 'settings' ? <div>Settings</div> : content}</FrnlPage>\n"
            "    </div>\n"
            "  );\n"
            "}\n\n"
            "export default MainPage;\n"
        ),
        pages_root / "main" / "tabs" / "README.md": (
            "# Main Tabs\n\nFOD is mandatory. Application-specific working UI belongs in additional tab directories under this folder.\n"
        ),
        pages_root / "main" / "tabs" / "aiko" / "page.tsx": (
            "import React from 'react';\n"
            "import { AikoModule } from '@ultrst-armada/floks/canvas-ui/aiko';\n\n"
            "export function AikoTab({ runtime, workspaceId }: { runtime: any; workspaceId: string }) { return <AikoModule runtime={runtime} workspaceId={workspaceId} />; }\n"
            "export default AikoTab;\n"
        ),
        pages_root / "main" / "tabs" / "aiko" / "aiko.tsx": (
            "export { AikoTab as default, AikoTab } from './page.js';\n"
        ),
        pages_root / "main" / "tabs" / "fod" / "page.tsx": (
            "import React from 'react';\n"
            "import { FodModule } from '@ultrst-armada/floks/canvas-ui/fod';\n"
            "import type { FodRuntimeLike } from '@ultrst-armada/floks/canvas-ui/fod';\n"
            "import { guttsFodNodeDefinitions } from '@dinilmusick/gutts/api';\n\n"
            "export function FodTab({ runtime, workspaceId, hostNodes = [] }: { runtime: FodRuntimeLike; workspaceId: string; hostNodes?: any[] }) {\n"
            "  return <FodModule runtime={runtime} workspaceId={workspaceId} nodeDefinitions={[...guttsFodNodeDefinitions as any, ...hostNodes]} />;\n"
            "}\n"
            "export default FodTab;\n"
        ),
        pages_root / "main" / "tabs" / "fod" / "fod.tsx": (
            "export { FodTab as default, FodTab } from './page.js';\n"
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
    aiko_chat_target = frontend_components / "aiko" / "AikoDirectChat.tsx"
    if not aiko_chat_target.exists():
        canonical_aiko_chat = SKIPO_ROOT / "src" / "frontend" / "components" / "aiko" / "AikoDirectChat.tsx"
        aiko_chat_target.write_text(canonical_aiko_chat.read_text(encoding="utf-8"), encoding="utf-8")
        created.append(aiko_chat_target)

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
            "import MainPage from './pages/main/page.js';\n"
            "import FodTab from './pages/main/tabs/fod/page.js';\n"
            "import AikoTab from './pages/main/tabs/aiko/page.js';\n"
            "import { createFodRuntime, createAikoRuntime } from '../backend/index.js';\n"
            "import { FrnlSemanticInputProvider } from '@ultrst-armada/frnlts';\n"
            "import { AikoDirectChat } from './components/components.js';\n\n"
            "export function App() { const workspaceId = typeof window === 'undefined' ? 'default' : localStorage.getItem('skipo-active-workspace') || 'default'; const fodRuntime = createFodRuntime(workspaceId); const aikoRuntime = createAikoRuntime(workspaceId); return <FrnlSemanticInputProvider value={{ workspace: workspaceId }}><MainPage fod={<FodTab runtime={fodRuntime} workspaceId={workspaceId} />} aiko={<AikoTab runtime={aikoRuntime} workspaceId={workspaceId} />} /><AikoDirectChat runtime={aikoRuntime} workspaceId={workspaceId} /></FrnlSemanticInputProvider>; }\n\n"
            "export default App;\n",
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
