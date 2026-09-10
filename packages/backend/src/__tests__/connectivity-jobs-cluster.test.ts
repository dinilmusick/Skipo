import { describe, it, expect, vi } from 'vitest';
import { JobScheduler } from '../connectivity/JobScheduler.js';
import { HealthMonitor } from '../connectivity/HealthMonitor.js';
import { LoadBalancer } from '../connectivity/LoadBalancer.js';

describe('JobScheduler', () => {
  it('executes independent jobs concurrently and tracks progress', async () => {
    const scheduler = new JobScheduler(3);
    scheduler.registerHandler('transform', async (job, updateProgress) => {
      updateProgress(50);
      await new Promise((r) => setTimeout(r, 15));
      updateProgress(100);
      return { transformed: (job.payload as any).text.toUpperCase() };
    });

    const j1 = scheduler.submit({ type: 'transform', payload: { text: 'hello' } });
    const j2 = scheduler.submit({ type: 'transform', payload: { text: 'world' } });

    await new Promise((r) => setTimeout(r, 40));

    const s1 = scheduler.status(j1.id);
    const s2 = scheduler.status(j2.id);
    expect(s1?.state).toBe('COMPLETED');
    expect(s1?.result).toEqual({ transformed: 'HELLO' });
    expect(s2?.state).toBe('COMPLETED');
    expect(s2?.result).toEqual({ transformed: 'WORLD' });
  });

  it('enforces DAG dependency ordering: dependent job waits for prerequisite', async () => {
    const scheduler = new JobScheduler(5);
    const executionTrace: string[] = [];

    scheduler.registerHandler('stepA', async () => {
      await new Promise((r) => setTimeout(r, 20));
      executionTrace.push('stepA');
      return 'doneA';
    });

    scheduler.registerHandler('stepB', async () => {
      executionTrace.push('stepB');
      return 'doneB';
    });

    const jobA = scheduler.submit({ type: 'stepA', payload: {} });
    const jobB = scheduler.submit({ type: 'stepB', payload: {}, dependencies: [jobA.id] });

    expect(jobB.state).toBe('PENDING');

    await new Promise((r) => setTimeout(r, 50));

    expect(scheduler.status(jobA.id)?.state).toBe('COMPLETED');
    expect(scheduler.status(jobB.id)?.state).toBe('COMPLETED');
    expect(executionTrace).toEqual(['stepA', 'stepB']);
  });
});

describe('HealthMonitor & LoadBalancer', () => {
  it('tracks instance health, metrics, and selects based on routing strategy', () => {
    const monitor = new HealthMonitor();
    const lb = new LoadBalancer(monitor);

    monitor.registerInstance({
      id: 'be-1',
      url: 'http://be1:3000',
      healthy: true,
      capacity: 10,
      activeJobs: 1,
      activeConnections: 5,
      latencyMs: 120,
    });

    monitor.registerInstance({
      id: 'be-2',
      url: 'http://be2:3000',
      healthy: true,
      capacity: 10,
      activeJobs: 0,
      activeConnections: 1,
      latencyMs: 35,
    });

    // Least connections should select be-2
    const leastConn = lb.selectInstance('leastConnections');
    expect(leastConn.id).toBe('be-2');

    // Latency aware should select be-2 (35ms vs 120ms)
    const lowLatency = lb.selectInstance('latencyAware');
    expect(lowLatency.id).toBe('be-2');
  });

  it('automatically fails over to healthy instance on error', async () => {
    const monitor = new HealthMonitor();
    const lb = new LoadBalancer(monitor);

    monitor.registerInstance({
      id: 'be-flaky',
      url: 'http://flaky:3000',
      healthy: true,
      capacity: 10,
      activeJobs: 0,
      activeConnections: 0,
      latencyMs: 10,
    });

    monitor.registerInstance({
      id: 'be-stable',
      url: 'http://stable:3000',
      healthy: true,
      capacity: 10,
      activeJobs: 0,
      activeConnections: 0,
      latencyMs: 20,
    });

    const result = await lb.executeWithFailover(async (inst) => {
      if (inst.id === 'be-flaky') {
        throw new Error('Connection refused on flaky');
      }
      return `Success from ${inst.id}`;
    });

    expect(result).toBe('Success from be-stable');
    expect(monitor.getInstance('be-flaky')?.healthy).toBe(false);
  });
});
