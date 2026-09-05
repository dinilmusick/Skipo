/**
 * PRODUCTION DEBUG API INFRASTRUCTURE - DEBUG MANAGER SINGLETON
 * Central headless engine governing debug sessions, circular event buffers,
 * 4-tier state readers (Persisted, Backend, Frontend, Rendered),
 * cross-tier consistency checking, state diffing, and SSE event dispatch.
 */

import fs from 'fs';
import path from 'path';
import {
  DebugMode,
  DebugSession,
  DebugConfiguration,
  DebugManifest,
  DebugEndpointDescriptor,
  FrontendSnapshot,
  BackendSnapshot,
  PersistedSnapshot,
  RenderedSnapshot,
  CompleteWorkspaceSnapshot,
  ConsistencyCheckResult,
  LayerComparison,
  Discrepancy,
  StateDiff,
  StateDiffItem,
  MutationEvent,
  ApiDebugEvent,
  PersistenceDebugEvent,
  ErrorDebugEvent,
  PerformanceSample,
  DebugEvent,
  WorkspaceRevisions,
  DiagnosticBundle,
} from './debug-types';
import {
  loadGraphFromFSAsync,
  loadCategoriesFromFSAsync,
  loadDocumentsFromFSAsync,
  getVaultAbsolutePath,
  getActiveVaultName,
  getActiveStorageConn,
  getActiveFolderPrefix,
} from './workspaceFS';

const DEFAULT_CONFIG: DebugConfiguration = {
  maxEvents: 1000,
  ttlMinutes: 30,
  capturePayloads: false,
  maskDocumentText: true,
  persistEventsToDisk: true,
  enabledLayers: ['frontend', 'backend', 'persisted', 'rendered'],
  retentionHours: 24,
};

const AVAILABLE_ENDPOINTS: DebugEndpointDescriptor[] = [
  { method: 'GET', path: '/api/debug/status', description: 'Returns debug engine capability manifest and active session', modeRequired: 'OFF' },
  { method: 'POST', path: '/api/debug/enable', description: 'Enables debug session with specified mode (OBSERVE | TRACE) and TTL', modeRequired: 'OFF' },
  { method: 'POST', path: '/api/debug/disable', description: 'Terminates active debug session, setting mode to OFF', modeRequired: 'OFF' },
  { method: 'GET', path: '/api/debug/config', description: 'Retrieves current debug configuration parameters', modeRequired: 'OFF' },
  { method: 'PUT', path: '/api/debug/config', description: 'Updates debug configuration parameters', modeRequired: 'OFF' },
  { method: 'GET', path: '/api/debug/sessions', description: 'Lists active and historical debug sessions', modeRequired: 'OFF' },
  { method: 'GET', path: '/api/debug/sessions/:sessionId', description: 'Retrieves details for a specific debug session', modeRequired: 'OFF' },
  { method: 'DELETE', path: '/api/debug/sessions/:sessionId', description: 'Terminates a specific debug session', modeRequired: 'OFF' },
  { method: 'GET', path: '/api/debug/workspace/:id/frontend', description: 'Inspects in-memory React client state snapshot', modeRequired: 'OBSERVE' },
  { method: 'GET', path: '/api/debug/workspace/:id/backend', description: 'Inspects authoritative backend memory state snapshot', modeRequired: 'OBSERVE' },
  { method: 'GET', path: '/api/debug/workspace/:id/persisted', description: 'Reads persisted workspace state directly from physical disk', modeRequired: 'OBSERVE' },
  { method: 'GET', path: '/api/debug/workspace/:id/rendered', description: 'Inspects client DOM/canvas rendered elements snapshot', modeRequired: 'OBSERVE' },
  { method: 'GET', path: '/api/debug/workspace/:id/snapshot', description: 'Returns unified 4-tier snapshot + revisions + consistency', modeRequired: 'OBSERVE' },
  { method: 'POST', path: '/api/debug/workspace/:id/check', description: 'Validates 4-tier consistency and reports detected discrepancies', modeRequired: 'OBSERVE' },
  { method: 'GET', path: '/api/debug/workspace/:id/diff', description: 'Computes field-level diff between any two state layers', modeRequired: 'OBSERVE' },
  { method: 'GET', path: '/api/debug/workspace/:id/revisions', description: 'Inspects revision integers and detects revision drift/collisions', modeRequired: 'OBSERVE' },
  { method: 'GET', path: '/api/debug/mutations', description: 'Queries recorded workspace mutation events', modeRequired: 'OBSERVE' },
  { method: 'GET', path: '/api/debug/requests', description: 'Queries recorded API activity logs', modeRequired: 'OBSERVE' },
  { method: 'GET', path: '/api/debug/persistence', description: 'Queries recorded physical storage operations', modeRequired: 'OBSERVE' },
  { method: 'GET', path: '/api/debug/errors', description: 'Queries aggregated runtime errors across all layers', modeRequired: 'OBSERVE' },
  { method: 'GET', path: '/api/debug/performance', description: 'Queries performance benchmarks and latency metrics', modeRequired: 'OBSERVE' },
  { method: 'GET', path: '/api/debug/events', description: 'Queries raw debug events from circular ring buffer', modeRequired: 'OBSERVE' },
  { method: 'GET', path: '/api/debug/trace', description: 'Live Server-Sent Events (SSE) trace correlation stream', modeRequired: 'TRACE' },
  { method: 'POST', path: '/api/debug/export', description: 'Exports comprehensive diagnostic bundle for AI agent consumption', modeRequired: 'OBSERVE' },
  { method: 'GET', path: '/api/debug/ui-state', description: 'Legacy compatibility: returns active frontend UI state', modeRequired: 'OFF' },
  { method: 'POST', path: '/api/debug/ui-state', description: 'Ingests client-collected UI state and rendered elements', modeRequired: 'OFF' },
  { method: 'GET', path: '/api/debug/sync-audit', description: 'Legacy compatibility: audits cross-tier synchronization', modeRequired: 'OFF' },
];

