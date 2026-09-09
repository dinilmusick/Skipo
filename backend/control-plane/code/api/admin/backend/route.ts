import { NextResponse } from 'next/server';
import {
  enforceAdminGuard,
  loadAdminBackendConfig,
  saveAdminBackendConfig,
  testAdminBackendConnection,
  getControlPlaneTelemetry,
  loadDatabaseClusterConfig,
  saveDatabaseClusterConfig,
  addDatabaseConnection,
  updateDatabaseConnection,
  deleteDatabaseConnection,
  testDatabaseEntryConnection,
  syncRedundantDatabases,
  autoProvisionNeonTable,
} from '@/lib/control-plane';
import { AdminBackendConfig, DatabaseConnectionEntry } from '@/lib/control-plane-types';
import { logAdminEvent } from '@/lib/audit-logger';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = createSecureRoute({
  id: 'api-admin-backend-get',
  method: 'GET',
  auth: { required: true, role: 'admin' },
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async (req) => {
    const guard = await enforceAdminGuard(req);
    if (!guard.authorized) {
      return NextResponse.json({ success: false, error: guard.error }, { status: 403 });
    }

    const cluster = loadDatabaseClusterConfig();
    const config = loadAdminBackendConfig();
    const telemetry = getControlPlaneTelemetry();

    return NextResponse.json({
      success: true,
      cluster,
      config,
      telemetry,
    });
  },
});

export const POST = createSecureRoute({
  id: 'api-admin-backend-post',
  method: 'POST',
  auth: { required: true, role: 'admin' },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 256 * 1024, maxExecutionMs: 20000 },
  handler: async (req, { body, ip }) => {
    const guard = await enforceAdminGuard(req);
    if (!guard.authorized) {
      return NextResponse.json({ success: false, error: guard.error }, { status: 403 });
    }

    const payload = body || {};

    // 1. Sync Redundancy Clones
    if (payload.action === 'sync_redundancy') {
      const syncResult = await syncRedundantDatabases(guard.session?.userId || 'admin');
      const cluster = loadDatabaseClusterConfig();
      return NextResponse.json({
        success: syncResult.success,
        cluster,
        syncResult,
        message: syncResult.message,
      });
    }

    // Provision Table on target database
    if (payload.action === 'provision_table') {
      if (payload.engine === 'neon') {
        const result = await autoProvisionNeonTable(payload.connectionString, payload.tableName);
        logAdminEvent({
          actor_user_id: guard.session?.userId || 'admin',
          action: result.success ? 'DATABASE_PROVISION_SUCCESS' : 'DATABASE_PROVISION_FAILED',
          target_type: 'database_table',
          target_id: payload.tableName || 'ultrst-users',
          ip_address: ip,
          details: `Auto-provisioned table [${payload.tableName || 'ultrst-users'}] on Neon: ${result.message}`,
        });
        return NextResponse.json({
          success: result.success,
          message: result.message,
        });
      }
      return NextResponse.json({
        success: false,
        error: `Auto-provisioning not supported for engine [${payload.engine}]`,
      }, { status: 400 });
    }

    // 2. Test Individual Database Connection Entry
    if (payload.action === 'test_entry' && payload.entry) {
      const result = await testDatabaseEntryConnection(payload.entry as DatabaseConnectionEntry);
      logAdminEvent({
        actor_user_id: guard.session?.userId || 'admin',
        action: result.success ? 'DATABASE_TEST_SUCCESS' : 'DATABASE_TEST_FAILED',
        target_type: 'database_entry',
        target_id: payload.entry?.id,
        ip_address: ip,
        details: `[${payload.entry?.name || payload.entry?.engine}] Connection probe ${result.success ? 'PASSED' : 'FAILED'}: ${result.message}${result.latencyMs !== undefined ? ` (${result.latencyMs}ms)` : ''}`,
      });
      return NextResponse.json({
        success: result.success,
        message: result.message,
        latencyMs: result.latencyMs,
      });
    }

    // 3. Test Entire Cluster
    if (payload.action === 'test_cluster') {
      const cluster = loadDatabaseClusterConfig();
      const results = await Promise.all(
        cluster.databases.map(async (db) => {
          const res = await testDatabaseEntryConnection(db);
          db.lastTestedAt = new Date().toISOString();
          db.status = res.success ? 'connected' : 'error';
          db.latencyMs = res.latencyMs;
          return { id: db.id, name: db.name, ...res };
        })
      );
      saveDatabaseClusterConfig(cluster);
      logAdminEvent({
        actor_user_id: guard.session?.userId || 'admin',
        action: 'DATABASE_CLUSTER_TEST',
        target_type: 'cluster',
        ip_address: ip,
        details: `Tested ${results.length} cluster database connections. Results: ${results.map((r) => `[${r.name}]: ${r.success ? `${r.latencyMs}ms` : 'FAIL'}`).join(', ')}`,
      });
      return NextResponse.json({
        success: true,
        cluster,
        results,
        message: `Tested ${results.length} database connections in cluster.`,
      });
    }

    // Fallback: Legacy Single Engine Test
    const result = await testAdminBackendConnection(payload as AdminBackendConfig);
    logAdminEvent({
      actor_user_id: guard.session?.userId || 'admin',
      action: result.success ? 'DATABASE_TEST_SUCCESS' : 'DATABASE_TEST_FAILED',
      target_type: 'backend_engine',
      target_id: payload.engine,
      ip_address: ip,
      details: `[${payload.engine || 'storage'}] Connection test ${result.success ? 'PASSED' : 'FAILED'}: ${result.message}${result.latencyMs !== undefined ? ` (${result.latencyMs}ms)` : ''}`,
    });
    return NextResponse.json({
      success: result.success,
      message: result.message,
      latencyMs: result.latencyMs,
      engine: result.engine,
    });
  },
});

