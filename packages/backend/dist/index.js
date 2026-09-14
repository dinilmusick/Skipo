import {
  BaseApiRoute,
  createSSEResponse,
  withAuth,
  withCors
} from "./chunk-OSNAPMXJ.js";
import {
  AdminGuard,
  BaseAccountProvider,
  LocalAccountProvider,
  PasswordHasher,
  RateLimiter,
  SessionManager
} from "./chunk-DKN5GP4J.js";
import {
  BackendProvider,
  useBackend,
  useBackendClient
} from "./chunk-G3ZOSXUR.js";
import {
  BackendRegistry,
  ConcurrencyConflictError,
  ConcurrencyManager,
  HealthMonitor,
  IdempotencyManager,
  InProcessExecutor,
  JobScheduler,
  LoadBalancer,
  LockManager,
  RemoteExecutor,
  createEmptyContract
} from "./chunk-5E6JRFUH.js";
import {
  BackendClient,
  BackendResolver,
  CallbackRegistry,
  EventBus,
  FrontendSession,
  HTTPTransport,
  SequenceTracker,
  WebSocketTransport,
  createBackendClient
} from "./chunk-NIP22V2G.js";
import {
  BackblazeB2Adapter,
  BaseStorageAdapter,
  LocalFSAdapter,
  S3Adapter,
  StorageAdapterFactory,
  SupabaseStorageAdapter,
  ensureS3DirectoryMarker,
  isSecretMasked,
  normalizeBackblazeCredentials,
  permanentDeleteS3Folder,
  permanentDeleteS3Object,
  renameS3Folder,
  resolveBackblazeEndpoint
} from "./chunk-MKILCGOP.js";

// src/workspace/WorkspaceCanonical.ts
function formatCanonicalWorkspaceFolderName(appName, userName, workspaceName) {
  const safeApp = appName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  const safeUser = userName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  const safeWs = workspaceName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  return `ultrst_${safeApp}_${safeUser}_${safeWs}`;
}
function sanitizeWorkspaceName(name) {
  return name.replace(/[^a-zA-Z0-9-_\s]/g, "").trim();
}

// src/workspace/WorkspaceFS.ts
import { SkipoBase } from "@skipo/core";
var WorkspaceFS = class extends SkipoBase {
  primary;
  syncEngine;
  config;
  constructor(primary, config, syncEngine) {
    super();
    this.primary = primary;
    this.config = config;
    this.syncEngine = syncEngine;
  }
  setPrimary(newPrimary) {
    this.primary = newPrimary;
  }
  setSyncEngine(engine) {
    this.syncEngine = engine;
  }
  async exists(pathStr) {
    return this.primary.exists(pathStr);
  }
  async stat(pathStr) {
    return this.primary.stat(pathStr);
  }
  async list(pathStr = "") {
    return this.primary.list(pathStr);
  }
  async read(pathStr) {
    return this.primary.read(pathStr);
  }
  async readText(pathStr) {
    const data = await this.read(pathStr);
    return Buffer.from(data).toString("utf8");
  }
  async write(pathStr, data) {
    await this.primary.write(pathStr, data);
    if (this.syncEngine && this.config.sync?.enabled && this.config.sync.mode === "on_write") {
      this.syncEngine.syncFile(pathStr).catch((err) => {
        console.warn(`[WorkspaceFS] Async backup sync warning for '${pathStr}':`, err.message);
      });
    }
  }
  async mkdir(pathStr) {
    await this.primary.mkdir(pathStr);
  }
  async delete(pathStr) {
    await this.primary.delete(pathStr);
    if (this.syncEngine && this.config.sync?.enabled && this.config.sync.deletePropagation) {
      this.syncEngine.deleteFile(pathStr).catch((err) => {
        console.warn(`[WorkspaceFS] Async delete sync warning for '${pathStr}':`, err.message);
      });
    }
  }
};

// src/workspace/SyncEngine.ts
import { SkipoBase as SkipoBase2 } from "@skipo/core";
var SyncEngine = class extends SkipoBase2 {
  primary;
  backups;
  config;
  constructor(primary, backups, config) {
    super({ name: "SyncEngine" });
    this.primary = primary;
    this.backups = backups;
    this.config = config;
  }
  async syncFile(pathStr) {
    const data = await this.primary.read(pathStr);
    for (const backup of this.backups) {
      try {
        await backup.write(pathStr, data);
      } catch (e) {
        console.error(`[SyncEngine] Failed to sync ${pathStr} to backup:`, e.message);
      }
    }
  }
  async deleteFile(pathStr) {
    for (const backup of this.backups) {
      try {
        await backup.delete(pathStr);
      } catch (e) {
        console.error(`[SyncEngine] Failed to delete ${pathStr} on backup:`, e.message);
      }
    }
  }
};

