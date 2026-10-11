// ══════════════════════════════════════════════════════════════════════════════
// SKIPO BULLMQ COMMAND QUEUE INTERACTIVE DASHBOARD
// Architecture: Interactive job dispatcher, poller, and Zod error validator
// ══════════════════════════════════════════════════════════════════════════════

'use client';

import React, { useState } from 'react';
import { Play, RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { apiClient } from '../../../libraries/client/apiClient';
import { BaseButton, BaseInput, BaseCard, BaseBadge } from '../ui';

interface JobItem {
  id: string;
  type: string;
  status: string;
  time: string;
}

export const QueueView: React.FC = () => {
  const [commandType, setCommandType] = useState('ECHO');
  const [paramValue, setParamValue] = useState('Hello Skipo Queue');
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const handleDispatch = async () => {
    setLoading(true);
    setLastError(null);
    try {
      const res = await apiClient.dispatchCommand(commandType, { message: paramValue });
      if (res.success && res.jobId) {
        const newJob: JobItem = {
          id: res.jobId,
          type: commandType,
          status: res.status || 'QUEUED',
          time: new Date().toLocaleTimeString(),
        };
        setJobs((prev) => [newJob, ...prev.slice(0, 9)]);
      } else {
        setLastError(res.error || 'Failed to dispatch command');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setLastError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStatus = async (jobId: string) => {
    try {
      const res = await apiClient.getCommandStatus(jobId);
      if (res.success) {
        setJobs((prev) =>
          prev.map((j) => (j.id === jobId ? { ...j, status: res.status } : j))
        );
      }
    } catch (err) {
      console.error('Failed to check status:', err);
    }
  };

  return (
    <div className="flex flex-col gap-4 font-mono select-none">
      <BaseCard className="p-4 border border-[var(--skipo-border-color)] bg-[var(--skipo-surface)]">
        <h3 className="text-sm font-bold text-[var(--skipo-text)] mb-2 uppercase">
          BullMQ Async Command Dispatcher
        </h3>
        <p className="text-xs text-[var(--skipo-text-muted)] mb-4">
          Test asynchronous background execution with automatic Redis / In-Memory fallback and Zod shape validation.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-36">
            <BaseInput
              value={commandType}
              onChange={(e) => setCommandType(e.target.value)}
              placeholder="Command"
              data-skipo-label="Command Type"
              data-skipo-desc="Name of the registered command handler to invoke"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <BaseInput
              value={paramValue}
              onChange={(e) => setParamValue(e.target.value)}
              placeholder="Payload message"
              data-skipo-label="Payload Text"
              data-skipo-desc="Arguments passed to background worker"
            />
          </div>
          <BaseButton
            variant="primary"
            onClick={handleDispatch}
            disabled={loading}
            data-skipo-label="Dispatch Job"
            data-skipo-desc="Send command to BullMQ background queue"
            className="flex items-center gap-1.5"
          >
            <Play size={13} />
            <span>{loading ? 'Dispatching...' : 'Dispatch'}</span>
          </BaseButton>
        </div>

        {lastError && (
          <div className="mt-3 p-2 bg-red-950/40 border border-red-500/50 rounded text-xs text-red-300 flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0 text-red-400" />
            <span className="truncate">{lastError}</span>
          </div>
        )}
      </BaseCard>

      {/* Recent Dispatched Jobs List */}
      <BaseCard className="p-4 border border-[var(--skipo-border-color)] bg-[var(--skipo-surface)]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-[var(--skipo-text-muted)] uppercase">
            Recent Enqueued Jobs ({jobs.length})
          </span>
          <BaseBadge variant="default" size="sm">FIFO QUEUE</BaseBadge>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-6 text-xs text-[var(--skipo-text-muted)]">
            No background jobs dispatched yet. Click Dispatch above to test.
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="p-2.5 rounded border border-[var(--skipo-border-color)] bg-[var(--skipo-bg)] flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <Clock size={13} className="text-slate-500" />
                  <span className="font-bold text-sky-400">{job.type}</span>
                  <span className="text-slate-500 text-[10px]">{job.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">{job.time}</span>
                  <BaseBadge
                    variant={job.status === 'COMPLETED' ? 'success' : 'default'}
                    size="sm"
                  >
                    {job.status}
                  </BaseBadge>
                  <BaseButton
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRefreshStatus(job.id)}
                    data-skipo-label="Refresh Status"
                    data-skipo-desc="Poll latest job execution status from BullMQ"
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <RefreshCw size={12} />
                  </BaseButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </BaseCard>
    </div>
  );
};
