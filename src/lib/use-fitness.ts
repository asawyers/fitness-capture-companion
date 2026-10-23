import { useCallback, useEffect, useRef, useState } from 'react';
import type { Detail, Entry, Kind } from '@domain/contracts';
import { configured, supabase } from './supabase';
import { createRepository, type SavedConversation } from './repository';
import { analyzeEntry } from './fitness-api';
const repo=supabase?createRepository(supabase):null;
type User={id:string;email:string};
const message=(error:unknown)=>error instanceof Error?error.message:'Could not complete that action. Your draft is still here.';

/** Coordinates private server state; UI components retain their own unsaved drafts. */
export function useFitness(){
  const [user,setUser]=useState<User|null>(null);
  const [authReady,setAuthReady]=useState(!configured);
  const [entries,setEntries]=useState<Entry[]>([]);
  const [selected,setSelected]=useState<SavedConversation|null>(null);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const epoch=useRef(0);
  const identity=useRef<string|null>(null);
  const active=useRef<SavedConversation|null>(null);
  const selection=useRef(0);
  const captures=useRef<{key:string;id:string;messageId:string}|null>(null);
  const replies=useRef<{key:string;id:string}|null>(null);
  const runs=useRef(new Set<string>());
  const pending=useRef(false);
  const listRevision=useRef(0);
  function show(value:SavedConversation|null){active.current=value;setSelected(value);}
  function upsert(value:Entry){listRevision.current++;setEntries(old=>{const existing=old.find(e=>e.id===value.id);if(existing&&existing.version>value.version)return old;return [value,...old.filter(e=>e.id!==value.id)].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));});}

  useEffect(()=>{
    if(!supabase)return;
    let mounted=true;let eventSeen=false;
    const update=(session:{user:{id:string;email?:string}}|null)=>{
      if(!mounted)return;
      const next=session?{id:session.user.id,email:session.user.email??''}:null;
      if(identity.current!==next?.id){
        epoch.current++;selection.current++;identity.current=next?.id??null;
        setEntries([]);show(null);captures.current=null;replies.current=null;setError('');setNotice('');setBusy(false);setLoading(false);pending.current=false;
      }
      setUser(next);setAuthReady(true);
    };
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{eventSeen=true;update(session);});
    void supabase.auth.getSession().then(({data,error:err})=>{
      if(!mounted||eventSeen)return;
      if(err)setError('Could not restore your session. Please sign in again.');
      update(data.session);
    });
    return()=>{mounted=false;subscription.unsubscribe();epoch.current++;};
  },[]);

  const refresh=useCallback(async()=>{
    if(!repo||!identity.current)return;
    const token=epoch.current;const revision=listRevision.current;setLoading(true);setError('');
    try{const values=await repo.list();if(token===epoch.current&&revision===listRevision.current)setEntries(values);}
    catch(e){if(token===epoch.current)setError(message(e));}
    finally{if(token===epoch.current)setLoading(false);}
  },[]);
  useEffect(()=>{if(user)void refresh();},[user?.id,refresh]);

  async function select(id:string){
    if(!repo||!user)return;
    const token=epoch.current;const ticket=++selection.current;setLoading(true);setError('');setNotice('');
    try{const result=await repo.load(id);if(token===epoch.current&&ticket===selection.current)show(result);}
    catch(e){if(token===epoch.current&&ticket===selection.current)setError(message(e));}
    finally{if(token===epoch.current&&ticket===selection.current)setLoading(false);}
  }
  async function processAnalysis(entry:Entry,token:number){
    if(!supabase||!repo||runs.current.has(entry.id)||!import.meta.env.VITE_FITNESS_API_URL)return;
    runs.current.add(entry.id);
    try{
      const result=await analyzeEntry(supabase,entry,crypto.randomUUID());
      if(token!==epoch.current)return;
      upsert(result);
      if(active.current?.entry.id===entry.id){const loaded=await repo.load(entry.id);if(token===epoch.current&&active.current?.entry.id===entry.id)show(loaded);}
      setNotice('Analysis saved. Any follow-up is optional.');
    }catch(e){if(token===epoch.current)setError(message(e));}
    finally{runs.current.delete(entry.id);}
  }
  async function mutate(action:()=>Promise<Entry>,success:string,selectResult=false):Promise<Entry|null>{
    if(pending.current||!repo||!user)return null;
    pending.current=true;setBusy(true);setError('');setNotice('');const token=epoch.current;const ticket=++selection.current;setLoading(false);
    try{
      const entry=await action();if(token!==epoch.current)return null;
      upsert(entry);
      if(selectResult||!active.current||active.current.entry.id===entry.id){
        try{const loaded=await repo.load(entry.id);if(token===epoch.current&&ticket===selection.current)show(loaded);}
        catch{if(token===epoch.current&&ticket===selection.current){show({entry,messages:active.current?.entry.id===entry.id?active.current.messages:[]});setError('Saved, but the conversation could not refresh. Reopen the entry to retry.');}}
      }
      if(token===epoch.current)setNotice(success);
      return entry;
    }catch(e){if(token===epoch.current)setError(message(e));return null;}
    finally{if(token===epoch.current){pending.current=false;setBusy(false);}}
  }
  async function capture(kind:Kind,note:string):Promise<boolean>{
    if(!repo)return false;
    const key=kind+'\0'+note;
    if(captures.current?.key!==key)captures.current={key,id:crypto.randomUUID(),messageId:crypto.randomUUID()};
    const request=captures.current;const token=epoch.current;
    const result=await mutate(()=>repo!.create(request.id,kind,note,request.messageId),'Saved. You can add details now or come back later.',true);
    if(!result)return false;
    captures.current=null;
    void processAnalysis(result,token);return true;
  }
  async function reply(content:string):Promise<boolean>{
    const current=active.current;if(!repo||!current)return false;
    const key=current.entry.id+'\0'+content;
    if(replies.current?.key!==key)replies.current={key,id:crypto.randomUUID()};
    const request=replies.current;const token=epoch.current;
    const result=await mutate(()=>repo!.reply(current.entry,request.id,content),'Reply saved.');
    if(!result)return false;
    replies.current=null;void processAnalysis(result,token);return true;
  }
  async function savePatch(patch:Record<string,unknown>,success:string){const current=active.current;if(!current||!repo)return false;return !!await mutate(()=>repo!.save(current.entry,patch),success);}
  async function authAction(action:()=>Promise<{error:{message:string}|null;data?:unknown}>){
    setError('');setNotice('');setBusy(true);
    try{const result=await action();if(result.error)throw new Error(result.error.message);}
    catch(e){setError(message(e));}
    finally{setBusy(false);}
  }
  async function signIn(email:string,password:string){if(supabase)await authAction(()=>supabase!.auth.signInWithPassword({email,password}));}
  async function signUp(email:string,password:string){if(!supabase)return;await authAction(async()=>{const result=await supabase!.auth.signUp({email,password});if(!result.error&&!result.data.session)setNotice('Check your email to confirm the account, then sign in.');return result;});}
  async function signOut(){if(supabase)await authAction(()=>supabase!.auth.signOut());}
  return{configured,authReady,user,entries,selected,loading,busy,error,notice,signIn,signUp,signOut,capture,select,reply,
    saveDetails:(details:Detail[])=>savePatch({details},'Details saved.'),
    editNote:(note:string)=>savePatch({note},'Edited note saved. You can analyze it again when ready.'),
    setLogged:(logged:boolean)=>savePatch({logged},logged?'Marked as logged.':'Moved back to the inbox.'),
    skipQuestion:()=>savePatch({pendingQuestion:null},'Question skipped. Your note and conversation are saved.'),
    analyze:async()=>{if(active.current)await processAnalysis(active.current.entry,epoch.current);},refresh};
}