const SUPPORTED_OPERATIONS = [
  'ENABLE_DEBUG',
  'DISABLE_DEBUG',
  'GET_HEALTH',
  'GET_FRONTEND_STATE',
  'GET_BACKEND_STATE',
  'GET_PERSISTED_STATE',
  'GET_RENDERED_STATE',
  'GET_COMPLETE_SNAPSHOT',
  'CHECK_CONSISTENCY',
  'GENERATE_STATE_DIFF',
  'GET_MUTATIONS',
  'GET_API_REQUESTS',
  'GET_PERSISTENCE_LOGS',
  'GET_REVISIONS',
  'GET_ERRORS',
  'GET_PERFORMANCE',
  'STREAM_TRACE_SSE',
  'EXPORT_DIAGNOSTICS',
];

export class DebugManager {
  private activeSession: DebugSession | null = null;
  private sessionHistory: DebugSession[] = [];
  private config: DebugConfiguration = { ...DEFAULT_CONFIG };
  private startTime: number = Date.now();

  // Bounded ring buffers
  private events: DebugEvent[] = [];
  private mutations: MutationEvent[] = [];
  private requests: ApiDebugEvent[] = [];
  private persistenceEvents: PersistenceDebugEvent[] = [];
  private errors: ErrorDebugEvent[] = [];
  private performanceSamples: PerformanceSample[] = [];

  // Workspace revisions store
  private workspaceRevisions: Map<string, { frontend: number; backend: number; persisted: number }> = new Map();

  // SSE Stream subscribers
  private traceListeners: Set<(event: DebugEvent) => void> = new Set();

  constructor() {
    this.loadConfigFromDisk();
  }

  // --------------------------------------------------------------------------
  // SESSION LIFECYCLE & SECURITY
  // --------------------------------------------------------------------------

  public checkSessionExpiry(): void {
    if (this.activeSession && Date.now() > this.activeSession.expiresAt) {
      this.recordEvent('SESSION_EXPIRED', {
        sessionId: this.activeSession.id,
        expiredAt: Date.now(),
      });
      this.activeSession.enabled = false;
      this.activeSession.mode = 'OFF';
      this.sessionHistory.unshift({ ...this.activeSession });
      this.activeSession = null;
    }
  }

  public getMode(): DebugMode {
    this.checkSessionExpiry();
    return this.activeSession && this.activeSession.enabled ? this.activeSession.mode : 'OFF';
  }

  public isEnabled(): boolean {
    return this.getMode() !== 'OFF';
  }

  public isTraceMode(): boolean {
    return this.getMode() === 'TRACE';
  }

  public getActiveSession(): DebugSession | null {
    this.checkSessionExpiry();
    return this.activeSession;
  }

  public enableSession(options: {
    mode: 'OBSERVE' | 'TRACE';
    ttlMinutes?: number;
    workspaceId?: string;
    userId?: string;
    actor?: string;
    capturePayloads?: boolean;
    maskDocumentText?: boolean;
  }): DebugSession {
    try {
      const ttl = options.ttlMinutes && options.ttlMinutes > 0 ? options.ttlMinutes : this.config.ttlMinutes;
      const now = Date.now();
      const expiresAt = now + ttl * 60 * 1000;

      // Retire existing session if active
      if (this.activeSession) {
        this.activeSession.enabled = false;
        this.sessionHistory.unshift({ ...this.activeSession });
      }

      const session: DebugSession = {
        id: `debug-sess-${now}-${Math.random().toString(36).substring(2, 7)}`,
        mode: options.mode,
        enabled: true,
        enabledAt: now,
        expiresAt,
        ttlMinutes: ttl,
        workspaceId: options.workspaceId,
        userId: options.userId,
        actor: options.actor || 'ai-agent',
        capturePayloads: options.capturePayloads ?? this.config.capturePayloads,
        maskDocumentText: options.maskDocumentText ?? this.config.maskDocumentText,
      };

      this.activeSession = session;
      this.recordEvent('SESSION_ENABLED', { session });
      return session;
    } catch (err) {
      console.error('[DebugManager] enableSession error:', err);
      return {
        id: `fallback-${Date.now()}`,
        mode: options.mode,
        enabled: true,
        enabledAt: Date.now(),
        expiresAt: Date.now() + 1800000,
        ttlMinutes: 30,
      };
    }
  }

  public disableSession(): { success: boolean; message: string; previousSession: DebugSession | null } {
    try {
      const prev = this.activeSession;
      if (this.activeSession) {
        this.activeSession.enabled = false;
        this.activeSession.mode = 'OFF';
        this.sessionHistory.unshift({ ...this.activeSession });
        this.activeSession = null;
        this.recordEvent('SESSION_DISABLED', { previousSessionId: prev?.id });
      }
      return {
        success: true,
        message: 'DEBUG_SESSION_DISABLED',
        previousSession: prev,
      };
    } catch (err) {
      console.error('[DebugManager] disableSession error:', err);
      return { success: false, message: 'ERROR_DISABLING_SESSION', previousSession: null };
    }
  }

  public getSessions(): { active: DebugSession | null; history: DebugSession[] } {
    this.checkSessionExpiry();
    return {
      active: this.activeSession,
      history: this.sessionHistory.slice(0, 50),
    };
  }

  public getSessionById(sessionId: string): DebugSession | null {
    if (this.activeSession && this.activeSession.id === sessionId) {
      return this.activeSession;
    }
    return this.sessionHistory.find((s) => s.id === sessionId) || null;
  }

  public deleteSession(sessionId: string): boolean {
    if (this.activeSession && this.activeSession.id === sessionId) {
      this.disableSession();
      return true;
    }
    const idx = this.sessionHistory.findIndex((s) => s.id === sessionId);
    if (idx !== -1) {
      this.sessionHistory.splice(idx, 1);
      return true;
    }
    return false;
  }

