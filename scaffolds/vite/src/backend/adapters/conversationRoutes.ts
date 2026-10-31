import {createAikoRuntime} from '../AppBackend';

export async function handleConversationRoutes(request:Request):Promise<Response|null>{
  const url=new URL(request.url);
  if(url.pathname!=='/api/converse')return null;
  if(request.method!=='POST')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:{'Content-Type':'application/json'}});
  try{
    const body=await request.json() as any;
    const runtime=createAikoRuntime(String(body.workspaceId||'default'));
    const result=await runtime.executeAgent('skipo-application-agent',String(body.message??body.input??''));
    return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}});
  }catch(error){return new Response(JSON.stringify({error:error instanceof Error?error.message:String(error)}),{status:500,headers:{'Content-Type':'application/json'}});}
}
