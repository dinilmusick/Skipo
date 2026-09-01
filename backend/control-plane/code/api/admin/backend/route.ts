import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

export async function GET(req: NextRequest) {
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
}

export async function POST(req: NextRequest) {
  const guard = await enforceAdminGuard(req);
  if (!guard.authorized) {
    return NextResponse.json({ success: false, error: guard.error }, { status: 403 });
  }

  try {
    const body = await req.json();

    // 1. Sync Redundancy Clones
    if (body.action === 'sync_redundancy') {
      const syncResult = await syncRedundantDatabases(guard.session?.userId || 'admin');
      const cluster = loadDatabaseClusterConfig();
      return NextResponse.json({
        success: syncResult.success,
        cluster,
        syncResult,
        message: syncResult.message,
      });
    }

    // Provision Table on target database (e.g. Neon)
    if (body.action === 'provision_table') {
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
      if (body.engine === 'neon') {
        const result = await autoProvisionNeonTable(body.connectionString, body.tableName);
        logAdminEvent({
          actor_user_id: guard.session?.userId || 'admin',
          action: result.success ? 'DATABASE_PROVISION_SUCCESS' : 'DATABASE_PROVISION_FAILED',
          target_type: 'database_table',
          target_id: body.tableName || 'ultrst-users',
          ip_address: clientIp,
          details: `Auto-provisioned table [${body.tableName || 'ultrst-users'}] on Neon: ${result.message}`,
        });
        return NextResponse.json({
          success: result.success,
          message: result.message,
        });
      }
      return NextResponse.json({
        success: false,
        error: `Auto-provisioning not supported for engine [${body.engine}]`,
      }, { status: 400 });
    }

    // 2. Test Individual Database Connection Entry
    if (body.action === 'test_entry' && body.entry) {
      const result = await testDatabaseEntryConnection(body.entry as DatabaseConnectionEntry);
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
      logAdminEvent({
        actor_user_id: guard.session?.userId || 'admin',
        action: result.success ? 'DATABASE_TEST_SUCCESS' : 'DATABASE_TEST_FAILED',
        target_type: 'database_entry',
        target_id: body.entry?.id,
        ip_address: clientIp,
        details: `[${body.entry?.name || body.entry?.engine}] Connection probe ${result.success ? 'PASSED' : 'FAILED'}: ${result.message}${result.latencyMs !== undefined ? ` (${result.latencyMs}ms)` : ''}`,
      });
      return NextResponse.json({
        success: result.success,
        message: result.message,
        latencyMs: result.latencyMs,
      });
    }

    // 3. Test Entire Cluster
    if (body.action === 'test_cluster') {
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
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
        ip_address: clientIp,
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
    const result = await testAdminBackendConnection(body as AdminBackendConfig);
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    logAdminEvent({
      actor_user_id: guard.session?.userId || 'admin',
      action: result.success ? 'DATABASE_TEST_SUCCESS' : 'DATABASE_TEST_FAILED',
      target_type: 'backend_engine',
      target_id: body.engine,
      ip_address: clientIp,
      details: `[${body.engine || 'storage'}] Connection test ${result.success ? 'PASSED' : 'FAILED'}: ${result.message}${result.latencyMs !== undefined ? ` (${result.latencyMs}ms)` : ''}`,
    });
    return NextResponse.json({
      success: result.success,
      message: result.message,
      latencyMs: result.latencyMs,
      engine: result.engine,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Admin backend test failed',
    }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const guard = await enforceAdminGuard(req);
  if (!guard.authorized) {
    return NextResponse.json({ success: false, error: guard.error }, { status: 403 });
  }

  try {
    const body = await req.json();

    // 1. Save Cluster Configuration
    if (body.action === 'save_cluster' && body.cluster) {
      const saved = saveDatabaseClusterConfig(body.cluster);
      return NextResponse.json({
        success: true,
        cluster: saved,
        message: 'Database redundancy cluster configuration saved.',
      });
    }

    // 2. Add New Database Connection Entry
    if (body.action === 'add_database' && body.entry) {
      const added = addDatabaseConnection(body.entry);
      const cluster = loadDatabaseClusterConfig();
      return NextResponse.json({
        success: true,
        added,
        cluster,
        message: `Database [${added.name}] added to redundancy cluster.`,
      });
    }

    // 3. Update Existing Database Entry
    if (body.action === 'update_database' && body.id && body.updates) {
      const updated = updateDatabaseConnection(body.id, body.updates);
      const cluster = loadDatabaseClusterConfig();
      return NextResponse.json({
        success: true,
        updated,
        cluster,
        message: `Database [${updated.name}] updated.`,
      });
    }

    // Fallback: Legacy Single Config Save
    const saved = saveAdminBackendConfig(body as AdminBackendConfig);
    return NextResponse.json({
      success: true,
      config: saved,
      message: 'Admin Control Plane backend configuration updated successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to update admin backend config',
    }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await enforceAdminGuard(req);
  if (!guard.authorized) {
    return NextResponse.json({ success: false, error: guard.error }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
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
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to delete database entry',
    }, { status: 400 });
  }
}
