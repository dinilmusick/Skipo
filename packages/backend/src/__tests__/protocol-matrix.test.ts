/**
 * @file protocol-matrix.test.ts
 * @description Protocol Compatibility Test Matrix (HTTP, WS, UDP, P2P).
 */

import { describe, it, expect } from 'vitest';
import {
  createServiceDefinition,
  HttpProtocolAdapter,
  WebSocketProtocolAdapter,
  UdpProtocolAdapter,
  P2PProtocolAdapter,
} from '@dinilmusick/krnl';
import {
  createLocalService,
  createRemoteService,
  createBackend,
} from '../services/index.js';

describe('Protocol Compatibility Matrix (HTTP, WS, UDP, P2P)', () => {
  const serviceDef = createServiceDefinition({
    id: 'matrix-ops',
    name: 'MatrixService',
    version: '1.0.0',
    operations: {
      echo: {
        id: 'matrix.echo',
        name: 'echo',
        handler: async (input: any) => input.msg,
      },
    },
  });

  it('HTTP Protocol: LocalService -> Remote Proxy', async () => {
    const local = createLocalService(serviceDef);
    await local.start();
    const adapter = new HttpProtocolAdapter();
    const endpoint = await adapter.expose(local, 0);

    const proxy = createRemoteService(serviceDef, adapter, endpoint);
    const res = await proxy.call('echo', { msg: 'HTTP OK' });
    expect(res).toBe('HTTP OK');

    await adapter.stop();
    await local.stop();
  });

  it('WebSocket Protocol: LocalService -> Remote Proxy', async () => {
    const local = createLocalService(serviceDef);
    await local.start();
    const adapter = new WebSocketProtocolAdapter();
    const endpoint = await adapter.expose(local, 0);

    const proxy = createRemoteService(serviceDef, adapter, endpoint);
    const res = await proxy.call('echo', { msg: 'WS OK' });
    expect(res).toBe('WS OK');

    await adapter.stop();
    await local.stop();
  });

  it('UDP Datagram Protocol: LocalService -> Remote Proxy', async () => {
    const local = createLocalService(serviceDef);
    await local.start();
    const adapter = new UdpProtocolAdapter();
    const endpoint = await adapter.expose(local, 0);

    const proxy = createRemoteService(serviceDef, adapter, endpoint);
    const res = await proxy.call('echo', { msg: 'UDP OK' });
    expect(res).toBe('UDP OK');

    await adapter.stop();
    await local.stop();
  });

  it('P2P Protocol: LocalService -> Remote Proxy', async () => {
    const local = createLocalService(serviceDef);
    await local.start();
    const adapter = new P2PProtocolAdapter();
    const endpoint = await adapter.expose(local);

    const proxy = createRemoteService(serviceDef, adapter, endpoint);
    const res = await proxy.call('echo', { msg: 'P2P OK' });
    expect(res).toBe('P2P OK');

    await adapter.stop();
    await local.stop();
  });

  it('CompositeBackend hosting Remote Proxies over Protocols', async () => {
    const local = createLocalService(serviceDef);
    await local.start();
    const httpAdapter = new HttpProtocolAdapter();
    const endpoint = await httpAdapter.expose(local, 0);

    const remoteSvc = createRemoteService(serviceDef, httpAdapter, endpoint);

    const backend = createBackend('GatewayBackend');
    backend.registerService(remoteSvc);
    await backend.start();

    const res = await backend.call('MatrixService.echo', { msg: 'Composite Gateway OK' });
    expect(res).toBe('Composite Gateway OK');

    await backend.stop();
    await httpAdapter.stop();
    await local.stop();
  });
});
