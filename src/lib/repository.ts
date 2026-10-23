import type { SupabaseClient } from '@supabase/supabase-js';
import { EntrySchema, MessageSchema, type Entry, type Message, type Kind } from '@domain/contracts';
export function mapEntry(value:unknown):Entry {
  const r=value as Record<string,unknown>;
  return EntrySchema.parse({id:r.id,kind:r.kind,originalNote:r.original_note,note:r.note,details:r.details,pendingQuestion:r.pending_question,analysisStatus:r.analysis_status,logged:r.logged,version:r.version,createdAt:r.created_at,updatedAt:r.updated_at});
}
export function mapMessage(value:unknown):Message {
  const r=value as Record<string,unknown>;
  return MessageSchema.parse({id:r.id,entryId:r.entry_id,role:r.role,content:r.content,sequence:r.sequence,createdAt:r.created_at});
}
function databaseError(error:{message?:string;code?:string}|null):void {
  if(!error)return;
  if(error.message?.includes('conflict')||(error.code==='40001'||error.code==='PT409'))throw new Error('This entry changed. Reload it before saving; your draft is still here.');
  if(error.code==='42501')throw new Error('You do not have access to this entry. Sign in again.');
  throw new Error(error.message?.includes('version')?'This entry changed. Reload it before saving.':'Could not save your entry. Your draft is still here. Please try again.');
}
export type SavedConversation={entry:Entry;messages:Message[]};
export function createRepository(client:SupabaseClient){
  async function mutation(name:string,args:Record<string,unknown>):Promise<Entry>{
    const {data,error}=await client.rpc(name,args);databaseError(error);
    const row=Array.isArray(data)?data[0]:data;
    if(!row)throw new Error('This entry changed or is unavailable. Reload before saving.');
    return mapEntry(row);
  }
  return {
    async list():Promise<Entry[]>{const{data,error}=await client.from('fitness_entries').select('*').order('updated_at',{ascending:false});databaseError(error);return(data??[]).map(mapEntry);},
    async load(id:string):Promise<SavedConversation>{
      const [e,m]=await Promise.all([client.from('fitness_entries').select('*').eq('id',id).single(),client.from('fitness_messages').select('*').eq('entry_id',id).order('sequence',{ascending:true})]);
      databaseError(e.error);databaseError(m.error);return{entry:mapEntry(e.data),messages:(m.data??[]).map(mapMessage)};
    },
    create(id:string,kind:Kind,note:string,messageId:string){return mutation('fitness_create_capture',{p_id:id,p_kind:kind,p_note:note,p_message_id:messageId});},
    reply(entry:Entry,messageId:string,content:string){return mutation('fitness_append_reply',{p_entry_id:entry.id,p_message_id:messageId,p_content:content,p_expected_version:entry.version});},
    save(entry:Entry,patch:Record<string,unknown>){return mutation('fitness_save_entry',{p_entry_id:entry.id,p_expected_version:entry.version,p_patch:patch});},
  };
}
export type EntryRepository=ReturnType<typeof createRepository>;
