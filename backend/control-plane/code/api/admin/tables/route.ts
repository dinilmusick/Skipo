import { NextRequest, NextResponse } from 'next/server';
import { enforceAdminGuard } from '@/lib/control-plane';
import { getRegisteredFunctionalityTables } from '@/lib/workspace-data-plane';
import { getFunctionalityTable } from '@/lib/functionality-table';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const guard = await enforceAdminGuard(req);
  if (!guard.authorized) {
    return NextResponse.json({ success: false, error: guard.error }, { status: 403 });
  }

  const tables = getRegisteredFunctionalityTables();
  return NextResponse.json({
    success: true,
    tables,
    rule: '∀ f ∈ Functionality: ∃! T_f s.t. T_f = Table(name := f.id)',
    invariants: {
      schemaMigrations: 'AutoEnsureOnWrite',
      modeSwitchingCodeDelta: 0,
      atomicCrudEngine: true,
    },
  });
}

export async function POST(req: NextRequest) {
  const guard = await enforceAdminGuard(req);
  if (!guard.authorized) {
    return NextResponse.json({ success: false, error: guard.error }, { status: 403 });
  }

  try {
    const { tableName, action, item, query: queryParam } = await req.json();
    if (!tableName) {
      return NextResponse.json({ success: false, error: 'tableName is required' }, { status: 400 });
    }

    const table = getFunctionalityTable(tableName);

    switch (action) {
      case 'count': {
        const count = await table.count(queryParam);
        return NextResponse.json({ success: true, count });
      }
      case 'find': {
        const records = await table.find(queryParam);
        return NextResponse.json({ success: true, records, count: records.length });
      }
      case 'insert': {
        const inserted = await table.insert(item);
        return NextResponse.json({ success: true, item: inserted });
      }
      case 'clear': {
        await table.clear();
        return NextResponse.json({ success: true, message: `Table [${tableName}] cleared.` });
      }
      default:
        return NextResponse.json({ success: false, error: `Unsupported action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
