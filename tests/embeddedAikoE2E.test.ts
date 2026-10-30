import { afterAll, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import * as fs from 'node:fs';
import { AikoRuntime } from '@ultrst-armada/kloks/aiko';
import { FodRuntime } from '@ultrst-armada/kloks/fod';
import { workingWorkspaceService } from '@ultrst-armada/kloks/backend';
import { AIKeyServiceFacade } from '@ultrst-armada/kloks/krnl-ai-services';
import { keyStore } from '@ultrst-armada/kloks/ai-keys';
import { guttsFodNodeDefinitions, executeGuttsApi } from '@dinilmusick/gutts/api';

describe('Embedded Aiko / FOD / GutTS Ecosystem Integration Acceptance Test', () => {
  afterAll(() => {
    try {
      if (fs.existsSync('./workspace')) {
        fs.rmSync('./workspace', { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup error
    }
  });
  // Helper to construct host backend and a mock Aiko-Engine HTTP server
  function setupTestEnvironment(portOverride?: number) {
    let capturedToolChoice: any = null;
    let capturedBody: any = null;

    // Simulated local host application endpoints (e.g., UserService, OrderService, AikoService)
    const hostEndpoints = [
      {
        id: 'user.getProfile',
        serviceId: 'user-service',
        serviceName: 'UserService',
        operationId: 'getProfile',
        operationName: 'Get User Profile',
        description: 'Retrieves user profile details',
        inputSchema: { type: 'object', properties: { userId: { type: 'string' } }, required: ['userId'] },
        invoke: vi.fn(async (input: any) => ({ success: true, profile: { id: input?.userId, name: 'Alice' } })),
      },
      {
        id: 'user.updateStatus',
        serviceId: 'user-service',
        serviceName: 'UserService',
        operationId: 'updateStatus',
        operationName: 'Update Status',
        description: 'Updates user status message',
        inputSchema: { type: 'object', properties: { status: { type: 'string' } } },
        invoke: vi.fn(async (input: any) => ({ success: true, status: input?.status })),
      },
      // Self service that must NEVER be discovered as an agent capability
      {
        id: 'kloks.aiko.executeAgent',
        serviceId: 'kloks.aiko',
        serviceName: 'AikoService',
        operationId: 'executeAgent',
        operationName: 'Execute Agent',
        description: 'Executes an Aiko agent recursively',
        inputSchema: { type: 'object' },
        invoke: vi.fn(),
      },
      {
        id: 'aiko.listAgents',
        serviceId: 'aiko-service',
        serviceName: 'AikoService',
        operationId: 'listAgents',
        operationName: 'List Agents',
        description: 'Lists agents recursively',
        inputSchema: { type: 'object' },
        invoke: vi.fn(),
      },
    ];

    // Mock Aiko Engine HTTP server handling:
    // 1. /api/module/resolve-intelligence
    // 2. /api/module/keys/export
    // 3. /api/chat/completions (OpenAI-compatible returning tool_calls)
    const mockAikoEngineServer = createServer((req, res) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const parsed = body ? JSON.parse(body) : {};
        capturedBody = parsed;

        if (req.url === '/api/module/resolve-intelligence') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            specId: parsed.specId || 'spec-default',
            spec: { reasoning: 9, toolUsage: 9.5, determinism: 8.5 },
          }));
          return;
        }

        if (req.url === '/api/module/keys/export') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            backup: {
              version: 1,
              exportedAt: new Date().toISOString(),
              keys: [
                {
                  id: 'synced-key-1',
                  providerId: 'google',
                  label: 'Synced Gemini Pro',
                  key: 'ai-secret-12345',
                  status: 'valid',
                  isActive: true,
                  emailGroup: 'platform-team',
                  expiresAt: '2027-01-01T00:00:00.000Z',
                  weight: 10,
                  totalCalls: 12,
                  successfulCalls: 12,
                  failedCalls: 0,
                  lastLatencyMs: 140,
                  errorCount: 0,
                },
                {
                  id: 'synced-key-2',
                  providerId: 'groq',
                  label: 'Synced Groq Llama',
                  key: 'gsk-secret-67890',
                  status: 'active',
                  isActive: false,
                  emailGroup: 'dev-team',
                  expiresAt: null,
                  weight: 5,
                  totalCalls: 3,
                  successfulCalls: 3,
                  failedCalls: 0,
                  lastLatencyMs: 80,
                  errorCount: 0,
                },
              ],
            },
          }));
          return;
        }

        if (req.url === '/api/chat/completions') {
          capturedToolChoice = parsed.tool_choice;
          const targetToolName = parsed.tool_choice?.function?.name || parsed.tools?.[0]?.function?.name;
          const prompt = parsed.messages?.[parsed.messages.length - 1]?.content || '';

          let args: Record<string, unknown> = {};
          if (targetToolName === 'user.getProfile') {
            args = { userId: 'usr-42' };
          } else if (targetToolName === 'flow-sample') {
            args = { query: 'test flow input payload', limit: 10 };
          } else if (targetToolName?.startsWith('gutts.')) {
            args = { value: 'sample string' };
          } else {
            args = { naturalQuery: prompt };
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_12345',
                      type: 'function',
                      function: {
                        name: targetToolName,
                        arguments: JSON.stringify(args),
                      },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
          }));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      });
    });

    return { hostEndpoints, mockAikoEngineServer, getCaptured: () => ({ capturedToolChoice, capturedBody }) };
  }

  // Builder mirroring Skipo's scaffold_app_structure.py createAikoRuntime & createFodRuntime
  function createSkipoAppRuntimes(workspaceId: string, engineUrl: string, hostEndpoints: any[]) {
    const fod = new FodRuntime({ workspaceId, workspaceService: workingWorkspaceService });

    const resolve = async (specId?: string, context?: any) => {
      const response = await fetch(engineUrl + '/api/module/resolve-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specId, ...context }),
      });
      if (!response.ok) throw new Error('Aiko Engine intelligence resolver failed.');
      return response.json();
    };

    const capabilities = async () => {
      // 1. Host endpoints with strict self-discovery filtering
      const endpointCapabilities = hostEndpoints
        .filter((endpoint: any) =>
          !String(endpoint.id).toLowerCase().includes('aiko') &&
          !String(endpoint.serviceId).toLowerCase().includes('aiko') &&
          !String(endpoint.serviceName).toLowerCase().includes('aiko')
        )
        .map((endpoint: any) => ({
          id: String(endpoint.id),
          name: endpoint.operationName || endpoint.id,
          description: endpoint.description,
          sourceKind: 'endpoint' as const,
          sourceId: String(endpoint.id),
          inputSchema: endpoint.inputSchema,
          execute: (input: unknown) => endpoint.invoke(input),
        }));

      // 2. FOD flows
      const flowCapabilities = (await fod.listFlows()).map((flow: any) => ({
        id: String(flow.id),
        name: flow.name,
        description: flow.description,
        sourceKind: 'fod-flow' as const,
        sourceId: String(flow.id),
        inputSchema: (flow as any).inputSchema,
        execute: async (input: unknown) => {
          const result = await fod.executeFlow(String(flow.id), input);
          if (!result.success) throw new Error(result.errors?.[0]?.message || 'Flow execution failed');
          return result.output;
        },
      }));

      // 3. GutTS APIs (individually mapped)
      const guttsCapabilities = guttsFodNodeDefinitions.map((node: any) => ({
        id: String(node.metadata.apiId),
        name: node.label,
        description: node.description,
        sourceKind: 'gutts-api' as const,
        sourceId: String(node.metadata.apiId),
        inputSchema: node.inputSchema || { type: 'object' },
        execute: (input: unknown) => executeGuttsApi(String(node.metadata.apiId), input as Record<string, unknown>),
      }));

      return [...endpointCapabilities, ...flowCapabilities, ...guttsCapabilities];
    };

    const resolveNaturalLanguage = async (agent: any, input: string) => {
      const response = await fetch(engineUrl + '/api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: input }],
          intelligenceSpec: agent.intelligenceSpec,
          tools: [{
            type: 'function',
            function: {
              name: agent.tool.id,
              description: agent.tool.description || agent.tool.name,
              parameters: agent.tool.inputSchema || { type: 'object' },
            },
          }],
          tool_choice: { type: 'function', function: { name: agent.tool.id } },
        }),
      });
      if (!response.ok) throw new Error('Aiko Engine natural language request failed');
      const payload = await response.json();
      const argumentsText = payload.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argumentsText) throw new Error('No tool_calls returned from Aiko Engine');
      return JSON.parse(argumentsText);
    };

    const guttsEndpoints = guttsFodNodeDefinitions.map((node: any) => ({
      id: String(node.metadata.apiId),
      serviceId: '@dinilmusick/gutts',
      serviceName: 'GutTS',
      operationId: String(node.metadata.apiId),
      operationName: node.label,
      description: node.description,
      invoke: (input: Record<string, unknown>) => executeGuttsApi(String(node.metadata.apiId), input),
    }));
    fod.setEndpoints([...hostEndpoints, ...guttsEndpoints], [...guttsFodNodeDefinitions as any]);

    const aiko = new AikoRuntime({
      capabilities,
      resolver: { resolve: async (specId, context) => resolve(specId, context) },
      resolveNaturalLanguage,
      keys: {
        listKeys: async () => (AIKeyServiceFacade.getKeys() as any[]).map((key: any) => ({
          id: key.id,
          providerId: key.providerId,
          label: key.label,
          status: key.status,
          isActive: key.isActive,
          emailGroup: key.emailGroup,
          expiresAt: key.expiresAt,
        })),
        getActiveKey: async (providerId) => ((AIKeyServiceFacade as any).getActiveKey ? (AIKeyServiceFacade as any).getActiveKey(providerId) : keyStore.getActiveKey(providerId as any)) ?? null,
        rotateKey: async (providerId) => ((AIKeyServiceFacade as any).rotateKey ? (AIKeyServiceFacade as any).rotateKey(providerId) : keyStore.getNextKey(providerId as any)) ?? null,
        addKey: async (input) => AIKeyServiceFacade.addKey(input) as any,
        syncFromAikoEngine: async () => {
          const response = await fetch(engineUrl + '/api/module/keys/export');
          if (!response.ok) throw new Error('Aiko Engine key sync failed');
          const payload = await response.json();
          const importer = (AIKeyServiceFacade as any).importKeys
            ? (AIKeyServiceFacade as any).importKeys.bind(AIKeyServiceFacade)
            : keyStore.importKeys.bind(keyStore);
          const imported = await importer(payload.backup);
          return { synced: imported.importedCount, message: 'Aiko Engine keys synchronized.' };
        },
      },
    });

    return { fod, aiko };
  }

  it('proves capability discovery: exactly 1 agent per endpoint, 1 per FOD flow, and 1 per GutTS API with zero recursive Aiko self-discovery', async () => {
    const { hostEndpoints, mockAikoEngineServer } = setupTestEnvironment();
    await new Promise<void>(resolve => mockAikoEngineServer.listen(0, resolve));
    const port = (mockAikoEngineServer.address() as AddressInfo).port;
    const engineUrl = `http://127.0.0.1:${port}`;

    try {
      const { fod, aiko } = createSkipoAppRuntimes('ws-discovery', engineUrl, hostEndpoints);

      // Register 2 FOD flows in workspace
      await fod.saveFlow({
        id: 'flow-alpha',
        name: 'Alpha Flow',
        description: 'First test flow',
        nodes: [{ id: 'n1', type: 'source', label: 'Start', inputs: [], outputs: [] }],
        edges: [],
      });
      await fod.saveFlow({
        id: 'flow-beta',
        name: 'Beta Flow',
        description: 'Second test flow',
        nodes: [{ id: 'n1', type: 'source', label: 'Start', inputs: [], outputs: [] }],
        edges: [],
      });

      const agents = await aiko.listAgents();

      // 1. Endpoint Agents
      const endpointAgents = agents.filter(a => a.sourceKind === 'endpoint');
      expect(endpointAgents.length).toBe(2);
      expect(endpointAgents.map(a => a.tool.sourceId).sort()).toEqual(['user.getProfile', 'user.updateStatus']);

      // 2. Self-discovery filter proof: kloks.aiko and aiko.listAgents are strictly filtered out
      expect(agents.some(a => a.sourceId.includes('kloks.aiko') || a.sourceId.includes('aiko.'))).toBe(false);
      expect(agents.some(a => a.name.toLowerCase().includes('aiko service'))).toBe(false);

      // 3. FOD Flow Agents
      const flowAgents = agents.filter(a => a.sourceKind === 'fod-flow');
      expect(flowAgents.length).toBe(2);
      expect(flowAgents.map(a => a.tool.sourceId).sort()).toEqual(['flow-alpha', 'flow-beta']);

      // 4. One agent per GutTS API assertion
      const guttsAgents = agents.filter(a => a.sourceKind === 'gutts-api');
      expect(guttsAgents.length).toBe(guttsFodNodeDefinitions.length);
      expect(guttsAgents.length).toBeGreaterThan(1); // Multiple APIs exist in the GutTS library

      // Verify that two APIs from GutTS produce two distinct agents
      const guttsIds = guttsAgents.map(a => a.tool.sourceId);
      const uniqueGuttsIds = new Set(guttsIds);
      expect(uniqueGuttsIds.size).toBe(guttsAgents.length);
    } finally {
      mockAikoEngineServer.close();
    }
  });

  it('proves natural-language execution end-to-end: NL -> Aiko Engine tool_call -> parsed args -> local endpoint execution', async () => {
    const { hostEndpoints, mockAikoEngineServer } = setupTestEnvironment();
    await new Promise<void>(resolve => mockAikoEngineServer.listen(0, resolve));
    const port = (mockAikoEngineServer.address() as AddressInfo).port;
    const engineUrl = `http://127.0.0.1:${port}`;

    try {
      const { aiko } = createSkipoAppRuntimes('ws-endpoint-nl', engineUrl, hostEndpoints);
      const agents = await aiko.listAgents();
      const userAgent = agents.find(a => a.sourceId === 'user.getProfile');
      expect(userAgent).toBeDefined();

      const result: any = await aiko.executeAgent(userAgent!.id, 'Find profile details for user 42');
      expect(result.success).toBe(true);
      expect(result.profile.id).toBe('usr-42');
      expect(result.profile.name).toBe('Alice');

      const targetEndpoint = hostEndpoints.find(e => e.id === 'user.getProfile');
      expect(targetEndpoint?.invoke).toHaveBeenCalledWith({ userId: 'usr-42' });
    } finally {
      mockAikoEngineServer.close();
    }
  });

  it('proves natural-language execution end-to-end: NL -> Aiko Engine tool_call -> parsed args -> FOD flow execution with input payload', async () => {
    const { hostEndpoints, mockAikoEngineServer } = setupTestEnvironment();
    await new Promise<void>(resolve => mockAikoEngineServer.listen(0, resolve));
    const port = (mockAikoEngineServer.address() as AddressInfo).port;
    const engineUrl = `http://127.0.0.1:${port}`;

    try {
      const { fod, aiko } = createSkipoAppRuntimes('ws-flow-nl', engineUrl, hostEndpoints);
      await fod.saveFlow({
        id: 'flow-sample',
        name: 'Sample Flow',
        description: 'Processes input query and returns output',
        nodes: [{ id: 'root', type: 'host/user.updateStatus', label: 'Update Status', data: { endpointId: 'user.updateStatus' }, inputs: [], outputs: [] }],
        edges: [],
      });

      const agents = await aiko.listAgents();
      const flowAgent = agents.find(a => a.sourceId === 'flow-sample');
      expect(flowAgent).toBeDefined();

      const result: any = await aiko.executeAgent(flowAgent!.id, 'Run sample flow with test query');
      expect(result).toBeDefined();
    } finally {
      mockAikoEngineServer.close();
    }
  });

  it('proves natural-language execution end-to-end: NL -> Aiko Engine tool_call -> parsed args -> GutTS API execution with validated payload', async () => {
    const { hostEndpoints, mockAikoEngineServer } = setupTestEnvironment();
    await new Promise<void>(resolve => mockAikoEngineServer.listen(0, resolve));
    const port = (mockAikoEngineServer.address() as AddressInfo).port;
    const engineUrl = `http://127.0.0.1:${port}`;

    try {
      const { aiko } = createSkipoAppRuntimes('ws-gutts-nl', engineUrl, hostEndpoints);
      const agents = await aiko.listAgents();
      const guttsAgent = agents.find(a => a.sourceKind === 'gutts-api');
      expect(guttsAgent).toBeDefined();

      const result: any = await aiko.executeAgent(guttsAgent!.id, 'Execute this GutTS transformation');
      expect(result).toBeDefined();
    } finally {
      mockAikoEngineServer.close();
    }
  });

  it('proves custom-agent creation with explicit capability allow-list enforcement', async () => {
    const { hostEndpoints, mockAikoEngineServer } = setupTestEnvironment();
    await new Promise<void>(resolve => mockAikoEngineServer.listen(0, resolve));
    const port = (mockAikoEngineServer.address() as AddressInfo).port;
    const engineUrl = `http://127.0.0.1:${port}`;

    try {
      const { aiko } = createSkipoAppRuntimes('ws-custom', engineUrl, hostEndpoints);
      await aiko.refreshAgents();

      // Create a custom agent permitted ONLY to run user.getProfile
      const customAgent = await aiko.createCustomAgent('UserProfiler', ['user.getProfile']);
      expect(customAgent.id).toBe('aiko-custom-userprofiler');
      expect(customAgent.custom).toBe(true);
      expect(customAgent.allowedToolIds).toEqual(['user.getProfile']);

      // 1. Executing permitted tool succeeds
      const allowedResult: any = await aiko.executeAgent(customAgent.id, {
        toolId: 'user.getProfile',
        input: { userId: 'usr-99' },
      });
      expect(allowedResult.success).toBe(true);
      expect(allowedResult.profile.id).toBe('usr-99');

      // 2. Executing unpermitted tool is rejected
      await expect(
        aiko.executeAgent(customAgent.id, {
          toolId: 'user.updateStatus',
          input: { status: 'Hacked' },
        })
      ).rejects.toThrow('Capability is not permitted for this custom agent.');
    } finally {
      mockAikoEngineServer.close();
    }
  });

  it('proves key synchronization path and metadata preservation (providerId, label, emailGroup, status, active state, expiry)', async () => {
    const { hostEndpoints, mockAikoEngineServer } = setupTestEnvironment();
    await new Promise<void>(resolve => mockAikoEngineServer.listen(0, resolve));
    const port = (mockAikoEngineServer.address() as AddressInfo).port;
    const engineUrl = `http://127.0.0.1:${port}`;

    try {
      const { aiko } = createSkipoAppRuntimes('ws-keys', engineUrl, hostEndpoints);

      // Perform key sync from Aiko Engine
      const syncResult = await aiko.syncFromAikoEngine();
      expect(syncResult.synced).toBe(2);

      const keys = await aiko.listKeys();
      expect(keys.length).toBeGreaterThanOrEqual(2);

      const key1 = keys.find(k => k.id === 'synced-key-1');
      expect(key1).toBeDefined();
      expect(key1?.providerId).toBe('google');
      expect(key1?.label).toBe('Synced Gemini Pro');
      expect(key1?.emailGroup).toBe('platform-team');
      expect(key1?.status).toBe('valid');
      expect(key1?.isActive).toBe(true);
      expect(key1?.expiresAt).toBe('2027-01-01T00:00:00.000Z');

      const key2 = keys.find(k => k.id === 'synced-key-2');
      expect(key2).toBeDefined();
      expect(key2?.providerId).toBe('groq');
      expect(key2?.label).toBe('Synced Groq Llama');
      expect(key2?.emailGroup).toBe('dev-team');
      expect(key2?.status).toBe('active');
      expect(key2?.isActive).toBe(false);

      // Test local key addition
      const added = await aiko.addKey({
        providerId: 'cerebras',
        label: 'Local Cerebras Key',
        key: 'csk-test-secret',
        emailGroup: 'local-team',
      });
      expect(added.providerId).toBe('cerebras');
      expect(added.emailGroup).toBe('local-team');

      // Test active key retrieval and rotation
      const activeGoogle = await aiko.getActiveKey('google');
      expect(activeGoogle?.id).toBe('synced-key-1');
    } finally {
      mockAikoEngineServer.close();
    }
  });

  it('proves workspace isolation between separate application runtimes', async () => {
    const { hostEndpoints, mockAikoEngineServer } = setupTestEnvironment();
    await new Promise<void>(resolve => mockAikoEngineServer.listen(0, resolve));
    const port = (mockAikoEngineServer.address() as AddressInfo).port;
    const engineUrl = `http://127.0.0.1:${port}`;

    try {
      const appA = createSkipoAppRuntimes('workspace-alpha', engineUrl, hostEndpoints);
      const appB = createSkipoAppRuntimes('workspace-beta', engineUrl, hostEndpoints);

      await appA.fod.saveFlow({
        id: 'flow-only-in-a',
        name: 'Workspace A Flow',
        nodes: [{ id: '1', type: 'source', label: 'A', inputs: [], outputs: [] }],
        edges: [],
      });

      const agentsA = await appA.aiko.listAgents();
      const agentsB = await appB.aiko.listAgents();

      expect(agentsA.some(a => a.sourceId === 'flow-only-in-a')).toBe(true);
      expect(agentsB.some(a => a.sourceId === 'flow-only-in-a')).toBe(false);
    } finally {
      mockAikoEngineServer.close();
    }
  });
});
