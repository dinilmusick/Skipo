import {describe,expect,it} from 'vitest';
import {createSkipoSemanticRuntime} from '../src/backend/semantic/SkipoSemanticRuntime.js';

describe('Skipo semantic runtime',()=>{
  it('derives endpoint capabilities from service contracts',()=>{
    const runtime=createSkipoSemanticRuntime({applicationId:'test-app'});
    runtime.registerService('orders',{
      definition:{operations:{
        get:{name:'Get order',inputSchema:{type:'object',properties:{orderId:{type:'string'} }},outputSchema:{type:'object'}}
      }}
    });
    expect(runtime.capabilities.get('orders.get')?.inputSchema?.properties?.orderId).toBeDefined();
    expect(runtime.manifest().agents[0].role).toBe('application');
  });

  it('creates resumable semantic tasks',()=>{
    const runtime=createSkipoSemanticRuntime({applicationId:'test-app'});
    const task=runtime.createTask('create an invoice');
    runtime.tasks.transition(task.id,'input-required');
    expect(runtime.tasks.get(task.id)?.status).toBe('waiting-for-user');
  });
});
