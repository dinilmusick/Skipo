import {NextRequest,NextResponse} from 'next/server';
import {createFodRuntime} from '@/src/backend/AppBackend';

export async function GET(request:NextRequest){
  const workspaceId=request.nextUrl.searchParams.get('workspaceId')||'default';
  const flowId=request.nextUrl.searchParams.get('flowId');
  const runtime=createFodRuntime(workspaceId);
  if(flowId)return NextResponse.json(await runtime.getFlow(flowId));
  return NextResponse.json(await runtime.listFlows());
}
export async function POST(request:NextRequest){
  const workspaceId=request.nextUrl.searchParams.get('workspaceId')||'default';
  const body=await request.json();
  const runtime=createFodRuntime(workspaceId);
  if(body.action==='save')return NextResponse.json(await runtime.saveFlow(body.flow));
  if(body.action==='delete')return NextResponse.json(await runtime.deleteFlow(String(body.flowId)));
  if(body.action==='execute')return NextResponse.json(await runtime.executeFlow(String(body.flowId)));
  return NextResponse.json({error:'Unsupported FOD action'},{status:400});
}
