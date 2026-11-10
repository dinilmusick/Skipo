import { ModuleUIHost } from '../../components/module-ui/ModuleUIHost.js';
'use client';
import {useState} from 'react';
import FodTab from './tabs/fod/page.js';
import AikoTab from './tabs/aiko/page.js';

export function MainPage(){
  const [tab,setTab]=useState<'fod'|'aiko'|'settings'>('fod');
  const workspaceId=typeof window==='undefined'?'default':localStorage.getItem('skipo-active-workspace')||'default';
  return <div data-skipo-main-page='true' style={{height:'100vh',display:'flex',flexDirection:'column'}}>
    <header style={{height:48,display:'flex',gap:8,alignItems:'center',padding:'0 12px'}}> 
      <button type='button' onClick={()=>setTab('fod')}>FOD</button>
      <button type='button' onClick={()=>setTab('aiko')}>Aiko</button>
      <button type='button' onClick={()=>setTab('settings')}>Settings</button>
    </header>
    <main style={{flex:1,minHeight:0}}>{tab==='fod'?<FodTab workspaceId={workspaceId}/>:tab==='aiko'?<AikoTab workspaceId={workspaceId}/>:<div>Settings</div>}</main>
    <ModuleUIHost />
  </div>;
}
export default MainPage;
