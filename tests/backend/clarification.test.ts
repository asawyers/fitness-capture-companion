import { describe, expect, it, vi } from 'vitest';
import { createFitnessHandler, type Repository } from '../../supabase/functions/_shared/server/handler';
import type { AnalysisResult, Detail } from '../../supabase/functions/_shared/domain/contracts';

const id='11111111-1111-4111-8111-111111111111';
async function analyze(kind:'meal'|'workout',note:string,details:Detail[],question:AnalysisResult['question']=null) {
  const entry={id,kind,note,details:[],pending_question:null,version:1};
  const apply=vi.fn(async(_request,result:AnalysisResult)=>({...entry,details:result.details,pending_question:result.question}));
  const repository:Repository={claim:async()=>({claimed:true,entry}),history:async()=>[{role:'user',content:note}],apply,fail:async()=>undefined};
  const response=await createFitnessHandler({authenticate:async()=>({id}),repository:()=>repository,agent:async()=>({details,question,reply:'Model confirmation.'}),reportFailure:()=>undefined})(new Request('https://edge.example/fitness',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entryId:id,requestId:id,expectedVersion:1})}));
  return {response,apply};
}
describe('deterministic clarification fallback',()=>{
  it('asks for a named food amount when the model omitted a question',async()=>{
    const {response,apply}=await analyze('meal','two eggs and rice',[{type:'food',name:'eggs',amount:'two'},{type:'food',name:'rice',amount:''}]);
    expect(response.status).toBe(200);
    const result=apply.mock.calls[0][1];
    expect(result.details[1]).toEqual({type:'food',name:'rice',amount:''});
    expect(result.question).toEqual({itemIndex:1,field:'amount',text:'What amount did you record for rice?'});
    expect(result.reply).toBe(result.question?.text);
  });
  it('does not ask when all recorded fields are complete',async()=>{
    const {response,apply}=await analyze('meal','two eggs',[{type:'food',name:'eggs',amount:'two'}]);
    expect(response.status).toBe(200); expect(apply.mock.calls[0][1].question).toBeNull();
    expect(apply.mock.calls[0][1].reply).toBe('Saved the details you provided.');
  });
  it('does not invent a label for an unnamed item',async()=>{
    const {response,apply}=await analyze('meal','meal',[{type:'food',name:'',amount:''}]);
    expect(response.status).toBe(200); expect(apply.mock.calls[0][1].question).toBeNull();
  });
  it.each([
    ['squat',{type:'strength',exercise:'squat',sets:'',reps:'',weight:''},'sets'],
    ['run 20 minutes',{type:'cardio',activity:'run',duration:'20 minutes',distance:''},'distance'],
  ] as const)('asks one missing quantity for the named workout %s',async(note,detail,field)=>{
    const {response,apply}=await analyze('workout',note,[detail]);
    expect(response.status).toBe(200); expect(apply.mock.calls[0][1].question).toMatchObject({itemIndex:0,field});
  });
  it('keeps and validates the model question instead of replacing it',async()=>{
    const details:Detail[]=[{type:'food',name:'rice',amount:''},{type:'food',name:'beans',amount:''}];
    const {response,apply}=await analyze('meal','rice and beans',details,{itemIndex:1,field:'amount',text:'How much?'});
    expect(response.status).toBe(200); expect(apply.mock.calls[0][1].question).toMatchObject({itemIndex:1,field:'amount'});
    const invalid=await analyze('meal','rice and beans',details,{itemIndex:2,field:'amount',text:'How much?'});
    expect(invalid.response.status).toBe(502); expect(invalid.apply).not.toHaveBeenCalled();
  });
});
