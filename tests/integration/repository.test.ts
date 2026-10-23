import { describe, expect, it } from 'vitest';
import { mapEntry, mapMessage } from '../../src/lib/repository';
const id='00000000-0000-4000-8000-000000000001';
describe('database contract boundary',()=>{
  it('maps server rows without exposing owner or processing metadata',()=>{
    const row={id,user_id:'private-owner',kind:'meal',original_note:'rice',note:'rice',details:[],pending_question:null,analysis_status:'idle',logged:false,version:1,created_at:'2026-10-22T00:00:00Z',updated_at:'2026-10-22T00:00:00Z',analysis_request_id:null};
    expect(mapEntry(row)).toEqual({id,kind:'meal',originalNote:'rice',note:'rice',details:[],pendingQuestion:null,analysisStatus:'idle',logged:false,version:1,createdAt:row.created_at,updatedAt:row.updated_at});
  });
  it('rejects invalid persisted details rather than rendering arbitrary shapes',()=>{
    expect(()=>mapEntry({id,kind:'photo',details:[]})).toThrow();
  });
  it('keeps ordered chat fields and rejects unsupported roles',()=>{
    expect(mapMessage({id,entry_id:id,role:'user',content:'half a cup',sequence:2,created_at:'now'}).entryId).toBe(id);
    expect(()=>mapMessage({id,entry_id:id,role:'system',content:'x',sequence:1,created_at:'now'})).toThrow();
  });
});