// src/control-plane/AuditLogger.ts
import { promises as fs } from "fs";
import path from "path";
import { SkipoBase as SkipoBase3 } from "@skipo/core";
var AuditLogger = class extends SkipoBase3 {
  logFile;
  constructor(logFile = ".skipo/audit.jsonl") {
    super();
    this.logFile = path.resolve(logFile);
  }
  async log(event) {
    const fullEvent = {
      ...event,
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now()
    };
    await fs.mkdir(path.dirname(this.logFile), { recursive: true });
    await fs.appendFile(this.logFile, JSON.stringify(fullEvent) + "\n");
  }
  async query(filter) {
    try {
      const content = await fs.readFile(this.logFile, "utf-8");
      const lines = content.split("\n").filter(Boolean);
      const events = lines.map((l) => JSON.parse(l));
      return events.filter(filter);
    } catch (e) {
      if (e.code === "ENOENT") return [];
      throw e;
    }
  }
  async tail(n) {
    try {
      const content = await fs.readFile(this.logFile, "utf-8");
      const lines = content.split("\n").filter(Boolean);
      return lines.slice(-n).map((l) => JSON.parse(l));
    } catch (e) {
      if (e.code === "ENOENT") return [];
      throw e;
    }
  }
};

// src/control-plane/DatabaseClusterManager.ts
import { SkipoBase as SkipoBase4 } from "@skipo/core";
var DatabaseClusterManager = class extends SkipoBase4 {
  config;
  health = /* @__PURE__ */ new Map();
  constructor(config) {
    super();
    this.config = config;
  }
  async probe(node) {
    const start = Date.now();
    const latency = Date.now() - start;
    const status = {
      status: "healthy",
      latencyMs: latency,
      lastCheck: Date.now()
    };
    this.health.set(node, status);
    return status;
  }
  async failover() {
    for (const node of this.config.nodes) {
      if (node !== this.config.primary) {
        const h = await this.probe(node);
        if (h.status === "healthy") {
          this.config.primary = node;
          break;
        }
      }
    }
  }
};

// src/control-plane/ControlPlaneManager.ts
import { SkipoBase as SkipoBase5 } from "@skipo/core";
var ControlPlaneManager = class extends SkipoBase5 {
  auth;
  audit;
  cluster;
  constructor(auth, audit, cluster) {
    super();
    this.auth = auth;
    this.audit = audit;
    this.cluster = cluster;
  }
};

// src/data/BaseDataProvider.ts
import { SkipoBase as SkipoBase6 } from "@skipo/core";
var BaseDataProvider = class extends SkipoBase6 {
};

// src/data/FunctionalityTable.ts
var FunctionalityTable = class extends BaseDataProvider {
  data = /* @__PURE__ */ new Map();
  async query(filters, _sort, limit) {
    let results = Array.from(this.data.values());
    if (filters) {
      results = results.filter((item) => {
        return filters.every((f) => {
          if (f.operator === "eq") return item[f.field] === f.value;
          return true;
        });
      });
    }
    if (limit) {
      results = results.slice(0, limit);
    }
    return results;
  }
  async getById(id) {
    return this.data.get(id) || null;
  }
  async insert(item) {
    if (this.data.has(item.id)) throw new Error("Already exists");
    this.data.set(item.id, item);
    return item;
  }
  async update(id, item) {
    const existing = this.data.get(id);
    if (!existing) throw new Error("Not found");
    const updated = { ...existing, ...item };
    this.data.set(id, updated);
    return updated;
  }
  async delete(id) {
    return this.data.delete(id);
  }
  async upsert(item) {
    this.data.set(item.id, item);
    return item;
  }
  async count(filters) {
    const results = await this.query(filters);
    return results.length;
  }
};

// src/architecture/types.ts
function validateServiceDefinition(def) {
  if (def.deployment === "remote" && def.runtime !== "server") {
    return {
      valid: false,
      error: `Invalid service configuration for '${def.name || "unnamed"}': remote deployment requires 'server' runtime (received runtime='${def.runtime}')`
    };
  }
  if (def.runtime === "client" && def.deployment !== "local") {
    return {
      valid: false,
      error: `Invalid service configuration for '${def.name || "unnamed"}': client runtime requires 'local' deployment (received deployment='${def.deployment}')`
    };
  }
  return { valid: true };
}
export {
  AdminGuard,
  AuditLogger,
  BackblazeB2Adapter,
  BackendClient,
  BackendProvider,
  BackendRegistry,
  BackendResolver,
  BaseAccountProvider,
  BaseApiRoute,
  BaseDataProvider,
  BaseStorageAdapter,
  CallbackRegistry,
  ConcurrencyConflictError,
  ConcurrencyManager,
  ControlPlaneManager,
  DatabaseClusterManager,
  EventBus,
  FrontendSession,
  FunctionalityTable,
  HTTPTransport,
  HealthMonitor,
  IdempotencyManager,
  InProcessExecutor,
  JobScheduler,
  LoadBalancer,
  LocalAccountProvider,
  LocalFSAdapter,
  LockManager,
  PasswordHasher,
  RateLimiter,
  RemoteExecutor,
  S3Adapter,
  SequenceTracker,
  SessionManager,
  StorageAdapterFactory,
  SupabaseStorageAdapter,
  SyncEngine,
  WebSocketTransport,
  WorkspaceFS,
  createBackendClient,
  createEmptyContract,
  createSSEResponse,
  ensureS3DirectoryMarker,
  formatCanonicalWorkspaceFolderName,
  isSecretMasked,
  normalizeBackblazeCredentials,
  permanentDeleteS3Folder,
  permanentDeleteS3Object,
  renameS3Folder,
  resolveBackblazeEndpoint,
  sanitizeWorkspaceName,
  useBackend,
  useBackendClient,
  validateServiceDefinition,
  withAuth,
  withCors
};
