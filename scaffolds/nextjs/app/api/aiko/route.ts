import {NextRequest,NextResponse} from 'next/server';
import {createAikoRuntime} from '@/src/backend/AppBackend';

export async function POST(request:NextRequest){
  const body=await request.json();
  const workspaceId=String(body.workspaceId||'default');
  const runtime=createAikoRuntime(workspaceId);
  try{
    switch(String(body.action)){
      case 'listAgents': return NextResponse.json(await runtime.listAgents());
      case 'executeAgent': return NextResponse.json(await runtime.executeAgent(String(body.agentId),body.query));
      case 'listKeys': return NextResponse.json(await runtime.listKeys());
      case 'getActiveKey': return NextResponse.json(await runtime.getActiveKey(String(body.providerId)));
      case 'rotateKey': return NextResponse.json(await runtime.rotateKey(String(body.providerId)));
      case 'addKey': return NextResponse.json(await runtime.addKey(body.input));
      case 'syncFromAikoEngine': return NextResponse.json(await runtime.syncFromAikoEngine());
      case 'listCapabilities': return NextResponse.json(await runtime.listCapabilities());
      case 'createCustomAgent': return NextResponse.json(await runtime.createCustomAgent(String(body.name),body.capabilityIds||[],body.specId));
      default: return NextResponse.json({error:'Unsupported Aiko action'},{status:400});
    }
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:String(error)},{status:500});}
}
