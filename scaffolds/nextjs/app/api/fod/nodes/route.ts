import {NextRequest,NextResponse} from 'next/server';
import {createFodRuntime} from '@/src/backend/AppBackend';

export async function GET(request:NextRequest){
  const workspaceId=request.nextUrl.searchParams.get('workspaceId')||'default';
  const runtime=createFodRuntime(workspaceId);
  return NextResponse.json(runtime.getNodeDefinitions());
}
