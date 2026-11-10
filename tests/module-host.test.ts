import { describe, expect, it, vi } from 'vitest';
import { BackendFacade } from '../src/backend/BackendFacade.js';
import {
  ModuleHost,
  ModuleHostError,
  MockModuleHost,
  type ModuleContext,
  type ModuleDefinition
} from '../src/modules/index.js';

function definition(
  id: string,
  mount: (context: ModuleContext) => unknown = () => undefined,
  capabilities: readonly string[] = []
): ModuleDefinition {
  return {
    manifest: {
      id,
      name: `Module ${id}`,
      version: '1.0.0',
      kind: 'skipo-application',
      capabilities
    },
    mount: mount as ModuleDefinition['mount']
  };
}

function parentBackend() {
  return new BackendFacade();
}

describe('Skipo generic ModuleHost', () => {
  it('creates a host with a stable identity and requires a parent backend', () => {
    expect(() => new ModuleHost({ parent: {} as never })).toThrow(
      /requires a parent BackendFacade/
    );
    const host = new ModuleHost({
      parent: { backend: parentBackend() },
      hostId: 'test-host'
    });
    expect(host.id).toBe('test-host');
    expect(host.listDiscovered()).toEqual([]);
  });

  it('discovers, validates, mounts, and injects parent resources', async () => {
    const workspace = { id: 'workspace-1' };
    const authentication = { subject: 'user-1', authenticated: true };
    const theme = { id: 'theme-1' };
    const runtime = { environment: 'integration-test' };
    const host = new ModuleHost({
      parent: {
        backend: parentBackend(),
        workspace,
        authentication,
        theme,
        runtime,
        authorizeCapabilities: (_module, requested) => requested
      }
    });
    let received: ModuleContext | undefined;
    host.discover(definition('context-app', (context) => {
      received = context;
    }));
    const instance = await host.mount('context-app');
    expect(instance.state).toBe('mounted');
    expect(received).toBe(instance.context);
    expect(received?.metadata.id).toBe('context-app');
    expect(received?.metadata.instanceId).toContain('context-app');
    expect(received?.workspace).toEqual(workspace);
    expect(received?.authentication).toEqual(authentication);
    expect(received?.theme).toEqual(theme);
    expect(received?.runtime).toEqual(runtime);
    expect(Object.isFrozen(received)).toBe(true);
    expect(Object.isFrozen(received?.metadata)).toBe(true);
  });

  it('restricts backend access to explicitly approved capabilities', async () => {
    const backend = parentBackend();
    const library = { answer: 42 };
    backend.registerService({
      id: 'service.test',
      name: 'TestService',
      version: '1.0.0',
      libraries: { allowedLibrary: library, deniedLibrary: {} },
      functionalities: {},
      call: async () => undefined
    } as never);
    const host = new ModuleHost({
      parent: {
        backend,
        authorizeCapabilities: (_module, requested) =>
          requested.filter((capability) =>
            capability === 'backend.library:allowedLibrary')
      }
    });
    host.discover(definition(
      'restricted-app',
      () => undefined,
      ['backend.library:allowedLibrary', 'backend.library:deniedLibrary']
    ));
    const instance = await host.mount('restricted-app');
    expect(instance.context.backend.getLibrary('allowedLibrary')).toBe(library);
    expect(() => instance.context.backend.getLibrary('deniedLibrary'))
      .toThrow(/capability denied/i);
    expect(instance.context.capabilities.has('backend.library:allowedLibrary'))
      .toBe(true);
    expect(instance.context.capabilities.has('backend.library:deniedLibrary'))
      .toBe(false);
    expect('registerService' in instance.context.backend).toBe(false);
    expect('getService' in instance.context.backend).toBe(false);
  });

  it('mediates backend execution through a specifically granted capability', async () => {
    const backend = parentBackend();
    backend.registerService({
      id: 'service.math',
      name: 'MathService',
      version: '1.0.0',
      libraries: {},
      functionalities: {
        add: { execute: async ({ a, b }: { a: number; b: number }) => a + b }
      },
      call: async (_operation: string, input: { a: number; b: number }) =>
        input.a + input.b
    } as never);
    const host = new ModuleHost({
      parent: {
        backend,
        authorizeCapabilities: (_module, requested) => requested
      }
    });
    host.discover(definition(
      'execution-app',
      () => undefined,
      ['backend.execute:add']
    ));
    const instance = await host.mount('execution-app');
    await expect(instance.context.backend.executeCapability(
      'add', 'add', { a: 19, b: 23 }
    )).resolves.toBe(42);
  });

  it('runs lifecycle transitions and cleans event listeners and abort signal', async () => {
    const calls: string[] = [];
    const host = new ModuleHost({ parent: { backend: parentBackend() } });
    host.discover(definition('lifecycle-app', () => ({
      activate: () => calls.push('activate'),
      deactivate: () => calls.push('deactivate'),
      unmount: () => calls.push('unmount')
    })));
    const instance = await host.mount('lifecycle-app');
    const listener = vi.fn();
    instance.context.events.on('ping', listener);
    instance.context.events.emit('ping', { ok: true });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(instance.context.lifecycle.getState()).toBe('mounted');

    await instance.activate();
    expect(instance.state).toBe('active');
    expect(instance.context.lifecycle.getState()).toBe('active');
    await instance.deactivate();
    expect(instance.state).toBe('mounted');
    await instance.activate();
    await instance.unmount();

    expect(calls).toEqual([
      'activate', 'deactivate', 'activate', 'deactivate', 'unmount'
    ]);
    expect(instance.state).toBe('unmounted');
    expect(instance.context.lifecycle.signal.aborted).toBe(true);
    expect(host.listMounted()).toEqual([]);
    expect(() => instance.context.events.emit('ping', {})).toThrow(/closed/);
  });

  it('keeps module event buses isolated from other modules', async () => {
    const host = new ModuleHost({ parent: { backend: parentBackend() } });
    host.discover(definition('event-a'));
    host.discover(definition('event-b'));
    const a = await host.mount('event-a');
    const b = await host.mount('event-b');
    const listenerA = vi.fn();
    const listenerB = vi.fn();
    a.context.events.on('changed', listenerA);
    b.context.events.on('changed', listenerB);
    a.context.events.emit('changed', 'from-a');
    expect(listenerA).toHaveBeenCalledWith('from-a');
    expect(listenerB).not.toHaveBeenCalled();
  });

  it('supports multiple independently mounted and activated modules', async () => {
    const host = new ModuleHost({ parent: { backend: parentBackend() } });
    host.discover(definition('alpha'));
    host.discover(definition('beta'));
    const alpha = await host.mount('alpha');
    const beta = await host.mount('beta');
    await alpha.activate();
    expect(alpha.state).toBe('active');
    expect(beta.state).toBe('mounted');
    expect(host.listMounted()).toHaveLength(2);
    await host.unmount('alpha');
    expect(beta.state).toBe('mounted');
    expect(host.listMounted().map((item) => item.id)).toEqual(['beta']);
    await host.unmountAll();
    expect(host.listMounted()).toHaveLength(0);
  });

  it('supports standalone mock-host execution without a parent application', async () => {
    const host = new MockModuleHost();
    host.mockBackend.registerLibrary('fixture', { value: 'mocked' });
    let injected: ModuleContext | undefined;
    host.discover(definition(
      'standalone-app',
      (context) => {
        injected = context;
      },
      ['backend.library:fixture']
    ));
    const instance = await host.mount('standalone-app');
    expect(injected?.backend.getLibrary('fixture')).toEqual({ value: 'mocked' });
    expect(injected?.workspace.id).toBe('mock-workspace');
    expect(injected?.authentication.authenticated).toBe(true);
    await instance.activate();
    expect(instance.state).toBe('active');
  });

  it('rejects malformed modules, duplicate ids, and undiscovered modules', async () => {
    const host = new ModuleHost({ parent: { backend: parentBackend() } });
    expect(() => host.discover({})).toThrow(/definition/i);
    expect(() => host.discover({
      manifest: {
        id: 'INVALID ID',
        name: 'Bad',
        version: '1.0.0',
        kind: 'skipo-application'
      },
      mount: () => undefined
    })).toThrow(/identifier/i);
    expect(() => host.discover(definition('valid'))).not.toThrow();
    expect(() => host.discover(definition('valid'))).toThrow(/already been discovered/);
    await expect(host.mount('missing')).rejects.toThrow(/not been discovered/);
  });

  it('rejects unauthorized capability grants before mounting', async () => {
    const mount = vi.fn();
    const host = new ModuleHost({
      parent: {
        backend: parentBackend(),
        authorizeCapabilities: () => ['backend.execute:unrequested']
      }
    });
    host.discover(definition('grant-app', mount, ['backend.execute:approved']));
    await expect(host.mount('grant-app')).rejects.toBeInstanceOf(ModuleHostError);
    expect(mount).not.toHaveBeenCalled();
    expect(host.listMounted()).toHaveLength(0);
  });

  it('denies all parent capabilities by default', async () => {
    const host = new ModuleHost({ parent: { backend: parentBackend() } });
    host.discover(definition('deny-by-default', () => undefined, [
      'backend.library:secret'
    ]));
    const instance = await host.mount('deny-by-default');
    expect(instance.context.capabilities.approved).toEqual([]);
    expect(() => instance.context.backend.getLibrary('secret'))
      .toThrow(/capability denied/i);
  });

  it('cleans up after a mount failure and reports a typed host error', async () => {
    const host = new ModuleHost({ parent: { backend: parentBackend() } });
    host.discover(definition('broken-app', () => {
      throw new Error('mount exploded');
    }));
    await expect(host.mount('broken-app')).rejects.toMatchObject({
      name: 'ModuleHostError',
      moduleId: 'broken-app',
      operation: 'mounting'
    });
    expect(host.listMounted()).toHaveLength(0);
  });

  it('rolls lifecycle state back when activation fails', async () => {
    const host = new ModuleHost({ parent: { backend: parentBackend() } });
    host.discover(definition('activation-failure', () => ({
      activate: () => {
        throw new Error('activation exploded');
      }
    })));
    const instance = await host.mount('activation-failure');
    await expect(instance.activate()).rejects.toThrow(/activation exploded/);
    expect(instance.state).toBe('mounted');
  });

  it('makes deactivation and unmount idempotent where safe', async () => {
    const host = new ModuleHost({ parent: { backend: parentBackend() } });
    host.discover(definition('idempotent-app'));
    const instance = await host.mount('idempotent-app');
    await instance.deactivate();
    await instance.unmount();
    await instance.unmount();
    expect(instance.state).toBe('unmounted');
  });
});