  public getStatus(): DebugManifest {
    this.checkSessionExpiry();
    const mode = this.getMode();
    const mem = process.memoryUsage();

    return {
      debugEnabled: mode !== 'OFF',
      activeMode: mode,
      activeSession: this.activeSession,
      activeWorkspaceId: this.activeSession?.workspaceId || null,
      availableEndpoints: AVAILABLE_ENDPOINTS,
      supportedOperations: SUPPORTED_OPERATIONS,
      systemMetrics: {
        memoryUsageMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
        uptimeSec: Math.round((Date.now() - this.startTime) / 1000),
        eventsBuffered: this.events.length,
        mutationsCount: this.mutations.length,
        requestsCount: this.requests.length,
        errorsCount: this.errors.length,
      },
    };
  }

  // --------------------------------------------------------------------------
  // CONFIGURATION MANAGEMENT
  // --------------------------------------------------------------------------

  public getConfig(): DebugConfiguration {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<DebugConfiguration>): DebugConfiguration {
    this.config = {
      ...this.config,
      ...newConfig,
    };
    this.saveConfigToDisk();
    return { ...this.config };
  }

  private loadConfigFromDisk(): void {
    try {
      const vaultPath = getVaultAbsolutePath();
      const configPath = path.join(vaultPath, '.docustack', 'debug', 'config.json');
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.config = { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch {
      // Keep defaults
    }
  }

  private saveConfigToDisk(): void {
    try {
      const vaultPath = getVaultAbsolutePath();
      const debugDir = path.join(vaultPath, '.docustack', 'debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      fs.writeFileSync(path.join(debugDir, 'config.json'), JSON.stringify(this.config, null, 2), 'utf-8');
    } catch {
      // Storage write error ignored in headless mode
    }
  }

  // --------------------------------------------------------------------------
  // DATA REDACTION (PASSWORDS, TOKENS, SECRETS)
  // --------------------------------------------------------------------------

  public redact(data: any): any {
    if (data === null || data === undefined) return data;
    if (typeof data !== 'object') {
      if (typeof data === 'string' && /^(Bearer\s+|ey[A-Za-z0-9-_=]+\.)/i.test(data)) {
        return '[REDACTED_AUTH_TOKEN]';
      }
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.redact(item));
    }

    const redacted: Record<string, any> = {};
    const sensitiveKeyRegex = /password|secret|token|authorization|auth|cookie|key|credential/i;

    for (const [key, value] of Object.entries(data)) {
      if (sensitiveKeyRegex.test(key)) {
        redacted[key] = '[REDACTED]';
      } else if (this.config.maskDocumentText && (key === 'content' || key === 'documentText')) {
        redacted[key] = typeof value === 'string' ? `[MASKED_TEXT: length=${value.length}]` : '[MASKED_TEXT]';
      } else {
        redacted[key] = this.redact(value);
      }
    }

    return redacted;
  }

  // --------------------------------------------------------------------------
  // EVENT RECORDING & CIRCULAR BUFFERS
  // --------------------------------------------------------------------------

  public recordEvent(type: string, data: any, workspaceId?: string): void {
    try {
      const mode = this.getMode();
      if (mode === 'OFF') return;

      const event: DebugEvent = {
        id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        type,
        workspaceId,
        data: this.redact(data),
      };

      this.events.unshift(event);
      if (this.events.length > this.config.maxEvents) {
        this.events.length = this.config.maxEvents;
      }

      // Notify SSE subscribers if in TRACE mode
      if (mode === 'TRACE') {
        this.notifyTraceListeners(event);
      }
    } catch (err) {
      console.error('[DebugManager] recordEvent error:', err);
    }
  }

  public recordMutation(mutation: Omit<MutationEvent, 'id' | 'timestamp'>): MutationEvent {
    try {
      const mode = this.getMode();
      const currentRev = this.getRevision(mutation.workspaceId);
      const nextRev = currentRev.backend + 1;
      this.updateRevision(mutation.workspaceId, { backend: nextRev });

      const fullMutation: MutationEvent = {
        id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        workspaceId: mutation.workspaceId,
        type: mutation.type,
        payload: this.redact(mutation.payload),
        source: mutation.source,
        resultingRevision: nextRev,
      };

      if (mode !== 'OFF') {
        this.mutations.unshift(fullMutation);
        if (this.mutations.length > this.config.maxEvents) {
          this.mutations.length = this.config.maxEvents;
        }
        this.recordEvent(`MUTATION_${mutation.type}`, fullMutation, mutation.workspaceId);
      }

      return fullMutation;
    } catch (err) {
      console.error('[DebugManager] recordMutation error:', err);
      return {
        id: `mut-err-${Date.now()}`,
        timestamp: Date.now(),
        workspaceId: mutation.workspaceId,
        type: mutation.type,
        payload: mutation.payload,
        source: mutation.source,
        resultingRevision: 0,
      };
    }
  }

  public recordRequest(req: Omit<ApiDebugEvent, 'id' | 'timestamp'>): void {
    try {
      const mode = this.getMode();
      if (mode === 'OFF') return;

      const event: ApiDebugEvent = {
        id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        workspaceId: req.workspaceId,
        method: req.method,
        path: req.path,
        status: req.status,
        durationMs: req.durationMs,
        requestBody: this.config.capturePayloads ? this.redact(req.requestBody) : undefined,
        responseBody: this.config.capturePayloads ? this.redact(req.responseBody) : undefined,
        initiator: req.initiator,
      };

      this.requests.unshift(event);
      if (this.requests.length > this.config.maxEvents) {
        this.requests.length = this.config.maxEvents;
      }

      if (mode === 'TRACE') {
        this.recordEvent('API_REQUEST', event, req.workspaceId);
      }
    } catch (err) {
      console.error('[DebugManager] recordRequest error:', err);
    }
  }

  public recordPersistence(p: Omit<PersistenceDebugEvent, 'id' | 'timestamp'>): void {
    try {
      const mode = this.getMode();
      if (p.success && p.type === 'WRITE') {
        const rev = this.getRevision(p.workspaceId);
        this.updateRevision(p.workspaceId, { persisted: rev.backend });
      }

      if (mode === 'OFF') return;

      const event: PersistenceDebugEvent = {
        id: `pers-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        workspaceId: p.workspaceId,
        type: p.type,
        storageProvider: p.storageProvider,
        filePath: p.filePath,
        durationMs: p.durationMs,
        payloadSizeBytes: p.payloadSizeBytes,
        success: p.success,
        error: p.error,
      };

      this.persistenceEvents.unshift(event);
      if (this.persistenceEvents.length > this.config.maxEvents) {
        this.persistenceEvents.length = this.config.maxEvents;
      }

      this.recordEvent(`PERSISTENCE_${p.type}`, event, p.workspaceId);
    } catch (err) {
      console.error('[DebugManager] recordPersistence error:', err);
    }
  }

  public recordError(errEv: Omit<ErrorDebugEvent, 'id' | 'timestamp'>): void {
    try {
      const event: ErrorDebugEvent = {
        id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        workspaceId: errEv.workspaceId,
        layer: errEv.layer,
        message: errEv.message,
        stack: errEv.stack,
        operation: errEv.operation,
        breadcrumbs: errEv.breadcrumbs,
      };

      this.errors.unshift(event);
      if (this.errors.length > this.config.maxEvents) {
        this.errors.length = this.config.maxEvents;
      }

      this.recordEvent('ERROR_CAPTURED', event, errEv.workspaceId);
    } catch (err) {
      console.error('[DebugManager] recordError error:', err);
    }
  }

  public recordPerformance(sample: Omit<PerformanceSample, 'id' | 'timestamp'>): void {
    try {
      const mode = this.getMode();
      if (mode === 'OFF') return;

      const s: PerformanceSample = {
        id: `perf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        workspaceId: sample.workspaceId,
        metric: sample.metric,
        value: sample.value,
        unit: sample.unit,
        context: sample.context,
      };

      this.performanceSamples.unshift(s);
      if (this.performanceSamples.length > this.config.maxEvents) {
        this.performanceSamples.length = this.config.maxEvents;
      }
    } catch (err) {
      console.error('[DebugManager] recordPerformance error:', err);
    }
  }

  // --------------------------------------------------------------------------
  // QUERY METHODS FOR DIAGNOSTICS
  // --------------------------------------------------------------------------

  public getEvents(options: { workspaceId?: string; type?: string; limit?: number; since?: number } = {}): DebugEvent[] {
    const limit = options.limit || 100;
    return this.events
      .filter((e) => (!options.workspaceId || e.workspaceId === options.workspaceId) &&
                     (!options.type || e.type.startsWith(options.type)) &&
                     (!options.since || e.timestamp >= options.since))
      .slice(0, limit);
  }

  public getMutations(options: { workspaceId?: string; type?: string; limit?: number } = {}): MutationEvent[] {
    const limit = options.limit || 100;
    return this.mutations
      .filter((m) => (!options.workspaceId || m.workspaceId === options.workspaceId) &&
                     (!options.type || m.type === options.type))
      .slice(0, limit);
  }

  public getRequests(options: { workspaceId?: string; status?: number; limit?: number } = {}): ApiDebugEvent[] {
    const limit = options.limit || 100;
    return this.requests
      .filter((r) => (!options.workspaceId || r.workspaceId === options.workspaceId) &&
                     (!options.status || r.status === options.status))
      .slice(0, limit);
  }

  public getPersistenceEvents(options: { workspaceId?: string; type?: string; limit?: number } = {}): PersistenceDebugEvent[] {
    const limit = options.limit || 100;
    return this.persistenceEvents
      .filter((p) => (!options.workspaceId || p.workspaceId === options.workspaceId) &&
                     (!options.type || p.type === options.type))
      .slice(0, limit);
  }

  public getErrors(options: { workspaceId?: string; layer?: string; limit?: number } = {}): ErrorDebugEvent[] {
    const limit = options.limit || 100;
    return this.errors
      .filter((e) => (!options.workspaceId || e.workspaceId === options.workspaceId) &&
                     (!options.layer || e.layer === options.layer))
      .slice(0, limit);
  }

  public getPerformance(options: { workspaceId?: string; metric?: string } = {}): {
    samples: PerformanceSample[];
    averages: Record<string, number>;
  } {
    const filtered = this.performanceSamples.filter(
      (s) => (!options.workspaceId || s.workspaceId === options.workspaceId) &&
             (!options.metric || s.metric === options.metric)
    );

    const sums: Record<string, { total: number; count: number }> = {};
    for (const s of filtered) {
      if (!sums[s.metric]) sums[s.metric] = { total: 0, count: 0 };
      sums[s.metric].total += s.value;
      sums[s.metric].count++;
    }

    const averages: Record<string, number> = {};
    for (const [k, v] of Object.entries(sums)) {
      averages[k] = Math.round((v.total / v.count) * 100) / 100;
    }

    return { samples: filtered.slice(0, 100), averages };
  }

  // --------------------------------------------------------------------------
  // REVISION TRACKING
  // --------------------------------------------------------------------------

  public getRevision(workspaceId: string = 'default'): { frontend: number; backend: number; persisted: number } {
    const current = this.workspaceRevisions.get(workspaceId);
    if (current) return { ...current };
    return { frontend: 1, backend: 1, persisted: 1 };
  }

  public updateRevision(
    workspaceId: string = 'default',
    updates: Partial<{ frontend: number; backend: number; persisted: number }>
  ): WorkspaceRevisions {
    const current = this.getRevision(workspaceId);
    const updated = {
      frontend: updates.frontend ?? current.frontend,
      backend: updates.backend ?? current.backend,
      persisted: updates.persisted ?? current.persisted,
    };
    this.workspaceRevisions.set(workspaceId, updated);

    let driftType: WorkspaceRevisions['driftType'] = 'IN_SYNC';
    if (updated.frontend !== updated.backend || updated.backend !== updated.persisted) {
      if (updated.frontend > updated.backend) driftType = 'AHEAD';
      else if (updated.frontend < updated.backend) driftType = 'BEHIND';
      else driftType = 'COLLISION';
    }

    return {
      workspaceId,
      frontendRevision: updated.frontend,
      backendRevision: updated.backend,
      persistedRevision: updated.persisted,
      inSync: updated.frontend === updated.backend && updated.backend === updated.persisted,
      driftType,
    };
  }

  // --------------------------------------------------------------------------
  // 4-TIER STATE INSPECTION ENGINE
  // --------------------------------------------------------------------------

  /**
   * TIER 1: FRONTEND STATE
   * In-memory React state reported by client collector via /api/debug/ui-state
   */
  public getFrontendSnapshot(workspaceId: string = 'default'): FrontendSnapshot {
    try {
      const cached = (globalThis as any).__docustack_latest_ui_state;
      const isFresh = cached && Date.now() - cached.clientMeta.receivedAt < 300000;
      const clientState = cached?.state;
      const rev = this.getRevision(workspaceId);

      if (clientState) {
        const wsGraph = clientState.nodeGraph;
        return {
          workspaceId,
          clientConnected: Boolean(isFresh),
          lastSeenAgoMs: cached?.clientMeta?.receivedAt ? Date.now() - cached.clientMeta.receivedAt : -1,
          graph: {
            nodes: wsGraph?.nodes || [],
            edges: wsGraph?.edges || [],
            groups: wsGraph?.groups || [],
          },
          categories: clientState.vaultBrowser?.categories || [],
          documents: clientState.vaultBrowser?.documents || [],
          uiState: {
            viewport: wsGraph?.viewport || { scale: 1, pan: { x: 0, y: 0 } },
            activeSelection: wsGraph?.activeSelection || { selectedNodeIds: [], focusTarget: null },
            saveStatus: wsGraph?.saveStatus || 'idle',
            viewMode: clientState.menus?.navigation?.viewMode || 'graph',
          },
          revision: rev.frontend,
          timestamp: clientState.timestamp || Date.now(),
        };
      }

      // No active client reported yet: return empty snapshot
      return {
        workspaceId,
        clientConnected: false,
        lastSeenAgoMs: -1,
        graph: { nodes: [], edges: [], groups: [] },
        categories: [],
        documents: [],
        uiState: {},
        revision: rev.frontend,
        timestamp: Date.now(),
      };
    } catch (err: any) {
      this.recordError({
        layer: 'frontend',
        message: `Failed to assemble frontend snapshot: ${err?.message}`,
        workspaceId,
      });
      return {
        workspaceId,
        clientConnected: false,
        lastSeenAgoMs: -1,
        graph: { nodes: [], edges: [], groups: [] },
        categories: [],
        documents: [],
        uiState: {},
        revision: 0,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * TIER 2: BACKEND STATE
   * Authoritative backend memory and API state
   */
  public async getBackendSnapshot(workspaceId: string = 'default'): Promise<BackendSnapshot> {
    try {
      const graph = await loadGraphFromFSAsync();
      const categories = await loadCategoriesFromFSAsync();
      const documents = await loadDocumentsFromFSAsync();
      const rev = this.getRevision(workspaceId);

      return {
        workspaceId,
        graph: {
          nodes: graph.nodes || [],
          edges: graph.edges || [],
          groups: graph.groups || [],
        },
        categories: categories || [],
        documents: documents || [],
        revision: rev.backend,
        timestamp: Date.now(),
      };
    } catch (err: any) {
      this.recordError({
        layer: 'backend',
        message: `Failed to assemble backend snapshot: ${err?.message}`,
        workspaceId,
      });
      return {
        workspaceId,
        graph: { nodes: [], edges: [], groups: [] },
        categories: [],
        documents: [],
        revision: 0,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * TIER 3: PERSISTED STATE
   * MUST read directly from physical disk / storage bypassing memory cache
   */
  public async getPersistedSnapshot(workspaceId: string = 'default'): Promise<PersistedSnapshot> {
    try {
      const vaultPath = getVaultAbsolutePath();
      const metaDir = path.join(vaultPath, '.docustack');
      const graphFile = path.join(metaDir, 'graph.json');
      const catFile = path.join(metaDir, 'categories.json');
      const docFile = path.join(metaDir, 'documents_index.json');

      let rawGraph: any = { nodes: [], edges: [], groups: [] };
      let rawCategories: any[] = [];
      let rawDocuments: any[] = [];
      let totalBytes = 0;
      let existsOnDisk = false;

      // Direct disk reads
      if (fs.existsSync(graphFile)) {
        existsOnDisk = true;
        const stat = fs.statSync(graphFile);
        totalBytes += stat.size;
        const text = fs.readFileSync(graphFile, 'utf-8');
        try {
          rawGraph = JSON.parse(text);
        } catch {}
      }

      if (fs.existsSync(catFile)) {
        const stat = fs.statSync(catFile);
        totalBytes += stat.size;
        const text = fs.readFileSync(catFile, 'utf-8');
        try {
          rawCategories = JSON.parse(text);
        } catch {}
      }

      if (fs.existsSync(docFile)) {
        const stat = fs.statSync(docFile);
        totalBytes += stat.size;
        const text = fs.readFileSync(docFile, 'utf-8');
        try {
          rawDocuments = JSON.parse(text);
        } catch {}
      }

      const rev = this.getRevision(workspaceId);
      const storageConn = getActiveStorageConn();

      return {
        workspaceId,
        storageProvider: storageConn?.provider || 'local_fs',
        vaultPath,
        filePath: graphFile,
        graph: {
          nodes: rawGraph.nodes || [],
          edges: rawGraph.edges || [],
          groups: rawGraph.groups || [],
        },
        categories: Array.isArray(rawCategories) ? rawCategories : [],
        documents: Array.isArray(rawDocuments) ? rawDocuments : [],
        rawPayloadSize: totalBytes,
        revision: rev.persisted,
        timestamp: Date.now(),
        existsOnDisk,
      };
    } catch (err: any) {
      this.recordError({
        layer: 'persistence',
        message: `Failed to read persisted state directly from disk: ${err?.message}`,
        workspaceId,
      });
      return {
        workspaceId,
        storageProvider: 'local_fs',
        vaultPath: '',
        filePath: '',
        graph: { nodes: [], edges: [], groups: [] },
        categories: [],
        documents: [],
        rawPayloadSize: 0,
        revision: 0,
        timestamp: Date.now(),
        existsOnDisk: false,
      };
    }
  }

  /**
   * TIER 4: RENDERED STATE
   * Extracted from actual client DOM elements / canvas nodes
   */
  public getRenderedSnapshot(workspaceId: string = 'default'): RenderedSnapshot {
    try {
      const cached = (globalThis as any).__docustack_latest_ui_state;
      const clientState = cached?.state;
      const renderedPayload = (globalThis as any).__docustack_latest_rendered_state;

      // If client supplied explicit rendered DOM extraction:
      if (renderedPayload && renderedPayload.workspaceId === workspaceId) {
        return renderedPayload;
      }

      // Reconstruct from client state nodeGraph if available
      const nodes = clientState?.nodeGraph?.nodes || [];
      const edges = clientState?.nodeGraph?.edges || [];
      const groups = clientState?.nodeGraph?.groups || [];
      const nodeIds = nodes.map((n: any) => n.id);
      const edgeIds = edges.map((e: any) => e.id);
      const groupIds = groups.map((g: any) => g.id);

      return {
        workspaceId,
        renderedNodeIds: nodeIds,
        renderedEdgeIds: edgeIds,
        renderedGroupIds: groupIds,
        nodeCount: nodeIds.length,
        edgeCount: edgeIds.length,
        groupCount: groupIds.length,
        visibleNodeIds: nodeIds,
        selectedNodeIds: clientState?.nodeGraph?.activeSelection?.selectedNodeIds || [],
        viewport: clientState?.nodeGraph?.viewport || { scale: 1, pan: { x: 0, y: 0 } },
        zoomLevel: clientState?.nodeGraph?.viewport?.scale || 1,
        renderOmissions: [],
        timestamp: Date.now(),
      };
    } catch (err: any) {
      this.recordError({
        layer: 'renderer',
        message: `Failed to extract rendered snapshot: ${err?.message}`,
        workspaceId,
      });
      return {
        workspaceId,
        renderedNodeIds: [],
        renderedEdgeIds: [],
        renderedGroupIds: [],
        nodeCount: 0,
        edgeCount: 0,
        groupCount: 0,
        visibleNodeIds: [],
        selectedNodeIds: [],
        viewport: { scale: 1, pan: { x: 0, y: 0 } },
        zoomLevel: 1,
        renderOmissions: [],
        timestamp: Date.now(),
      };
    }
  }

  /**
   * COMPLETE WORKSPACE SNAPSHOT (ALL 4 TIERS + REVISIONS + CONSISTENCY)
   */
  public async getCompleteWorkspaceSnapshot(workspaceId: string = 'default'): Promise<CompleteWorkspaceSnapshot> {
    const [backend, persisted] = await Promise.all([
      this.getBackendSnapshot(workspaceId),
      this.getPersistedSnapshot(workspaceId),
    ]);
    const frontend = this.getFrontendSnapshot(workspaceId);
    const rendered = this.getRenderedSnapshot(workspaceId);
    const revisions = this.updateRevision(workspaceId, {});
    const consistency = this.evaluateConsistency(workspaceId, frontend, backend, persisted, rendered, revisions);

    return {
      workspaceId,
      timestamp: Date.now(),
      frontend: frontend.clientConnected ? frontend : null,
      backend,
      persisted,
      rendered,
      revisions,
      consistency,
    };
  }

  // --------------------------------------------------------------------------
  // CONSISTENCY VERIFICATION & DRIFT DETECTION
  // --------------------------------------------------------------------------

  public async runConsistencyCheck(workspaceId: string = 'default'): Promise<ConsistencyCheckResult> {
    const [backend, persisted] = await Promise.all([
      this.getBackendSnapshot(workspaceId),
      this.getPersistedSnapshot(workspaceId),
    ]);
    const frontend = this.getFrontendSnapshot(workspaceId);
    const rendered = this.getRenderedSnapshot(workspaceId);
    const revisions = this.updateRevision(workspaceId, {});

    return this.evaluateConsistency(workspaceId, frontend, backend, persisted, rendered, revisions);
  }

  private evaluateConsistency(
    workspaceId: string,
    frontend: FrontendSnapshot,
    backend: BackendSnapshot,
    persisted: PersistedSnapshot,
    rendered: RenderedSnapshot,
    revisions: WorkspaceRevisions
  ): ConsistencyCheckResult {
    const discrepancies: Discrepancy[] = [];
    const comparisons: LayerComparison[] = [];

    const pNodes = persisted.graph.nodes;
    const bNodes = backend.graph.nodes;
    const fNodes = frontend.clientConnected ? frontend.graph.nodes : bNodes;
    const rNodeIds = rendered.renderedNodeIds.length > 0 ? rendered.renderedNodeIds : fNodes.map((n) => n.id);

    const pEdges = persisted.graph.edges;
    const bEdges = backend.graph.edges;
    const fEdges = frontend.clientConnected ? frontend.graph.edges : bEdges;

    const pDocs = persisted.documents;
    const bDocs = backend.documents;
    const fDocs = frontend.clientConnected ? frontend.documents : bDocs;

    const pCats = persisted.categories;
    const bCats = backend.categories;
    const fCats = frontend.clientConnected ? frontend.categories : bCats;

    // 1. Persisted vs Backend comparison
    const pbNodeDiff = Math.abs(pNodes.length - bNodes.length);
    const pbEdgeDiff = Math.abs(pEdges.length - bEdges.length);
    const pbDocDiff = Math.abs(pDocs.length - bDocs.length);
    const pbCatDiff = Math.abs(pCats.length - bCats.length);

    comparisons.push({
      layerA: 'PERSISTED',
      layerB: 'BACKEND',
      match: pbNodeDiff === 0 && pbEdgeDiff === 0 && pbDocDiff === 0 && pbCatDiff === 0,
      nodeDiff: pbNodeDiff,
      edgeDiff: pbEdgeDiff,
      docDiff: pbDocDiff,
      catDiff: pbCatDiff,
    });

    // 2. Backend vs Frontend comparison
    const bfNodeDiff = Math.abs(bNodes.length - fNodes.length);
    const bfEdgeDiff = Math.abs(bEdges.length - fEdges.length);
    const bfDocDiff = Math.abs(bDocs.length - fDocs.length);
    const bfCatDiff = Math.abs(bCats.length - fCats.length);

    comparisons.push({
      layerA: 'BACKEND',
      layerB: 'FRONTEND',
      match: bfNodeDiff === 0 && bfEdgeDiff === 0 && bfDocDiff === 0 && bfCatDiff === 0,
      nodeDiff: bfNodeDiff,
      edgeDiff: bfEdgeDiff,
      docDiff: bfDocDiff,
      catDiff: bfCatDiff,
    });

    // 3. Frontend vs Rendered comparison
    const frNodeDiff = Math.abs(fNodes.length - rNodeIds.length);
    comparisons.push({
      layerA: 'FRONTEND',
      layerB: 'RENDERED',
      match: frNodeDiff === 0,
      nodeDiff: frNodeDiff,
      edgeDiff: 0,
      docDiff: 0,
      catDiff: 0,
    });

    // Detailed Discrepancy Detection:
    // A. Ghost Nodes (In Persisted, missing from Backend/Frontend)
    const bNodeIdSet = new Set(bNodes.map((n) => n.id));
    for (const pNode of pNodes) {
      if (!bNodeIdSet.has(pNode.id)) {
        discrepancies.push({
          type: 'GHOST_NODE',
          entity: 'node',
          id: pNode.id,
          details: `Node "${pNode.title || pNode.id}" exists on disk but is absent from authoritative backend state`,
          sourceLayer: 'PERSISTED',
          targetLayer: 'BACKEND',
        });
      }
    }

    // B. Phantom Nodes (In Frontend, missing from Backend)
    if (frontend.clientConnected) {
      for (const fNode of fNodes) {
        if (!bNodeIdSet.has(fNode.id)) {
          discrepancies.push({
            type: 'PHANTOM_NODE',
            entity: 'node',
            id: fNode.id,
            details: `Node "${fNode.title || fNode.id}" exists in client React state but has not synced to backend`,
            sourceLayer: 'FRONTEND',
            targetLayer: 'BACKEND',
          });
        }
      }
    }

    // C. Render Lag (In Frontend state, missing from Rendered DOM)
    const rNodeIdSet = new Set(rNodeIds);
    for (const fNode of fNodes) {
      if (!rNodeIdSet.has(fNode.id)) {
        discrepancies.push({
          type: 'RENDER_LAG',
          entity: 'node',
          id: fNode.id,
          details: `Node "${fNode.title || fNode.id}" is in state but missing from canvas DOM rendering`,
          sourceLayer: 'FRONTEND',
          targetLayer: 'RENDERED',
        });
      }
    }

    // D. Zombie Edges (Edges referencing deleted or non-existent nodes)
    for (const edge of bEdges) {
      const srcExists = bNodeIdSet.has(edge.source);
      const tgtExists = bNodeIdSet.has(edge.target);
      if (!srcExists || !tgtExists) {
        discrepancies.push({
          type: 'ZOMBIE_EDGE',
          entity: 'edge',
          id: edge.id,
          details: `Edge references non-existent node: source=${edge.source} (exists: ${srcExists}), target=${edge.target} (exists: ${tgtExists})`,
          sourceLayer: 'BACKEND',
        });
      }
    }

    // E. Property Drift (Position mismatch between Frontend and Backend)
    if (frontend.clientConnected) {
      for (const fNode of fNodes) {
        const bNode = bNodes.find((n) => n.id === fNode.id);
        if (bNode && fNode.position && bNode.position) {
          const dx = Math.abs((fNode.position.x || 0) - (bNode.position.x || 0));
          const dy = Math.abs((fNode.position.y || 0) - (bNode.position.y || 0));
          if (dx > 1 || dy > 1) {
            discrepancies.push({
              type: 'PROPERTY_DRIFT',
              entity: 'node',
              id: fNode.id,
              details: `Node position drift: Frontend=(${fNode.position.x}, ${fNode.position.y}) vs Backend=(${bNode.position.x}, ${bNode.position.y})`,
              sourceLayer: 'FRONTEND',
              targetLayer: 'BACKEND',
            });
          }
        }
      }
    }

    // F. Revision Lag
    if (!revisions.inSync) {
      discrepancies.push({
        type: 'REVISION_LAG',
        entity: 'revision',
        id: workspaceId,
        details: `Revision mismatch: Frontend=${revisions.frontendRevision}, Backend=${revisions.backendRevision}, Persisted=${revisions.persistedRevision} (Drift: ${revisions.driftType})`,
      });
    }

    return {
      workspaceId,
      timestamp: Date.now(),
      consistent: discrepancies.length === 0,
      layerComparisons: comparisons,
      discrepancies,
      revisions,
      summary: {
        persistedNodeCount: pNodes.length,
        backendNodeCount: bNodes.length,
        frontendNodeCount: fNodes.length,
        renderedNodeCount: rNodeIds.length,
      },
    };
  }

  // --------------------------------------------------------------------------
  // FIELD-LEVEL STATE DIFF ENGINE
  // --------------------------------------------------------------------------

  public async computeStateDiff(
    workspaceId: string = 'default',
    sourceLayer: string = 'frontend',
    targetLayer: string = 'backend'
  ): Promise<StateDiff> {
    try {
      const srcData = await this.getLayerData(workspaceId, sourceLayer);
      const tgtData = await this.getLayerData(workspaceId, targetLayer);

      const added: StateDiffItem[] = [];
      const removed: StateDiffItem[] = [];
      const changed: StateDiffItem[] = [];

      // Diff Nodes
      const srcNodeMap = new Map(srcData.nodes.map((n: any) => [n.id, n]));
      const tgtNodeMap = new Map(tgtData.nodes.map((n: any) => [n.id, n]));

      for (const [id, tNode] of tgtNodeMap) {
        if (!srcNodeMap.has(id)) {
          added.push({ entity: 'node', id, data: tNode });
        } else {
          const sNode = srcNodeMap.get(id);
          // Compare primary fields
          ['title', 'type', 'isWorkspaceRoot'].forEach((f) => {
            if (sNode[f] !== tNode[f]) {
              changed.push({ entity: 'node', id, field: f, source: sNode[f], target: tNode[f] });
            }
          });
          if (sNode.position && tNode.position) {
            if (sNode.position.x !== tNode.position.x || sNode.position.y !== tNode.position.y) {
              changed.push({
                entity: 'node',
                id,
                field: 'position',
                source: sNode.position,
                target: tNode.position,
              });
            }
          }
        }
      }

      for (const [id, sNode] of srcNodeMap) {
        if (!tgtNodeMap.has(id)) {
          removed.push({ entity: 'node', id, data: sNode });
        }
      }

      // Diff Documents
      const srcDocMap = new Map(srcData.documents.map((d: any) => [d.id, d]));
      const tgtDocMap = new Map(tgtData.documents.map((d: any) => [d.id, d]));

      for (const [id, tDoc] of tgtDocMap) {
        if (!srcDocMap.has(id)) {
          added.push({ entity: 'document', id, data: tDoc });
        }
      }
      for (const [id, sDoc] of srcDocMap) {
        if (!tgtDocMap.has(id)) {
          removed.push({ entity: 'document', id, data: sDoc });
        }
      }

      return {
        workspaceId,
        source: sourceLayer,
        target: targetLayer,
        equal: added.length === 0 && removed.length === 0 && changed.length === 0,
        added,
        removed,
        changed,
        timestamp: Date.now(),
      };
    } catch (err: any) {
      this.recordError({
        layer: 'backend',
        message: `State diff failed: ${err?.message}`,
        workspaceId,
      });
      return {
        workspaceId,
        source: sourceLayer,
        target: targetLayer,
        equal: false,
        added: [],
        removed: [],
        changed: [],
        timestamp: Date.now(),
      };
    }
  }

  private async getLayerData(workspaceId: string, layer: string): Promise<{ nodes: any[]; edges: any[]; documents: any[] }> {
    const l = layer.toLowerCase().trim();
    if (l === 'persisted' || l === 'disk' || l === 'storage') {
      const snap = await this.getPersistedSnapshot(workspaceId);
      return { nodes: snap.graph.nodes, edges: snap.graph.edges, documents: snap.documents };
    }
    if (l === 'frontend' || l === 'ui' || l === 'client') {
      const snap = this.getFrontendSnapshot(workspaceId);
      return { nodes: snap.graph.nodes, edges: snap.graph.edges, documents: snap.documents };
    }
    if (l === 'rendered' || l === 'dom') {
      const snap = this.getRenderedSnapshot(workspaceId);
      return {
        nodes: snap.renderedNodeIds.map((id) => ({ id })),
        edges: snap.renderedEdgeIds.map((id) => ({ id })),
        documents: [],
      };
    }
    // Default: backend
    const snap = await this.getBackendSnapshot(workspaceId);
    return { nodes: snap.graph.nodes, edges: snap.graph.edges, documents: snap.documents };
  }

  // --------------------------------------------------------------------------
  // LIVE SSE TRACE DISPATCHER
  // --------------------------------------------------------------------------

  public subscribeTrace(listener: (event: DebugEvent) => void): () => void {
    this.traceListeners.add(listener);
    return () => {
      this.traceListeners.delete(listener);
    };
  }

  private notifyTraceListeners(event: DebugEvent): void {
    for (const listener of this.traceListeners) {
      try {
        listener(event);
      } catch {
        // Listener dropped
      }
    }
  }

  // --------------------------------------------------------------------------
  // DIAGNOSTIC EXPORT BUNDLE
  // --------------------------------------------------------------------------

  public async exportDiagnostics(workspaceId: string = 'default'): Promise<DiagnosticBundle> {
    const status = this.getStatus();
    const complete = await this.getCompleteWorkspaceSnapshot(workspaceId);
    const consistency = await this.runConsistencyCheck(workspaceId);
    const perf = this.getPerformance({ workspaceId });

    return {
      exportVersion: '1.0.0',
      exportedAt: Date.now(),
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: process.memoryUsage(),
        uptime: Math.round(process.uptime()),
      },
      debugStatus: status,
      config: this.getConfig(),
      activeWorkspaces: [complete],
      consistencyChecks: {
        [workspaceId]: consistency,
      },
      recentMutations: this.getMutations({ workspaceId, limit: 100 }),
      recentRequests: this.getRequests({ workspaceId, limit: 100 }),
      recentPersistenceEvents: this.getPersistenceEvents({ workspaceId, limit: 100 }),
      recentErrors: this.getErrors({ workspaceId, limit: 100 }),
      performanceMetrics: {
        recentSamples: perf.samples,
        averages: perf.averages,
      },
    };
  }
}

// Global Singleton pattern to maintain persistence across Next.js API route re-evaluations
const globalForDebug = globalThis as unknown as { __docustack_debug_manager?: DebugManager };

export const debugManager = globalForDebug.__docustack_debug_manager ?? new DebugManager();

if (process.env.NODE_ENV !== 'production') {
  globalForDebug.__docustack_debug_manager = debugManager;
}
