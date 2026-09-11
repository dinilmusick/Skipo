'use client';

import { useEffect, useRef, useState } from 'react';
import { RealtimeWorkspaceEvent } from '@/lib/realtime-events';
import { emitTelemetry } from '@/lib/api-client';

interface UseRealtimeApiSyncOptions {
  enabled?: boolean;
  workspaceId?: string;
  onDocumentEvent?: (event: RealtimeWorkspaceEvent) => void;
  onCategoryEvent?: (event: RealtimeWorkspaceEvent) => void;
  onGraphEvent?: (event: RealtimeWorkspaceEvent) => void;
  onBiomeEvent?: (event: RealtimeWorkspaceEvent) => void;
  onWorkspaceEvent?: (event: RealtimeWorkspaceEvent) => void;
  onApiAction?: (message: string) => void;
}

export function useRealtimeApiSync({
  enabled = true,
  workspaceId,
  onDocumentEvent,
  onCategoryEvent,
  onGraphEvent,
  onBiomeEvent,
  onWorkspaceEvent,
  onApiAction,
}: UseRealtimeApiSyncOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const seenEventIds = useRef<Set<string>>(new Set());
  const lastEventTimestamp = useRef<number>(Date.now());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const circuitBrokenRef = useRef<boolean>(false);

  // Stabilize callbacks in a mutable ref to prevent unneeded effect re-runs
  const callbacksRef = useRef({ onDocumentEvent, onCategoryEvent, onGraphEvent, onBiomeEvent, onWorkspaceEvent, onApiAction });
  callbacksRef.current = { onDocumentEvent, onCategoryEvent, onGraphEvent, onBiomeEvent, onWorkspaceEvent, onApiAction };

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setIsConnected(false);
      return;
    }

    circuitBrokenRef.current = false;
    let eventSource: EventSource | null = null;
    let isSubscribed = true;
    let backoffIndex = 0;
    const backoffDelays = [3000, 6000, 12000, 30000, 60000];

    const handleIncomingEvent = (event: RealtimeWorkspaceEvent) => {
      if (!event || !event.id || seenEventIds.current.has(event.id)) return;

      seenEventIds.current.add(event.id);
      if (seenEventIds.current.size > 500) {
        const first100 = Array.from(seenEventIds.current).slice(0, 100);
        first100.forEach((id) => seenEventIds.current.delete(id));
      }

      lastEventTimestamp.current = Math.max(lastEventTimestamp.current, event.timestamp);

      emitTelemetry({
        id: event.id,
        endpoint: event.endpoint || '/api',
        method: event.method || 'POST',
        status: 'success',
        timestamp: event.timestamp,
        details: event.details || event.action,
      });

      const cb = callbacksRef.current;
      if (cb.onApiAction && event.details) cb.onApiAction(`[API] ${event.method || 'POST'} ${event.endpoint || ''} ── ${event.details}`);
      if (event.action.startsWith('DOCUMENT_') && cb.onDocumentEvent) cb.onDocumentEvent(event);
      else if (event.action.startsWith('CATEGORY_') && cb.onCategoryEvent) cb.onCategoryEvent(event);
      else if (event.action === 'GRAPH_UPDATED' && cb.onGraphEvent) cb.onGraphEvent(event);
      else if (event.action === 'BIOME_CHANGED' && cb.onBiomeEvent) cb.onBiomeEvent(event);
      else if (event.action.startsWith('WORKSPACE_') && cb.onWorkspaceEvent) cb.onWorkspaceEvent(event);
    };

    // Polling fallback runner with strict circuit breaker
    const runPollingFallback = async (): Promise<boolean> => {
      if (!isSubscribed || circuitBrokenRef.current) return false;
      try {
        const token = localStorage.getItem('docustackAuthToken');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (workspaceId) headers['x-workspace-id'] = workspaceId;

        const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
        const wsParam = workspaceId ? `&workspaceId=${encodeURIComponent(workspaceId)}` : '';
        const url = `/api/events?since=${lastEventTimestamp.current}${tokenParam}${wsParam}`;

        const res = await fetch(url, { headers });
        if (res.status === 401 || res.status === 403) {
          // Trip circuit breaker immediately to stop invocation floods
          circuitBrokenRef.current = true;
          setIsConnected(false);
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (pollIntervalRef.current) {
            clearTimeout(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          return false;
        }

        if (!res.ok) return true;
        const data = await res.json();
        if (data.success && Array.isArray(data.events)) {
          data.events.forEach(handleIncomingEvent);
        }
        return true;
      } catch {
        return true;
      }
    };

    const scheduleNextPoll = () => {
      if (!isSubscribed || circuitBrokenRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) {
        pollIntervalRef.current = setTimeout(scheduleNextPoll, 15000);
        return;
      }

      const delay = backoffDelays[Math.min(backoffIndex, backoffDelays.length - 1)];
      pollIntervalRef.current = setTimeout(async () => {
        if (!isSubscribed || circuitBrokenRef.current) return;
        const shouldContinue = await runPollingFallback();
        if (shouldContinue && isSubscribed && !circuitBrokenRef.current) {
          backoffIndex++;
          scheduleNextPoll();
        }
      }, delay);
    };

    // Server-Sent Events (SSE) connection
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('docustackAuthToken') : null;
      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
      const wsParam = workspaceId ? `&workspaceId=${encodeURIComponent(workspaceId)}` : '';
      const sseUrl = `/api/events?stream=true${tokenParam}${wsParam}`;

      eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        if (isSubscribed) {
          setIsConnected(true);
          backoffIndex = 0;
        }
      };

      eventSource.onmessage = (e) => {
        try {
          const event: RealtimeWorkspaceEvent = JSON.parse(e.data);
          handleIncomingEvent(event);
        } catch {
          // Ignore parse errors
        }
      };

      eventSource.onerror = () => {
        if (!isSubscribed) return;
        setIsConnected(false);
        // CRITICAL: Immediately close EventSource to stop the browser's native rapid reconnect loop
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (circuitBrokenRef.current) return;

        if (!pollIntervalRef.current) {
          scheduleNextPoll();
        }
      };
    } catch {
      scheduleNextPoll();
    }

    return () => {
      isSubscribed = false;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [enabled, workspaceId]);

  return { isConnected };
}
