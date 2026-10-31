import React,{useEffect,useMemo,useRef,useState} from 'react';

export interface AikoDirectChatAgent{id:string;name:string;description?:string;}
export interface AikoDirectChatRuntime{listAgents():Promise<AikoDirectChatAgent[]>;executeAgent(agentId:string,input:string):Promise<unknown>;}
export interface AikoDirectChatProps{runtime:AikoDirectChatRuntime;workspaceId:string;}
interface Message{id:string;role:'user'|'assistant'|'system';content:string;}

function mention(input:string,agents:AikoDirectChatAgent[]){
  const match=input.match(/^\s*@([^\s]+)\s*([\s\S]*)$/);if(!match)return {query:input.trim()};
  const token=match[1].toLowerCase();
  return {agent:agents.find(a=>a.id.toLowerCase()===token||a.name.toLowerCase().replace(/\s+/g,'-')===token),query:match[2].trim()};
}

export function AikoDirectChat({runtime,workspaceId}:AikoDirectChatProps){
  const [open,setOpen]=useState(false),[agents,setAgents]=useState<AikoDirectChatAgent[]>([]),[input,setInput]=useState(''),[messages,setMessages]=useState<Message[]>([]),[busy,setBusy]=useState(false),[suggestions,setSuggestions]=useState(false);
  const inputRef=useRef<HTMLTextAreaElement>(null);
  useEffect(()=>{let active=true;void runtime.listAgents().then(value=>active&&setAgents(value)).catch(()=>active&&setAgents([]));return()=>{active=false};},[runtime,workspaceId]);
  const filtered=useMemo(()=>{const q=input.match(/(?:^|\s)@([^\s]*)$/)?.[1]?.toLowerCase()??'';return agents.filter(a=>a.name.toLowerCase().includes(q)||a.id.toLowerCase().includes(q)).slice(0,8)},[agents,input]);
  const send=async()=>{const text=input.trim();if(!text||busy)return;const resolved=mention(text,agents);if(!resolved.agent){setMessages(m=>[...m,{id:crypto.randomUUID(),role:'system',content:'Select an Aiko agent with @AgentName before sending.'}]);return;}if(!resolved.query)return;setInput('');setSuggestions(false);setMessages(m=>[...m,{id:crypto.randomUUID(),role:'user',content:text}]);setBusy(true);try{const result=await runtime.executeAgent(resolved.agent.id,resolved.query);setMessages(m=>[...m,{id:crypto.randomUUID(),role:'assistant',content:typeof result==='string'?result:JSON.stringify(result,null,2)}]);}catch(error){setMessages(m=>[...m,{id:crypto.randomUUID(),role:'system',content:error instanceof Error?error.message:String(error)}]);}finally{setBusy(false);}};
  return <>
    <button type="button" data-skipo-aiko-chat-trigger="true" aria-label={open?'Close Aiko Direct Chat':'Open Aiko Direct Chat'} onClick={()=>setOpen(v=>!v)} style={{position:'fixed',right:20,bottom:20,zIndex:10000}}>{open?'×':'Aiko'}</button>
    {open&&<section role="dialog" aria-label="Aiko Direct Chat" data-skipo-aiko-direct-chat="true" style={{position:'fixed',right:20,bottom:72,zIndex:9999,width:'min(520px,calc(100vw - 32px))',height:'min(680px,calc(100vh - 96px))',display:'flex',flexDirection:'column',background:'var(--skipo-surface,#111)',color:'var(--skipo-text,#fff)',border:'1px solid var(--skipo-border,#333)',borderRadius:10,overflow:'hidden'}}>
      <header style={{padding:12,borderBottom:'1px solid var(--skipo-border,#333)'}}><strong>Aiko Direct Chat</strong><div style={{fontSize:12,opacity:.7}}>Ask the application agent directly, or mention @AgentName</div></header>
      <div style={{flex:1,overflow:'auto',padding:12}}>{messages.map(m=><div key={m.id} style={{marginBottom:10,whiteSpace:'pre-wrap'}}><strong>{m.role}: </strong>{m.content}</div>)}{busy&&<div aria-live="polite">Aiko is executing…</div>}</div>
      <div style={{position:'relative',padding:12,borderTop:'1px solid var(--skipo-border,#333)'}}>
        {suggestions&&filtered.length>0&&<div role="listbox" style={{position:'absolute',left:12,right:12,bottom:76,border:'1px solid var(--skipo-border,#333)',background:'var(--skipo-surface,#111)',maxHeight:220,overflow:'auto'}}>{filtered.map(a=><button key={a.id} type="button" role="option" onClick={()=>{setInput('@'+a.name.replace(/\s+/g,'-')+' ');setSuggestions(false);inputRef.current?.focus();}} style={{display:'block',width:'100%',textAlign:'left',padding:8}}><strong>@{a.name}</strong>{a.description?` — ${a.description}`:''}</button>)}</div>}
        <textarea ref={inputRef} value={input} onChange={e=>{setInput(e.target.value);setSuggestions(/(?:^|\s)@[^\s]*$/.test(e.target.value));}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();}}} placeholder="@AgentName ask the agent to do something…" disabled={busy} rows={3} style={{width:'100%',resize:'vertical'}}/>
        <button type="button" onClick={()=>void send()} disabled={busy||!input.trim()} style={{marginTop:8}}>{busy?'Executing…':'Send'}</button>
      </div>
    </section>}
  </>;
}
export default AikoDirectChat;