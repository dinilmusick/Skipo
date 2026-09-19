/**
 * @file execution-boundary.test.ts
 * @description Test suite for backend execution boundary, facade, services, and operation components.
 * Verifies Worker-only access, OperationComponent determinism, and idempotency.
 */

import { describe, it, expect } from 'vitest';
import {
  ExecutableBackendFacade,
  WorkerExecutionBoundary,
  ServiceDispatcher,
  createOperationComponent,
  JobDependencyGraph,
  BackendCommand,
} from '../execution/index.js';
import { IdempotencyManager } from '../connectivity/IdempotencyManager.js';

describe('Backend Execution Boundary & Facade', () => {
  it('should reject direct component execution without worker context', async () => {
    const facade = new ExecutableBackendFacade('AppBackend');
    const cmd: BackendCommand = {
      id: 'c1',
      type: 'user.create',
      payload: { name: 'Bob' },
      correlationId: 'corr_1',
      createdAt: Date.now(),
    };

    // Direct invocation without worker context
    const result = await facade.executeCommand(cmd, {
      isWorkerContext: false,
      timestamp: Date.now(),
    });

    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('WORKER_ONLY');
  });

  it('should allow execution through WorkerExecutionBoundary and dispatch to OperationComponent', async () => {
    const facade = new ExecutableBackendFacade('AppBackend');
    const userService = new ServiceDispatcher('user');

    const createOp = createOperationComponent<{ name: string }, { id: string; name: string }>(
      'create',
      async (input) => ({ id: 'u_100', name: input.name })
    );

    userService.registerOperation('create', createOp);
    facade.registerService(userService);

    const worker = new WorkerExecutionBoundary('worker_pool_1', facade);

    const cmd: BackendCommand = {
      id: 'c2',
      type: 'user.create',
      payload: { name: 'Charlie' },
      correlationId: 'corr_2',
      createdAt: Date.now(),
    };

    const result = await worker.processJob<{ id: string; name: string }>(cmd);

    expect(result.status).toBe('COMPLETED');
    expect(result.data).toEqual({ id: 'u_100', name: 'Charlie' });
    expect(result.correlationId).toBe('corr_2');
  });

  it('should enforce idempotency by returning cached result on duplicate keys', async () => {
    const idempotency = new IdempotencyManager();
    const facade = new ExecutableBackendFacade('AppBackend', idempotency);
    const mathService = new ServiceDispatcher('math');

    let executionCount = 0;
    const addOp = createOperationComponent<{ n: number }, { sum: number }>('add', async (input) => {
      executionCount++;
      return { sum: input.n * 2 };
    });

    mathService.registerOperation('add', addOp);
    facade.registerService(mathService);

    const worker = new WorkerExecutionBoundary('worker_pool_1', facade);

    const cmd: BackendCommand = {
      id: 'c3',
      type: 'math.add',
      payload: { n: 10 },
      correlationId: 'corr_3',
      idempotencyKey: 'idem_math_unique_key',
      createdAt: Date.now(),
    };

    const firstRun = await worker.processJob<{ sum: number }>(cmd);
    expect(firstRun.status).toBe('COMPLETED');
    expect(firstRun.data?.sum).toBe(20);
    expect(executionCount).toBe(1);

    // Second run with same idempotency key
    const secondRun = await worker.processJob<{ sum: number }>(cmd);
    expect(secondRun.status).toBe('COMPLETED');
    expect(secondRun.data?.sum).toBe(20);
    expect(executionCount).toBe(1); // Operation was not re-executed!
  });

  it('should sequence jobs with dependency ordering', async () => {
    const graph = new JobDependencyGraph(1);
    const order: string[] = [];

    graph.registerHandler('stepA', async (job) => {
      order.push(job.type);
      return { done: true };
    });

    graph.registerHandler('stepB', async (job) => {
      order.push(job.type);
      return { done: true };
    });

    const jobA = graph.submitJob('stepA', {});
    graph.submitJob('stepB', {}, [jobA.id]);

    // Give asynchronous queue a tick
    await new Promise((r) => setTimeout(r, 50));

    expect(order[0]).toBe('stepA');
  });
});
