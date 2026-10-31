import {NextRequest,NextResponse} from 'next/server';
import {createAikoRuntime} from '@/src/backend/AppBackend';

export async function POST(request:NextRequest){
  try{
    const body=await request.json() as any;
    const runtime=createAikoRuntime(String(body.workspaceId||'default'));
    const result=await runtime.executeAgent('skipo-application-agent',String(body.message??body.input??''));
    return NextResponse.json(result);
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:String(error)},{status:500});}
}
