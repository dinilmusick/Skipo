import type {Task,TaskStore} from '@ultrst-armada/kloks/semantic-runtime';
import {workingWorkspaceService} from '@ultrst-armada/kloks/backend';

export interface SemanticConversationMessage{id:string;role:'user'|'agent'|'system';content:string;taskId?:string;createdAt:string;}
export interface SemanticConversationStore{append(sessionId:string,message:SemanticConversationMessage):Promise<void>|void;list(sessionId:string):Promise<SemanticConversationMessage[]>|SemanticConversationMessage[];}

function safe(value:string){return value.replace(/[^a-zA-Z0-9._-]/g,'_');}
function decode(value:string|Uint8Array){return typeof value==='string'?value:Buffer.from(value).toString('utf8');}

export class WorkspaceSemanticTaskStore implements TaskStore{
  private readonly items=new Map<string,Task>();
  constructor(private readonly workspaceId:string,private readonly workspace:any=workingWorkspaceService,private readonly root='SEMANTIC/tasks'){}
  async hydrate(){try{for(const entry of await this.workspace.listFiles(this.workspaceId,this.root)){if(entry.isFolder||!entry.name.endsWith('.json'))continue;try{const task=JSON.parse(decode(await this.workspace.readFile(this.workspaceId,entry.path))) as Task;this.items.set(task.id,task);}catch{}}}catch{};return this.list();}
  get(id:string){return this.items.get(id);}
  set(task:Task){this.items.set(task.id,task);void this.workspace.writeFile(this.workspaceId,`${this.root}/${safe(task.id)}.json`,JSON.stringify(task,null,2));}
  list(){return [...this.items.values()];}
}

export class WorkspaceSemanticConversationStore implements SemanticConversationStore{
  constructor(private readonly workspaceId:string,private readonly workspace:any=workingWorkspaceService,private readonly root='SEMANTIC/conversations'){}
  async append(sessionId:string,message:SemanticConversationMessage){const current=await this.list(sessionId);current.push(message);await this.workspace.writeFile(this.workspaceId,`${this.root}/${safe(sessionId)}.json`,JSON.stringify(current,null,2));}
  async list(sessionId:string):Promise<SemanticConversationMessage[]>{try{return JSON.parse(decode(await this.workspace.readFile(this.workspaceId,`${this.root}/${safe(sessionId)}.json`))) as SemanticConversationMessage[];}catch{return [];}}
}