export const PUT = createSecureRoute({
  id: 'api-admin-backend-put',
  method: 'PUT',
  auth: { required: true, role: 'admin' },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 256 * 1024, maxExecutionMs: 20000 },
  handler: async (req, { body }) => {
    const guard = await enforceAdminGuard(req);
    if (!guard.authorized) {
      return NextResponse.json({ success: false, error: guard.error }, { status: 403 });
    }

    const payload = body || {};

    // 1. Save Cluster Configuration
    if (payload.action === 'save_cluster' && payload.cluster) {
      const saved = saveDatabaseClusterConfig(payload.cluster);
      return NextResponse.json({
        success: true,
        cluster: saved,
        message: 'Database redundancy cluster configuration saved.',
      });
    }

    // 2. Add New Database Connection Entry
    if (payload.action === 'add_database' && payload.entry) {
      const added = addDatabaseConnection(payload.entry);
      const cluster = loadDatabaseClusterConfig();
      return NextResponse.json({
        success: true,
        added,
        cluster,
        message: `Database [${added.name}] added to redundancy cluster.`,
      });
    }

    // 3. Update Existing Database Entry
    if (payload.action === 'update_database' && payload.id && payload.updates) {
      const updated = updateDatabaseConnection(payload.id, payload.updates);
      const cluster = loadDatabaseClusterConfig();
      return NextResponse.json({
        success: true,
        updated,
        cluster,
        message: `Database [${updated.name}] updated.`,
      });
    }

    // Fallback: Legacy Single Config Save
    const saved = saveAdminBackendConfig(payload as AdminBackendConfig);
    return NextResponse.json({
      success: true,
      config: saved,
      message: 'Admin Control Plane backend configuration updated successfully.',
    });
  },
});

export const DELETE = createSecureRoute({
  id: 'api-admin-backend-delete',
  method: 'DELETE',
  auth: { required: true, role: 'admin' },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  handler: async (req, { query }) => {
    const guard = await enforceAdminGuard(req);
    if (!guard.authorized) {
      return NextResponse.json({ success: false, error: guard.error }, { status: 403 });
    }

    const id = query.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Database ID is required for deletion' }, { status: 400 });
    }

    deleteDatabaseConnection(id);
    const cluster = loadDatabaseClusterConfig();
    return NextResponse.json({
      success: true,
      cluster,
      message: `Database entry [${id}] removed from cluster.`,
    });
  },
});
