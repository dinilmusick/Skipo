'use client';
import {useEffect,useMemo,useState} from 'react';
import {FodModule,type FodRuntimeLike} from '@ultrst-armada/floks/canvas-ui/fod';
import type {FodNodeDefinition,FodFlow} from '@ultrst-armada/kloks/fod';

function runtime(workspaceId:string):FodRuntimeLike{
  const call=async(path:string,init?:RequestInit)=>{const response=await fetch(`/api/fod?workspaceId=${encodeURIComponent(workspaceId)}${path}`,{...init,headers:{'Content-Type':'application/json',...(init?.headers||{})}});if(!response.ok)throw new Error(await response.text());return response.json();};
  return {
    listFlows:()=>call('') as Promise<FodFlow[]>,
    getFlow:(id)=>call(`&flowId=${encodeURIComponent(id)}`) as Promise<FodFlow|null>,
    saveFlow:(flow)=>call('',{method:'POST',body:JSON.stringify({action:'save',flow})}) as Promise<FodFlow>,
    deleteFlow:(id)=>call('',{method:'POST',body:JSON.stringify({action:'delete',flowId:id})}) as Promise<boolean>,
    executeFlow:(id)=>call('',{method:'POST',body:JSON.stringify({action:'execute',flowId:id})})
  };
}

export default function FodTab({workspaceId='default'}:{workspaceId?:string}){
  const [nodes,setNodes]=useState<FodNodeDefinition[]>([]);
  useEffect(()=>{fetch(`/api/fod/nodes?workspaceId=${encodeURIComponent(workspaceId)}`).then(response=>response.json()).then(setNodes).catch(()=>setNodes([]));},[workspaceId]);
  const api=useMemo(()=>runtime(workspaceId),[workspaceId]);
  return <FodModule runtime={api} workspaceId={workspaceId} nodeDefinitions={nodes}/>;
}
