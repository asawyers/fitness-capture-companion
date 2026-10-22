import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleEntries } from '../lib/api.ts';
import { EntryStore } from '../lib/store.ts';
import { openDatabase } from './sqlite.ts';

const origin = 'https://capture.test';
function request(method = 'GET', body?: unknown, path = '', headers: Record<string,string> = {}) {
  return new Request(`${origin}/api/entries${path}`, {method,headers:{origin,'content-type':'application/json',...headers},body:body === undefined ? undefined : JSON.stringify(body)});
}
function context() { const db = openDatabase(); return {db,store:new EntryStore(db)}; }
const capture = (id = crypto.randomUUID()) => ({id,kind:'meal',note:'2 eggs, rice'});

test('anonymous API reads and writes require sign-in', async () => {
  const {db,store} = context();
  for (const req of [request(),request('POST',capture())]) assert.equal((await handleEntries(req,null,store)).status,401);
  db.close();
});
test('owner scopes list, direct read and every update; user IDs in bodies cannot override identity', async () => {
  const {db,store} = context();
  const data = capture();
  assert.equal((await handleEntries(request('POST',data),'alice',store)).status,201);
  assert.equal((await handleEntries(request(),'bob',store)).status,200);
  assert.deepEqual(await (await handleEntries(request(),'bob',store)).json(),{entries:[]});
  assert.equal((await handleEntries(request('GET',undefined,`/${data.id}`),'bob',store)).status,404);
  assert.equal((await handleEntries(request('PATCH',{version:1,logged:true},`/${data.id}`),'bob',store)).status,404);
  assert.equal((await handleEntries(request('POST',{...capture(),userId:'alice'}),'bob',store)).status,400);
  assert.equal((await handleEntries(request('GET',undefined,`/${data.id}`),'alice',store)).status,200);
  db.close();
});
test('capture is durable before optional clarification; updates retain ID and original', async () => {
  const {db,store} = context(); const data = capture();
  const first = await (await handleEntries(request('POST',data),'alice',store)).json() as any;
  assert.equal(first.entry.originalNote,data.note);
  assert.equal(first.entry.details[1].amount,'');
  const res = await handleEntries(request('PATCH',{version:1,clarification:{index:1,field:'amount',value:'1 cup'}},`/${data.id}`),'alice',store);
  assert.equal(res.status,200);
  const second = await res.json() as any;
  assert.equal(second.entry.id,data.id); assert.equal(second.entry.details[1].amount,'1 cup');
  assert.equal(second.entry.originalNote,data.note); assert.equal(second.entry.logged,false);
  assert.equal((await (await handleEntries(request(),'alice',store)).json() as any).entries.length,1);
  db.close();
});
test('retrying capture is idempotent and conflicting reuse is rejected', async () => {
  const {db,store} = context(); const data = capture();
  await handleEntries(request('POST',data),'alice',store);
  assert.equal((await handleEntries(request('POST',data),'alice',store)).status,200);
  assert.equal((await handleEntries(request('POST',{...data,note:'different'}),'alice',store)).status,409);
  assert.equal((await handleEntries(request('POST',data),'bob',store)).status,409);
  db.close();
});
test('editing and logged state persist, stale writes conflict, export/read never marks logged', async () => {
  const {db,store} = context(); const data = capture(); await handleEntries(request('POST',data),'alice',store);
  const edit = await handleEntries(request('PATCH',{version:1,note:'1 banana'},`/${data.id}`),'alice',store);
  const edited = (await edit.json() as any).entry;
  assert.equal(edited.note,'1 banana'); assert.equal(edited.originalNote,data.note); assert.equal(edited.logged,false);
  assert.equal((await handleEntries(request('PATCH',{version:1,logged:true},`/${data.id}`),'alice',store)).status,409);
  const log = await handleEntries(request('PATCH',{version:2,logged:true},`/${data.id}`),'alice',store);
  assert.equal((await log.json() as any).entry.logged,true);
  const unlog = await handleEntries(request('PATCH',{version:3,logged:false},`/${data.id}`),'alice',store);
  assert.equal((await unlog.json() as any).entry.logged,false);
  db.close();
});
test('rejects cross-origin, non-JSON, invalid JSON, invalid IDs and malformed/oversized mutations', async () => {
  const {db,store} = context();
  assert.equal((await handleEntries(request('POST',capture(),'',{origin:'https://evil.test'}),'alice',store)).status,403);
  assert.equal((await handleEntries(request('POST',capture(),' ',{'content-type':'text/plain'}),'alice',store)).status,415);
  for (const body of [{...capture(),note:' '},{...capture(),note:'a'.repeat(4001)},{...capture(),kind:'photo'},{...capture(),id:'bad'}]) {
    assert.equal((await handleEntries(request('POST',body),'alice',store)).status,400);
  }
  const invalid = new Request(`${origin}/api/entries`,{method:'POST',headers:{origin,'content-type':'application/json'},body:'{'});
  assert.equal((await handleEntries(invalid,'alice',store)).status,400);
  db.close();
});
test('entries survive a database close and reopen', async () => {
  const dir = mkdtempSync(join(tmpdir(),'fitness-test-')); const filename = join(dir,'entries.sqlite');
  try {
    let db = openDatabase(filename); const data = capture();
    await handleEntries(request('POST',data),'alice',new EntryStore(db)); db.close();
    // Migrations only applied once: reopen the database directly through helper's optional flag.
    db = openDatabase(filename);
    const result = await handleEntries(request(),'alice',new EntryStore(db));
    assert.equal((await result.json() as any).entries[0].id,data.id); db.close();
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
