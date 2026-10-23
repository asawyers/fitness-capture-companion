import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from 'vitest';
import { createRepository } from '../../src/lib/repository';

// Explicitly local: never create test users or data in a hosted project.
const env = Object.fromEntries((existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '').trim().split('\n').map(line => {
  const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)];
}));
const url = env.VITE_SUPABASE_URL;
const enabled = process.env.FITNESS_LOCAL_INTEGRATION === '1';
test.skipIf(!enabled)('real accounts isolate entries and chats; edits, copy data and logged state persist', async () => {
  expect(new URL(url).hostname).toBe('127.0.0.1');
  const client = () => createClient(url, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const a = client(), b = client(), anon = client();
  const suffix = crypto.randomUUID();
  for (const [index, c] of [a, b].entries()) {
    const { data, error } = await c.auth.signUp({ email: `fitness-${index}-${suffix}@example.test`, password: `Synthetic-${suffix}!` });
    expect(error).toBeNull(); expect(data.session).toBeTruthy();
  }
  const ra = createRepository(a), rb = createRepository(b);
  const id = crypto.randomUUID(), mid = crypto.randomUUID();
  const entry = await ra.create(id, 'meal', 'Rice and two eggs', mid);
  expect((await ra.create(id, 'meal', 'Rice and two eggs', mid)).id).toBe(id);
  expect((await ra.load(id)).messages).toHaveLength(1);
  expect(await rb.list()).toEqual([]);
  await expect(rb.load(id)).rejects.toThrow();
  await expect(rb.reply(entry, crypto.randomUUID(), 'not my entry')).rejects.toThrow();
  const hiddenMessages = await b.from('fitness_messages').select('*').eq('entry_id', id);
  expect(hiddenMessages.data).toEqual([]);
  const unauthenticated = await anon.from('fitness_entries').select('*');
  expect(unauthenticated.error || unauthenticated.data?.length === 0).toBeTruthy();
  const replyId = crypto.randomUUID();
  const replied = await ra.reply(entry, replyId, 'One cup of rice');
  await ra.reply(entry, replyId, 'One cup of rice');
  expect((await ra.load(id)).messages).toHaveLength(2);
  const detailed = await ra.save(replied, { details: [{type:'food', name:'rice', amount:'one cup'}, {type:'food', name:'eggs', amount:'two'}] });
  const edited = await ra.save(detailed, { note:'Rice (one cup) and two eggs' });
  expect(edited.originalNote).toBe('Rice and two eggs');
  expect(edited.logged).toBe(false);
  const logged = await ra.save(edited, { logged:true });
  expect((await ra.load(id)).entry.logged).toBe(true);
  const undone = await ra.save(logged, { logged:false });
  expect(undone.logged).toBe(false);
  await expect(ra.save(edited, {note:'stale'})).rejects.toThrow('changed');
  // Reauthenticate a fresh client to verify server persistence rather than local state.
  const restored = client();
  const { error } = await restored.auth.signInWithPassword({email:`fitness-0-${suffix}@example.test`,password:`Synthetic-${suffix}!`});
  expect(error).toBeNull();
  const saved = await createRepository(restored).load(id);
  expect(saved.messages.map(m=>m.content)).toEqual(['Rice and two eggs','One cup of rice']);
  expect(saved.entry.details).toHaveLength(2);
  const session = (await a.auth.getSession()).data.session!;
  const analysis = await fetch(`${url}/functions/v1/fitness`, {method:'POST', headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({entryId:id,requestId:crypto.randomUUID(),expectedVersion:undone.version})});
  expect(analysis.status).toBe(503);
  expect(await analysis.json()).toEqual({error:'analysis_disabled'});
  await Promise.all([a.auth.signOut(),b.auth.signOut(),restored.auth.signOut()]);
}, 30_000);
