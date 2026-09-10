import { describe, it, expect, vi } from 'vitest';
import { ConcurrencyManager, ConcurrencyConflictError } from '../connectivity/ConcurrencyManager.js';
import { LockManager } from '../connectivity/LockManager.js';
import { IdempotencyManager } from '../connectivity/IdempotencyManager.js';

describe('ConcurrencyManager', () => {
  it('performs optimistic CAS mutations and increments version', () => {
    const cm = new ConcurrencyManager();
    expect(cm.getVersion('res-1')).toBe(0);

    const cas1 = cm.compareAndSwap('res-1', 0, { name: 'Item 1' });
    expect(cas1.success).toBe(true);
    expect(cas1.newVersion).toBe(1);
    expect(cm.getVersion('res-1')).toBe(1);

    // Conflict: expected 0, but current is 1
    const casConflict = cm.compareAndSwap('res-1', 0, { name: 'Item 1-Conflict' });
    expect(casConflict.success).toBe(false);
    expect(cm.getVersion('res-1')).toBe(1);

    // Success with current version 1
    const cas2 = cm.compareAndSwap('res-1', 1, { name: 'Item 1-Updated' });
    expect(cas2.success).toBe(true);
    expect(cas2.newVersion).toBe(2);
  });

  it('handles optimisticUpdate and throws ConcurrencyConflictError on mismatch', async () => {
    const cm = new ConcurrencyManager();
    cm.setVersion('doc-10', 5);

    const update = await cm.optimisticUpdate('doc-10', 5, async () => {
      return { content: 'New text' };
    });
    expect(update.newVersion).toBe(6);
    expect(update.result).toEqual({ content: 'New text' });

    await expect(
      cm.optimisticUpdate('doc-10', 5, async () => ({ content: 'Stale' }))
    ).rejects.toThrow(ConcurrencyConflictError);
  });
});

describe('LockManager', () => {
  it('enforces FIFO mutual exclusion on identical resource keys', async () => {
    const lm = new LockManager();
    const executionOrder: string[] = [];

    const op1 = lm.withLock('doc-shared', async () => {
      executionOrder.push('start-1');
      await new Promise((r) => setTimeout(r, 20));
      executionOrder.push('end-1');
      return 1;
    });

    const op2 = lm.withLock('doc-shared', async () => {
      executionOrder.push('start-2');
      await new Promise((r) => setTimeout(r, 10));
      executionOrder.push('end-2');
      return 2;
    });

    const [res1, res2] = await Promise.all([op1, op2]);
    expect(res1).toBe(1);
    expect(res2).toBe(2);
    expect(executionOrder).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
  });

  it('times out if lock is held beyond bounded threshold', async () => {
    const lm = new LockManager(20);
    const release = await lm.acquire('stuck-res');

    await expect(lm.acquire('stuck-res', 'worker-2', 15)).rejects.toThrow(/timed out/);
    release();
  });
});

describe('IdempotencyManager', () => {
  it('deduplicates concurrent in-flight executions and returns identical outcome', async () => {
    const im = new IdempotencyManager();
    let executionCounter = 0;

    const slowOperation = () =>
      new Promise<{ count: number }>((resolve) => {
        executionCounter++;
        setTimeout(() => resolve({ count: executionCounter }), 25);
      });

    const p1 = im.executeIdempotent('key-abc', slowOperation);
    const p2 = im.executeIdempotent('key-abc', slowOperation);

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual({ count: 1 });
    expect(r2).toEqual({ count: 1 });
    expect(executionCounter).toBe(1);

    // Subsequent call uses cached result
    const r3 = await im.executeIdempotent('key-abc', slowOperation);
    expect(r3).toEqual({ count: 1 });
    expect(executionCounter).toBe(1);
  });
});
