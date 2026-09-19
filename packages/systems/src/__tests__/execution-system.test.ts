/**
 * @file execution-system.test.ts
 * @description Comprehensive test suite for SKIPO_EXECUTION system.
 * Verifies command creation, BullMQ queueing, and result propagation to SKIPO_STATE.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SKIPO_EXECUTION } from '../execution/SkipoExecution.js';
import { SKIPO_STATE } from '../state/SkipoState.js';

describe('SKIPO_EXECUTION System', () => {
  beforeEach(() => {
    SKIPO_STATE.clear();
  });

  afterEach(async () => {
    await SKIPO_EXECUTION.close();
  });

  it('should generate valid commands with correlationId and timestamp', () => {
    const cmd = SKIPO_EXECUTION.createCommand('workspace.create', { name: 'Alpha' });

    expect(cmd.id).toBeDefined();
    expect(cmd.type).toBe('workspace.create');
    expect(cmd.payload).toEqual({ name: 'Alpha' });
    expect(cmd.correlationId).toBeDefined();
    expect(cmd.createdAt).toBeGreaterThan(0);
  });

  it('should dispatch command through BullMQ and register initial state in SKIPO_STATE', async () => {
    const job = await SKIPO_EXECUTION.dispatch('files.upload', { fileName: 'report.pdf' });

    expect(job.id).toBeDefined();
    expect(job.status).toBe('QUEUED');
    expect(job.correlationId).toBeDefined();

    // Verify state was registered in SKIPO_STATE (Zustand)
    const stateId = `execution_${job.correlationId}`;
    const initialRecord = SKIPO_STATE.get<any>(stateId);
    expect(initialRecord).toBeDefined();
    expect(initialRecord.status).toBe('QUEUED');
    expect(initialRecord.correlationId).toBe(job.correlationId);
  });

  it('should propagate execution results back into SKIPO_STATE (Zustand)', async () => {
    const job = await SKIPO_EXECUTION.dispatch('analytics.calculate', { range: '7d' });

    // Simulate worker completing the execution
    SKIPO_EXECUTION.propagateResult(job.correlationId, {
      correlationId: job.correlationId,
      status: 'COMPLETED',
      data: { score: 98.5 },
    });

    const stateId = `execution_${job.correlationId}`;
    const completedRecord = SKIPO_STATE.get<any>(stateId);
    expect(completedRecord).toBeDefined();
    expect(completedRecord.status).toBe('COMPLETED');
    expect(completedRecord.data).toEqual({ score: 98.5 });
  });

  it('should propagate execution errors correctly into SKIPO_STATE', async () => {
    const job = await SKIPO_EXECUTION.dispatch('network.ping', { host: 'invalid' });

    SKIPO_EXECUTION.propagateResult(job.correlationId, {
      correlationId: job.correlationId,
      status: 'FAILED',
      error: 'Host unreachable',
    });

    const stateId = `execution_${job.correlationId}`;
    const failedRecord = SKIPO_STATE.get<any>(stateId);
    expect(failedRecord.status).toBe('FAILED');
    expect(failedRecord.error).toBe('Host unreachable');
  });
});
