'use client';

import { useEffect, useRef, useState } from 'react';

export interface RealtimeWorkspaceEvent {
  id: string;
  timestamp: number;
  userId?: string;
  workspaceId?: string;
  source: 'api' | 'ui';
  method?: string;
  endpoint?: string;
  action: string;
  details?: string;
  payload?: any;
}

export interface UseRealtimeApiSyncOptions {
  enabled?: boolean;
  workspaceId?: string;
  onDocumentEvent?: (event: RealtimeWorkspaceEvent) => void;
  onCategoryEvent?: (event: RealtimeWorkspaceEvent) => void;
  onGraphEvent?: (event: RealtimeWorkspaceEvent) => void;
  onBiomeEvent?: (event: RealtimeWorkspaceEvent) => void;
  onWorkspaceEvent?: (event: RealtimeWorkspaceEvent) => void;
  onGenericEvent?: (event: RealtimeWorkspaceEvent) => void;
  onApiAction?: (message: string) => void;
  onTelemetry?: (entry: {
    id: string;
    endpoint: string;
    method: string;
    status: string;
    timestamp: number;
    details?: string;
  }) => void;
}

/**
 * useRealtimeApiSync
 * Canonical Skipo React Hook for Real-Time UI Mirroring.
 * Subscribes to /api/events via Server-Sent Events (SSE) with fast-polling fallback.
 * Emits visual notifications, telemetry events, and state update callbacks so that
 * any headless programmatic API action appears immediately on screen without page refresh.
 */
export function useRealtimeApiSync({
  enabled = true,
  workspaceId,
  onDocumentEvent,
  onCategoryEvent,
  onGraphEvent,
  onBiomeEvent,
  onWorkspaceEvent,
  onGenericEvent,
  onApiAction,
  onTelemetry,
}: UseRealtimeApiSyncOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const seenEventIds = useRef<Set<string>>(new Set());
  const lastEventTimestamp = useRef<number>(Date.now());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    let eventSource: EventSource | null = null;
    let isSubscribed = true;

    const handleIncomingEvent = (event: RealtimeWorkspaceEvent) => {
      if (!event || !event.id) return;
      if (seenEventIds.current.has(event.id)) return;

      seenEventIds.current.add(event.id);
      if (seenEventIds.current.size > 500) {
        // Prevent memory leaks
        const first100 = Array.from(seenEventIds.current).slice(0, 100);
        first100.forEach((id) => seenEventIds.current.delete(id));
      }

      lastEventTimestamp.current = Math.max(lastEventTimestamp.current, event.timestamp);

      // 1. Emit telemetry to ActivityMonitor HUD if provided
      if (onTelemetry) {
        onTelemetry({
          id: event.id,
          endpoint: event.endpoint || '/api',
          method: event.method || 'POST',
          status: 'success',
          timestamp: event.timestamp,
          details: event.details || event.action,
        });
      }

      // 2. Trigger on-screen banner / toast
      if (onApiAction && event.details) {
        onApiAction(`[API] ${event.method || 'POST'} ${event.endpoint || ''} ── ${event.details}`);
      }

      // 3. Dispatch specific state update handlers
      if (event.action.startsWith('DOCUMENT_') && onDocumentEvent) {
        onDocumentEvent(event);
      } else if (event.action.startsWith('CATEGORY_') && onCategoryEvent) {
        onCategoryEvent(event);
      } else if (event.action === 'GRAPH_UPDATED' && onGraphEvent) {
        onGraphEvent(event);
      } else if (event.action === 'BIOME_CHANGED' && onBiomeEvent) {
        onBiomeEvent(event);
      } else if (event.action.startsWith('WORKSPACE_') && onWorkspaceEvent) {
        onWorkspaceEvent(event);
      } else if (onGenericEvent) {
        onGenericEvent(event);
      }
    };

    // Fast polling fallback runner
    const runPollingFallback = async () => {
      try {
        const token = localStorage.getItem('docustackAuthToken') || localStorage.getItem('authToken');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (workspaceId) headers['x-workspace-id'] = workspaceId;

        const url = `/api/events?since=${lastEventTimestamp.current}${workspaceId ? `&workspaceId=${encodeURIComponent(workspaceId)}` : ''}`;
        const res = await fetch(url, { headers });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.events)) {
          data.events.forEach(handleIncomingEvent);
        }
      } catch {
        // Ignore network polling failure
      }
    };

    // Attempt Server-Sent Events (SSE) connection
    try {
      const sseUrl = `/api/events?stream=true${workspaceId ? `&workspaceId=${encodeURIComponent(workspaceId)}` : ''}`;
      eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        if (isSubscribed) setIsConnected(true);
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
        if (isSubscribed) {
          setIsConnected(false);
          // Fallback to fast polling if SSE connection drops or is blocked
          if (!pollIntervalRef.current) {
            pollIntervalRef.current = setInterval(runPollingFallback, 3000);
          }
        }
      };
    } catch {
      // If EventSource is completely unavailable
      pollIntervalRef.current = setInterval(runPollingFallback, 3000);
    }

    return () => {
      isSubscribed = false;
      if (eventSource) {
        eventSource.close();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [
    enabled,
    workspaceId,
    onDocumentEvent,
    onCategoryEvent,
    onGraphEvent,
    onBiomeEvent,
    onWorkspaceEvent,
    onGenericEvent,
    onApiAction,
    onTelemetry,
  ]);

  return { isConnected };
}
