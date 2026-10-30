import { afterAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import { AikoRuntime } from '@ultrst-armada/kloks/aiko';
import { FodRuntime } from '@ultrst-armada/kloks/fod';
import { workingWorkspaceService } from '@ultrst-armada/kloks/backend';
import { keyStore } from '@ultrst-armada/kloks/ai-keys';
import { executeGuttsApi } from '@dinilmusick/gutts/api';

const ENGINE_URL = 'http://localhost:3001';

describe('Live Runtime Acceptance: Aiko-Engine + FOD + GutTS Ecosystem', () => {
  afterAll(() => {
    try {
      if (fs.existsSync('./workspace')) fs.rmSync('./workspace', { recursive: true, force: true });
    } catch {}
  });

  const setupRuntime = async () => {
    const wsId = 'ws-live-test-' + Date.now();
    const fod = new FodRuntime({ workspaceId: wsId, workspaceService: workingWorkspaceService });
    const hostEndpoints = [
      {
        id: 'user.updateStatus', serviceId: 'user-service', serviceName: 'UserService',
        operationId: 'updateStatus', operationName: 'Update Status', description: 'Updates user status message',
        inputSchema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] },
        invoke: async (input: any) => ({ success: true, status: input?.status }),
      },
      {
        id: 'calc.add', serviceId: 'calc-service', serviceName: 'CalculatorService',
        operationId: 'add', operationName: 'Add Numbers', description: 'Adds numbers a and b',
        inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'] },
        invoke: async (input: any) => ({ result: (Number(input?.a) || 0) + (Number(input?.b) || 0) }),
      },
    ];
    fod.setEndpoints(hostEndpoints, []);

    await fod.saveFlow({
      id: 'flow.calculate', name: 'Calculate Flow', description: 'Calculates the sum of a and b',
      inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'] },
      nodes: [{ id: 'n1', type: 'host/calc.add', label: 'Add', data: { endpointId: 'calc.add' }, inputs: [], outputs: [] }],
      edges: [],
    });

    const capabilities = async () => [
      {
        id: 'user.updateStatus', name: 'Update User Status', description: 'Updates user status message',
        sourceKind: 'endpoint' as const, sourceId: 'user.updateStatus',
        inputSchema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] },
        execute: (input: any) => hostEndpoints[0].invoke(input),
      },
      {
        id: 'flow.calculate', name: 'Calculate Flow Capability', description: 'Executes flow calculating sum of a and b',
        sourceKind: 'fod-flow' as const, sourceId: 'flow.calculate',
        inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'] },
        execute: async (input: any) => {
          const res = await fod.executeFlow('flow.calculate', input);
          if (!res.success) throw new Error('Flow execution failed');
          return res.output;
        },
      },
      {
        id: 'gutts.numbers.sum', name: 'GutTS Numbers Sum', description: 'Sums array of numbers using GutTS',
        sourceKind: 'gutts-api' as const, sourceId: 'gutts.numbers.sum',
        inputSchema: { type: 'object', properties: { values: { type: 'array', items: { type: 'number' } } }, required: ['values'] },
        execute: (input: any) => executeGuttsApi('gutts.numbers.sum', input),
      },
    ];

    const resolveNaturalLanguage = async (agent: any, input: string) => {
      const response = await fetch(`${ENGINE_URL}/api/chat/completions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: input }], intelligenceSpec: agent.intelligenceSpec,
          tools: [{ type: 'function', function: { name: agent.tool.id, description: agent.tool.description || agent.tool.name, parameters: agent.tool.inputSchema || { type: 'object' } } }],
          tool_choice: { type: 'function', function: { name: agent.tool.id } },
        }),
      });
      if (!response.ok) throw new Error(`Live Aiko-Engine request failed: ${response.status}`);
      const payload = await response.json();
      const tc = payload.choices?.[0]?.message?.tool_calls?.[0];
      if (!tc?.function?.arguments) throw new Error('No tool_calls in live Aiko-Engine response');
      return { toolName: tc.function.name, args: JSON.parse(tc.function.arguments), raw: payload };
    };

    const aiko = new AikoRuntime({
      capabilities,
      resolver: {
        resolve: async (_specId, context) => {
          const res = await fetch(`${ENGINE_URL}/api/module/resolve-intelligence`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(context || {}),
          });
          return res.json();
        },
      },
      resolveNaturalLanguage: async (agent, input) => (await resolveNaturalLanguage(agent, input)).args,
      keys: {
        listKeys: async () => keyStore.getKeys(),
        getActiveKey: async (pId: string) => keyStore.getActiveKey(pId as any) ?? null,
        rotateKey: async (pId: string) => {
          keyStore.setStrategy('round-robin');
          return keyStore.getActiveKey(pId as any) ?? null;
        },
        addKey: async (k: any) => keyStore.addKey(k),
        syncFromAikoEngine: async () => {
          const res = await fetch(`${ENGINE_URL}/api/module/keys/export`);
          if (!res.ok) throw new Error(`Key export failed: ${res.status}`);
          const data = await res.json();
          const imported = await keyStore.importKeys(data.backup);
          return { synced: imported.importedCount, message: 'Keys synced' };
        },
      },
    });

    return { fod, aiko, resolveNaturalLanguage, hostEndpoints };
  };

  it('connects to live Aiko-Engine and verifies health probe', async () => {
    const res = await fetch(`${ENGINE_URL}/api/health`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.app).toContain('Aiko');
  });

  it('resolves NL queries to tool calls via live Aiko-Engine and executes locally', async () => {
    const { aiko, resolveNaturalLanguage, hostEndpoints, fod } = await setupRuntime();
    const agents = await aiko.listAgents();

    // 1. Endpoint capability
    const epAgent = agents.find(a => a.tool.id === 'user.updateStatus')!;
    expect(epAgent).toBeDefined();
    const epCall = await resolveNaturalLanguage(epAgent, "Please update status to 'active'");
    expect(epCall.toolName).toBe('user.updateStatus');
    expect(epCall.args).toEqual({ status: 'active' });
    const epLocalOut = await hostEndpoints[0].invoke(epCall.args);
    expect(epLocalOut).toEqual({ success: true, status: 'active' });
    const epAgentOut = await aiko.executeAgent(epAgent.id, "Please update status to 'active'");
    expect(epAgentOut).toEqual({ success: true, status: 'active' });

    // 2. FOD-flow capability
    const flowAgent = agents.find(a => a.tool.id === 'flow.calculate')!;
    expect(flowAgent).toBeDefined();
    const flowCall = await resolveNaturalLanguage(flowAgent, 'Calculate the flow with inputs a=15 and b=25');
    expect(flowCall.toolName).toBe('flow.calculate');
    expect(flowCall.args).toEqual({ a: 15, b: 25 });
    const flowLocalOut = await fod.executeFlow('flow.calculate', flowCall.args);
    expect(flowLocalOut.success).toBe(true);
    expect(flowLocalOut.output).toEqual({ result: 40 });
    const flowAgentOut = await aiko.executeAgent(flowAgent.id, 'Calculate the flow with inputs a=15 and b=25');
    expect(flowAgentOut).toEqual({ result: 40 });

    // 3. GutTS API capability
    const guttsAgent = agents.find(a => a.tool.id === 'gutts.numbers.sum')!;
    expect(guttsAgent).toBeDefined();
    const guttsCall = await resolveNaturalLanguage(guttsAgent, 'Sum numbers 40 and 60 using GutTS');
    expect(guttsCall.toolName).toBe('gutts.numbers.sum');
    expect(guttsCall.args).toEqual({ values: [40, 60] });
    const guttsLocalOut = await executeGuttsApi('gutts.numbers.sum', guttsCall.args);
    expect(guttsLocalOut).toBe(100);
    const guttsAgentOut = await aiko.executeAgent(guttsAgent.id, 'Sum numbers 40 and 60 using GutTS');
    expect(guttsAgentOut).toBe(100);
  });

  it('performs real key synchronization from live Aiko-Engine, verifying emailGroup metadata and rotation', async () => {
    const { aiko } = await setupRuntime();
    const syncRes = await aiko.syncFromAikoEngine();
    expect(syncRes.synced).toBeGreaterThanOrEqual(2);

    const keys = await aiko.listKeys();
    const primary = keys.find((k: any) => k.emailGroup === 'ai-governance-core');
    const backup = keys.find((k: any) => k.emailGroup === 'ai-governance-backup');

    expect(primary).toBeDefined();
    expect(primary.status).toBe('active');
    expect(primary.providerId).toBe('google');
    expect(primary.label).toBe('Primary Gemini Key');

    expect(backup).toBeDefined();
    expect(backup.status).toBe('active');
    expect(backup.providerId).toBe('google');
    expect(backup.label).toBe('Backup Gemini Key');

    const rotated1 = await aiko.rotateKey('google');
    expect(rotated1).toBeDefined();
    const rotated2 = await aiko.rotateKey('google');
    expect(rotated2).toBeDefined();
    expect(rotated1?.id).not.toBe(rotated2?.id);
  });
});
