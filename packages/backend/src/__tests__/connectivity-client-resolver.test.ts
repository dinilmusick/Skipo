import { describe, it, expect, vi } from 'vitest';
import { BackendRegistry } from '../connectivity/BackendRegistry.js';
import { EventBus } from '../connectivity/EventBus.js';
import { CallbackRegistry } from '../connectivity/CallbackRegistry.js';
import { InProcessExecutor } from '../connectivity/InProcessExecutor.js';
import { RemoteExecutor } from '../connectivity/RemoteExecutor.js';
import { BackendResolver } from '../connectivity/BackendResolver.js';
import { BackendClient, createBackendClient } from '../connectivity/BackendClient.js';
import { ITransport } from '../connectivity/Transport.js';
import { Message } from '../connectivity/types.js';

describe('InProcessExecutor & BackendClient', () => {
  it('executes dynamic domain proxy commands and queries with zero serialization', async () => {
    const registry = new BackendRegistry();
    registry.registerCommand('documents', 'create', async (payload: { title: string }) => {
      return { id: 'doc-100', title: payload.title, status: 'created' };
    });

    const executor = new InProcessExecutor(registry);
    const resolver = new BackendResolver({
      strategy: 'LOCAL',
      inProcessExecutor: executor,
    });

    const client = createBackendClient({ resolver });

    // Dynamic domain operation invocation: backend.<domain>.<operation>(payload)
    const result = await client.documents.create({ title: 'System Architecture' });
    expect(result).toEqual({
      id: 'doc-100',
      title: 'System Architecture',
      status: 'created',
    });
  });

  it('handles events across backend and client via EventBus', async () => {
    const eventBus = new EventBus();
    const executor = new InProcessExecutor(undefined, eventBus);
    const resolver = new BackendResolver({ strategy: 'LOCAL', inProcessExecutor: executor });
    const client = new BackendClient({ resolver });

    const receivedEvents: any[] = [];
    const unsub = client.on('workspace.updated', (event) => {
      receivedEvents.push(event);
    });

    await executor.emit({
      id: 'ev-1',
      type: 'EVENT',
      operation: 'workspace.updated',
      payload: { workspaceId: 'ws-1' },
      timestamp: Date.now(),
    });

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].payload).toEqual({ workspaceId: 'ws-1' });
    unsub();
  });
});

describe('RemoteExecutor & Delegation', () => {
  it('mediates commands over transport and routes callbacks via CallbackRegistry', async () => {
    let capturedTransportMessage: Message | null = null;
    let messageListener: ((msg: Message) => void) | null = null;

    const mockTransport: ITransport = {
      connect: vi.fn(async () => {}),
      disconnect: vi.fn(async () => {}),
      isConnected: () => true,
      request: vi.fn(async (msg: Message) => {
        capturedTransportMessage = msg;
        return {
          id: 'res-1',
          type: 'RESULT',
          operation: msg.operation,
          payload: { success: true, echoed: msg.payload },
          correlationId: msg.id,
          timestamp: Date.now(),
        };
      }),
      send: vi.fn(async () => {}),
      subscribe: vi.fn(() => () => {}),
      unsubscribe: vi.fn(),
      onMessage: vi.fn((handler) => {
        messageListener = handler;
      }),
      onError: vi.fn(),
    };

    const callbackRegistry = new CallbackRegistry();
    const remoteExecutor = new RemoteExecutor({
      transport: mockTransport,
      callbackRegistry,
      sessionId: 'test-session',
    });

    const res = await remoteExecutor.execute({
      id: 'req-1',
      type: 'COMMAND',
      operation: 'files.upload',
      payload: { name: 'photo.png' },
      timestamp: Date.now(),
    });

    expect(res).toEqual({ success: true, echoed: { name: 'photo.png' } });
    expect(capturedTransportMessage).toBeDefined();
    expect(capturedTransportMessage!.operation).toBe('files.upload');

    // Test remote callback handle execution
    const frontendCallback = vi.fn(async (x: number) => x * 2);
    const handle = remoteExecutor.registerCallback(frontendCallback);

    // Simulate backend sending CALLBACK_REQUEST to frontend
    expect(messageListener).toBeDefined();
    await messageListener!({
      id: 'cb-req-1',
      type: 'CALLBACK_REQUEST',
      operation: 'calculate',
      payload: { handle, args: [21] },
      timestamp: Date.now(),
    });

    expect(frontendCallback).toHaveBeenCalledWith(21);
  });
});

describe('BackendResolver Failover', () => {
  it('falls back to InProcessExecutor when remote is unhealthy under REMOTE_FIRST', async () => {
    const localExecutor = new InProcessExecutor();
    localExecutor.getRegistry().registerCommand('system', 'ping', () => 'pong-local');

    const resolver = new BackendResolver({
      strategy: 'REMOTE_FIRST',
      inProcessExecutor: localExecutor,
      remoteHealthCheck: async () => false, // remote dead
    });

    const active = await resolver.resolve();
    expect(active).toBe(localExecutor);

    const client = createBackendClient({ resolver });
    const pong = await client.system.ping();
    expect(pong).toBe('pong-local');
  });
});
