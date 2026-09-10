import { describe, it, expect, vi } from 'vitest';
import { BackendRegistry } from '../connectivity/BackendRegistry.js';
import { EventBus } from '../connectivity/EventBus.js';
import { CallbackRegistry } from '../connectivity/CallbackRegistry.js';
import { SequenceTracker } from '../connectivity/SequenceTracker.js';

describe('BackendRegistry', () => {
  it('registers capabilities, commands, queries, and exposes contract', async () => {
    const registry = new BackendRegistry('1.0.0');
    registry.registerCapability('doc-management');

    registry.registerCommand('docs', 'create', async (input: { title: string }) => {
      return { id: 'doc-1', title: input.title };
    });

    registry.registerQuery('docs', 'get', async (input: { id: string }) => {
      return { id: input.id, title: 'Existing Doc' };
    });

    const cmd = registry.getCommand('docs', 'create');
    expect(cmd).toBeDefined();
    const result = await cmd!.handler!({ title: 'Hello' });
    expect(result).toEqual({ id: 'doc-1', title: 'Hello' });

    const contract = registry.exposeContract();
    expect(contract.capabilities).toContain('doc-management');
    expect(contract.domains.docs.commands.create).toBeDefined();
    expect(contract.domains.docs.queries.get).toBeDefined();
  });
});

describe('EventBus', () => {
  it('emits events and dispatches to channel and wildcard subscribers', () => {
    const bus = new EventBus();
    const channelEvents: any[] = [];
    const wildcardEvents: any[] = [];

    const unsubChannel = bus.subscribe('doc.created', (e) => channelEvents.push(e));
    const unsubWildcard = bus.subscribe('*', (e) => wildcardEvents.push(e));

    const ev1 = bus.emit('doc.created', { id: '123' });
    expect(ev1.sequence).toBe(1);
    expect(channelEvents).toHaveLength(1);
    expect(wildcardEvents).toHaveLength(1);

    bus.emit('doc.deleted', { id: '123' });
    expect(channelEvents).toHaveLength(1);
    expect(wildcardEvents).toHaveLength(2);

    unsubChannel();
    unsubWildcard();
    bus.emit('doc.created', { id: '456' });
    expect(channelEvents).toHaveLength(1);
    expect(wildcardEvents).toHaveLength(2);
  });

  it('supports buffer replay filtered by sequence and channel', () => {
    const bus = new EventBus();
    bus.emit('user.login', { user: 'Alice' });
    bus.emit('doc.edit', { doc: 'doc-1' });
    bus.emit('user.logout', { user: 'Alice' });

    const recent = bus.getBuffer(1);
    expect(recent).toHaveLength(2);
    expect(recent[0].operation).toBe('doc.edit');

    const filtered = bus.getBuffer(0, 'doc.edit');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].payload).toEqual({ doc: 'doc-1' });
  });
});

describe('CallbackRegistry', () => {
  it('registers functions as opaque handles and allows valid invocation', async () => {
    const registry = new CallbackRegistry(5000);
    const mockFn = vi.fn(async (a: number, b: number) => a + b);

    const handle = registry.register(mockFn, 'session-123', 'math.add');
    expect(handle.id).toMatch(/^cb-/);
    expect(handle.sessionId).toBe('session-123');

    const result = await registry.invoke(handle, [10, 20], 'session-123');
    expect(result).toBe(30);
    expect(mockFn).toHaveBeenCalledWith(10, 20);
  });

  it('rejects invocation on session mismatch or expiration', async () => {
    const registry = new CallbackRegistry(50);
    const handle = registry.register(() => 'secret', 'session-owner');

    await expect(registry.invoke(handle, [], 'session-intruder')).rejects.toThrow(/mismatch/);

    registry.expire(handle);
    await expect(registry.invoke(handle, [], 'session-owner')).rejects.toThrow(/expired/);
  });
});

describe('SequenceTracker', () => {
  it('tracks strictly monotonic sequences and flags duplicates', () => {
    const tracker = new SequenceTracker();
    const r1 = tracker.record('stream-a', 1);
    expect(r1.valid).toBe(true);

    const rDuplicate = tracker.record('stream-a', 1);
    expect(rDuplicate.valid).toBe(false);
    expect(rDuplicate.isDuplicate).toBe(true);
  });

  it('detects sequence gaps and triggers gap handler', () => {
    const tracker = new SequenceTracker();
    const gapHandler = vi.fn();
    tracker.onGap(gapHandler);

    tracker.record('stream-a', 1);
    const rGap = tracker.record('stream-a', 3);

    expect(rGap.valid).toBe(false);
    expect(rGap.hasGap).toBe(true);
    expect(gapHandler).toHaveBeenCalledWith('stream-a', 2, 3);
    expect(tracker.isPaused('stream-a')).toBe(true);

    tracker.resume('stream-a', 3);
    expect(tracker.isPaused('stream-a')).toBe(false);
  });
});
