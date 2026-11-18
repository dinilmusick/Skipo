import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../scaffolds/vite/src/backend/ecosystem/appIdentity_Pure', () => ({
  appId: 'my-app',
  appRegistrationStatus: 'approved',
  deploymentId: null,
  oauthClientId: null,
  workspaceEnvironment: (env = {}) => ({ ...env, WORKSPACE_APP_ID: 'my-app' }),
}));
import { ServiceFacade } from '@ultrst-armada/krnl';
import { AikoRuntime } from '@ultrst-armada/kloks/aiko';
import { endpointToNode, executeFodFlow } from '@ultrst-armada/kloks/fod';
import { BackendFacade } from '../src/backend/BackendFacade.js';
import { createAppExternalInterfaces } from '../src/backend/externalInterfaces.js';
import { BackendFacade as ViteFacade } from '../scaffolds/vite/src/backend/BackendFacade.js';
import { createAppExternalInterfaces as createViteInterfaces } from '../scaffolds/vite/src/backend/externalInterfaces.js';

const inputSchema = { type: 'object' as const, properties: { value: { type: 'number' as const } }, required: ['value'], additionalProperties: false };
const outputSchema = { type: 'object' as const, properties: { doubled: { type: 'number' as const } }, required: ['doubled'], additionalProperties: false };
const request = new Request('https://app.test/workflows', { headers: { 'x-user-id': 'unverified', authorization: 'Bearer fixture' } });

function setup(create: (service: ServiceFacade) => ReturnType<typeof createAppExternalInterfaces>) {
  const execute = vi.fn(async ({ value }: { value: number }) => {
    if (value < 0) throw new Error('private driver details');
    return { doubled: value * 2 };
  });
  const service = new ServiceFacade({
    id: 'math.test', name: 'Math',
    functionalities: { double: { inputSchema, outputSchema, execute } },
  });
  const authenticate = vi.fn(async () => Response.json({
    authenticated: true, user: { id: 'verified', roles: ['editor'] }, session: { id: 'session' },
  }));
  vi.stubGlobal('fetch', authenticate);
  return { app: create(service), execute, authenticate };
}

afterEach(() => vi.unstubAllGlobals());

describe.each([
  ['framework', (service: ServiceFacade) => createAppExternalInterfaces(new BackendFacade().registerService(service))],
  ['Vite scaffold', (service: ServiceFacade) => createViteInterfaces(new ViteFacade().registerService(service))],
] as const)('%s execution bindings', (_name, create) => {
  it('executes a graph node and an agent through the registered facade operation', async () => {
    const { app } = setup(create);
    const { endpoints, aikoCapabilities } = await app.executionBindings(request);
    const [endpoint] = endpoints;
    const node = endpointToNode(endpoint);
    expect(endpoint.id).toMatch(/^[A-Za-z0-9_.-]+$/);
    expect(aikoCapabilities[0].id).toBe(endpoint.id);
    expect(node.inputs).toEqual([expect.objectContaining({ id: 'value', required: true })]);
    const now = new Date(0).toISOString();
    const result = await executeFodFlow({
      id: 'flow', name: 'Double', version: 1, createdAt: now, updatedAt: now, edges: [],
      nodes: [{ id: 'node', type: node.type, data: {}, position: { x: 0, y: 0 } }],
    }, new Map([[endpoint.id, endpoint]]), undefined, { value: 3 });
    expect(result).toMatchObject({ success: true, output: { doubled: 6 } });

    const runtime = new AikoRuntime({
      capabilities: aikoCapabilities,
      resolver: { resolve: () => ({ spec: {} }) },
      keys: { listKeys: async () => [], getActiveKey: async () => null, rotateKey: async () => null, syncFromAikoEngine: async () => ({ synced: 0 }) },
    });
    const [agent] = await runtime.listAgents();
    await expect(runtime.executeAgent(agent.id, { value: 4 })).resolves.toEqual({ doubled: 8 });
  });

  it('rechecks session and roles, validates input, and hides backend exceptions', async () => {
    const { app, execute, authenticate } = setup(create);
    app.registry.register({
      id: 'internal.hidden', description: 'Hidden', inputSchema, outputSchema,
      invocation: { serviceId: 'math.test', operationId: 'double' }, discoverable: false,
    }).register({
      id: 'editor.double', description: 'Editor only', inputSchema, outputSchema,
      invocation: { serviceId: 'math.test', operationId: 'double' }, access: 'roles', requiredRoles: ['editor'],
    });
    const { endpoints, aikoCapabilities } = await app.executionBindings(request);
    expect(endpoints.map(endpoint => endpoint.id)).not.toContain('internal.hidden');
    const editor = aikoCapabilities.find(capability => capability.id === 'editor.double')!;
    await expect(editor.execute(Object.create({ value: 3 }))).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(execute).not.toHaveBeenCalled();
    await expect(editor.execute({ value: -1 })).rejects.toMatchObject({ code: 'INTERNAL_ERROR', message: 'Capability execution failed.' });

    authenticate.mockImplementationOnce(async () => Response.json({
      authenticated: true, user: { id: 'verified', roles: [] }, session: { id: 'session' },
    }));
    await expect(editor.execute({ value: 3 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    authenticate.mockImplementation(async () => new Response(null, { status: 401 }));
    await expect(endpoints[0].invoke({ value: 3 })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(app.executionBindings(request)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});

it('invalidates remote provenance if a registered facade is replaced', async () => {
  const operation = (doubled: number) => new ServiceFacade({
    id: 'math.test', name: 'Math',
    functionalities: { double: { inputSchema, outputSchema, execute: async () => ({ doubled }) } },
  });
  const backend = new BackendFacade().registerService(operation(2));
  const app = createAppExternalInterfaces(backend, ['math.test/functionalities/double']);
  const principal = { userId: 'verified', sessionId: 'session' };
  const context = { principal, transport: 'workflow' as const, requestId: 'remote' };
  const [remote] = app.registry.listRemote(principal);
  await expect(app.registry.invokeRemote(remote.id, { value: 1 }, context)).resolves.toEqual({ doubled: 2 });
  backend.registerService(operation(3));
  expect(app.registry.listRemote(principal)).toEqual([]);
  await expect(app.registry.invokeRemote(remote.id, { value: 1 }, context)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(app.registry.invoke(remote.id, { value: 1 }, context)).resolves.toEqual({ doubled: 3 });
});
