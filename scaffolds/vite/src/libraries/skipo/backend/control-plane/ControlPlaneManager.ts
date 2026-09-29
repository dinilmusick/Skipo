/**
 * ASCII Architecture Flowchart: ControlPlaneManager
 *
 *   ┌──────────────────────────────────────┐
 *   │    Initialize ControlPlaneManager    │
 *   └──────────────────────────────────────┘
 *                      │
 *                      ▼
 *   ┌──────────────────────────────────────┐
 *   │  Execute Component / Pipeline Logic  │
 *   └──────────────────────────────────────┘
 *                      │
 *                      ▼
 *   ┌──────────────────────────────────────┐
 *   │    Return State / Result Payload     │
 *   └──────────────────────────────────────┘
 */

import { SkipoBase } from '@skipo/core';
import { BaseAccountProvider } from '../auth/BaseAccountProvider.js';
import { AuditLogger } from './AuditLogger.js';
import { DatabaseClusterManager } from './DatabaseClusterManager.js';

// ════ TYPES & DOMAIN CONTRACTS ════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export class ControlPlaneManager extends SkipoBase {
  public auth: BaseAccountProvider;
  public audit: AuditLogger;
  public cluster: DatabaseClusterManager;

  constructor(auth: BaseAccountProvider, audit: AuditLogger, cluster: DatabaseClusterManager) {
    super();
    this.auth = auth;
    this.audit = audit;
    this.cluster = cluster;
  }
}