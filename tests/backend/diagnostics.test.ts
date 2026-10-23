import { describe, expect, it, vi } from 'vitest';
import { createFitnessHandler, type Repository } from '../../supabase/functions/_shared/server/handler';

const id='11111111-1111-4111-8111-111111111111';
const request=()=>new Request('https://edge.example/fitness',{method:'POST',headers:{Authorization:'Bearer synthetic','Content-Type':'application/json'},body:JSON.stringify({entryId:id,requestId:id,expectedVersion:1})});
function setup() {
  const entry={id,kind:'meal',note:'rice',details:[],pending_question:null,version:1};
  const repository:Repository={claim:async()=>({claimed:true,entry}),history:async()=>[{role:'user',content:'rice'}],apply:async()=>entry,fail:vi.fn(async()=>undefined)};
  const reportFailure=vi.fn();
  const result={details:[{type:'food',name:'rice',amount:''}],question:null,reply:'Saved.'};
  return {repository,reportFailure,result};
}
describe('sanitized analysis failure diagnostics',()=>{
  it('reports only bounded provider metadata and the failing phase',async()=>{
    const {repository,reportFailure}=setup();
    const agent=async()=>{throw Object.assign(new Error('PRIVATE NOTE and sk-secret-key'),{status:400,code:'invalid_json_schema',body:'PRIVATE HISTORY'});};
    const response=await createFitnessHandler({authenticate:async()=>({id}),repository:()=>repository,agent,reportFailure})(request());
    const diagnostic={phase:'agent',category:'provider',providerCode:'invalid_json_schema',status:400};
    expect(await response.json()).toEqual({error:'analysis_failed',diagnostic});
    expect(reportFailure).toHaveBeenCalledExactlyOnceWith(diagnostic);
    expect(repository.fail).toHaveBeenCalledOnce();
  });
  it('never echoes unknown provider code, error body, message, note or key',async()=>{
    const {repository,reportFailure}=setup();
    const agent=async()=>{throw {status:429,code:'sk-private-secret',message:'PRIVATE NOTE',error:{message:'PRIVATE HISTORY'}};};
    const response=await createFitnessHandler({authenticate:async()=>({id}),repository:()=>repository,agent,reportFailure})(request());
    expect(await response.json()).toEqual({error:'analysis_failed',diagnostic:{phase:'agent',category:'provider',status:429}});
    expect(JSON.stringify(reportFailure.mock.calls)).not.toMatch(/PRIVATE|sk-private/);
  });
  it.each(['schema','validation','apply'] as const)('distinguishes %s failures without exposing content',async(phase)=>{
    const {repository,reportFailure,result}=setup();
    if(phase==='apply')repository.apply=async()=>{throw {code:'23514',message:'PRIVATE NOTE'};};
    const agent=async()=>phase==='schema'?{details:'PRIVATE NOTE'}:phase==='validation'?{...result,details:[{type:'food',name:'invented',amount:''}]}:result;
    const response=await createFitnessHandler({authenticate:async()=>({id}),repository:()=>repository,agent,reportFailure})(request());
    const diagnostic={phase,category:phase==='apply'?'database':phase,...(phase==='apply'?{providerCode:'23514'}:{})};
    expect(await response.json()).toEqual({error:'analysis_failed',diagnostic});
    expect(reportFailure).toHaveBeenCalledExactlyOnceWith(diagnostic);
  });
  it('identifies a bounded agent timeout even if the injected agent never returns',async()=>{
    const {repository,reportFailure}=setup();
    const response=await createFitnessHandler({authenticate:async()=>({id}),repository:()=>repository,agent:()=>new Promise(()=>{}),reportFailure,timeoutMs:5})(request());
    expect(await response.json()).toEqual({error:'analysis_failed',diagnostic:{phase:'agent',category:'timeout'}});
  });
  it('does not let a failing reporter prevent the safe response',async()=>{
    const {repository}=setup();
    const response=await createFitnessHandler({authenticate:async()=>({id}),repository:()=>repository,agent:async()=>{throw new Error('PRIVATE');},reportFailure:()=>{throw new Error('report unavailable');}})(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({error:'analysis_failed',diagnostic:{phase:'agent',category:'unknown'}});
  });
});
