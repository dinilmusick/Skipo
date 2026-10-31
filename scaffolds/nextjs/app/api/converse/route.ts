import {NextRequest,NextResponse} from 'next/server';
import {createAikoRuntime} from '@/src/backend/AppBackend';

export async function POST(request:NextRequest){
  let body:any;
  try{
    body=await request.json();
  }catch{
    return NextResponse.json({error:'Invalid JSON body'},{status:400});
  }
  const text=typeof body?.message==='string'?body.message:typeof body?.input==='string'?body.input:'';
  if(!text.trim())return NextResponse.json({error:'Message or input is required'},{status:400});
  try{
    const runtime=createAikoRuntime(String(body.workspaceId||'default'));
    const result=await runtime.executeAgent('skipo-application-agent',text.trim());
    const payload = typeof result === 'object' && result !== null && 'status' in result ? result : { status: 'completed', result };
    return NextResponse.json(payload);
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:String(error)},{status:500});}
}
