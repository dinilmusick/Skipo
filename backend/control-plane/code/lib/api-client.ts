import { ApiTelemetryEvent } from './types';

type TelemetryListener = (event: ApiTelemetryEvent) => void;
const listeners: Set<TelemetryListener> = new Set();

export function subscribeTelemetry(listener: TelemetryListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitTelemetry(event: ApiTelemetryEvent) {
  listeners.forEach((fn) => fn(event));
}

export async function requestApi<T>(
  endpoint: string,
  options?: RequestInit,
  details?: string
): Promise<T> {
  const method = options?.method || 'GET';
  const eventId = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // Automatically inject session token, active workspace ID, and json Content-Type
  const headers = new Headers(options?.headers || {});
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('docustackAuthToken');
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const activeWsId = localStorage.getItem('docustack_active_workspace_id');
    if (activeWsId && !headers.has('x-workspace-id')) {
      headers.set('x-workspace-id', activeWsId);
    }
    const wsPath = localStorage.getItem('docustack_workspace_path');
    if (wsPath && !headers.has('x-workspace-path')) {
      headers.set('x-workspace-path', wsPath);
    }
  }

  if (options?.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const mergedOptions: RequestInit = {
    ...options,
    headers,
  };

  emitTelemetry({
    id: eventId,
    endpoint,
    method,
    status: 'pending',
    timestamp: Date.now(),
    details,
  });

  try {
    const res = await fetch(endpoint, mergedOptions);
    if (!res.ok) {
      let serverMsg = '';
      try {
        const errJson = await res.json();
        serverMsg = errJson.error || errJson.message || '';
      } catch {}
      throw new Error(serverMsg ? `HTTP ${res.status}: ${serverMsg}` : `HTTP ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    emitTelemetry({
      id: eventId,
      endpoint,
      method,
      status: 'success',
      timestamp: Date.now(),
      details: details ? `${details} OK` : 'OK',
    });
    return data;
  } catch (err: any) {
    emitTelemetry({
      id: eventId,
      endpoint,
      method,
      status: 'error',
      timestamp: Date.now(),
      details: err?.message || 'Failed',
    });
    throw err;
  }
}
