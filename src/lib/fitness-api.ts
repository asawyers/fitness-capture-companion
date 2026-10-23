import type { SupabaseClient } from '@supabase/supabase-js';
import type { Entry } from '@domain/contracts';
import { mapEntry } from './repository';
export async function analyzeEntry(client:SupabaseClient,entry:Entry,requestId:string):Promise<Entry>{
  const endpoint=import.meta.env.VITE_FITNESS_API_URL?.trim();
  if(!endpoint)throw new Error('Your note is saved. AI analysis is not configured; you can edit the details yourself.');
  const {data:{session}}=await client.auth.getSession();
  if(!session)throw new Error('Your note is saved. Sign in again to analyze it.');
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({entryId:entry.id,requestId,expectedVersion:entry.version}),signal:AbortSignal.timeout(30_000)});
  const data=await response.json() as {entry?:unknown;error?:string};
  if(!response.ok){
    if(response.status===409)throw new Error('This entry changed while analysis was running. Reload it to review your latest edits.');
    if(response.status===401)throw new Error('Your note is saved. Sign in again to analyze it.');
    if(data.error==='analysis_disabled')throw new Error('Your note is saved. AI analysis is not enabled; manual editing is available.');
    throw new Error('Your note and reply are saved. Analysis did not finish. Try again, or edit the details yourself.');
  }
  if(!data.entry)throw new Error('Your note is saved. Analysis is still processing. Reload the entry shortly.');
  return mapEntry(data.entry);
}
