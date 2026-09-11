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

const BACKOFF_DELAYS_MS = [5000, 15000, 30000, 60000, 120000];
const MAX_RETRIES = 5;

export function useRealtimeApiSync(options: UseRealtimeApiSyncOptions) {
  const { enabled = true, workspaceId } = options;
  const [isConnected, setIsConnected] = useState(false);
  const seenEventIds = useRef<Set<string>>(new Set());
  const lastEventTimestamp = useRef<number>(Date.now());
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const circuitBrokenRef = useRef<boolean>(false);
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setIsConnected(false);
      return;
    }

    let eventSource: EventSource | null = null;
    let isSubscribed = true;
    circuitBrokenRef.current = false;
    retryCountRef.current = 0;

    const handleIncomingEvent = (event: RealtimeWorkspaceEvent) => {
      if (!event?.id || seenEventIds.current.has(event.id)) return;
      seenEventIds.current.add(event.id);
      if (seenEventIds.current.size > 500) {
        Array.from(seenEventIds.current).slice(0, 100).forEach((id) => seenEventIds.current.delete(id));
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
      if (cb.onApiAction && event.details) {
        cb.onApiAction(`[API] ${event.method || 'POST'} ${event.endpoint || ''} ── ${event.details}`);
      }
      if (event.action.startsWith('DOCUMENT_')) cb.onDocumentEvent?.(event);
      else if (event.action.startsWith('CATEGORY_')) cb.onCategoryEvent?.(event);
      else if (event.action === 'GRAPH_UPDATED') cb.onGraphEvent?.(event);
      else if (event.action === 'BIOME_CHANGED') cb.onBiomeEvent?.(event);
      else if (event.action.startsWith('WORKSPACE_')) cb.onWorkspaceEvent?.(event);
    };

    const cleanupCurrentSource = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (!isSubscribed || circuitBrokenRef.current || document.hidden || retryCountRef.current >= MAX_RETRIES) return;
      const baseDelay = BACKOFF_DELAYS_MS[Math.min(retryCountRef.current, BACKOFF_DELAYS_MS.length - 1)];
      const jitter = baseDelay * (0.85 + Math.random() * 0.3);
      retryCountRef.current++;

      retryTimerRef.current = setTimeout(async () => {
        if (!isSubscribed || circuitBrokenRef.current) return;
        const token = localStorage.getItem('docustackAuthToken');
        if (!token) {
          circuitBrokenRef.current = true;
          return;
        }

        try {
          const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
          if (workspaceId) headers['x-workspace-id'] = workspaceId;
          const probe = await fetch(`/api/events?since=${lastEventTimestamp.current}&probe=true`, { headers });
          if (probe.status === 401 || probe.status === 403) {
            circuitBrokenRef.current = true;
            setIsConnected(false);
            return;
          }
          if (probe.ok) {
            const data = await probe.json();
            if (data.success && Array.isArray(data.events)) data.events.forEach(handleIncomingEvent);
          }
        } catch {}
        connect();
      }, jitter);
    };

    const connect = () => {
      cleanupCurrentSource();
      if (!isSubscribed || circuitBrokenRef.current) return;
      const token = localStorage.getItem('docustackAuthToken');
      if (!token) {
        circuitBrokenRef.current = true;
        return;
      }

      const tokenParam = `&token=${encodeURIComponent(token)}`;
      const wsParam = workspaceId ? `&workspaceId=${encodeURIComponent(workspaceId)}` : '';
      try {
        eventSource = new EventSource(`/api/events?stream=true${tokenParam}${wsParam}`);
        eventSource.onopen = () => {
          if (isSubscribed) {
            setIsConnected(true);
            retryCountRef.current = 0;
          }
        };
        eventSource.onmessage = (e) => {
          try {
            handleIncomingEvent(JSON.parse(e.data));
          } catch {}
        };
        eventSource.onerror = () => {
          if (!isSubscribed) return;
          setIsConnected(false);
          cleanupCurrentSource();
          scheduleReconnect();
        };
      } catch {
        scheduleReconnect();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !circuitBrokenRef.current && isSubscribed) {
        retryCountRef.current = 0;
        connect();
      }
    };
    const onOnline = () => {
      if (!circuitBrokenRef.current && isSubscribed) {
        retryCountRef.current = 0;
        connect();
      }
    };
    const onOffline = () => {
      setIsConnected(false);
      cleanupCurrentSource();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    connect();

    return () => {
      isSubscribed = false;
      cleanupCurrentSource();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [enabled, workspaceId]);

  return { isConnected };
}
