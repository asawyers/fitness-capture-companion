-- Run after the migration on an isolated local Supabase database only.
begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.fitness_create_capture('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','meal','rice','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
do $$declare e public.fitness_entries; c jsonb; begin
  if (select count(*) from public.fitness_messages) <> 1 then raise exception 'original message was not saved'; end if;
  select * into e from public.fitness_append_reply('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','one cup',1);
  if e.version <> 2 or e.original_note <> 'rice' then raise exception 'reply lost version/original'; end if;
  select * into e from public.fitness_append_reply(e.id,'cccccccc-cccc-4ccc-8ccc-cccccccccccc','one cup',1);
  if e.version <> 2 or (select count(*) from public.fitness_messages) <> 2 then raise exception 'reply duplicated'; end if;
  c := public.fitness_claim_analysis(e.id,'dddddddd-dddd-4ddd-8ddd-dddddddddddd',2);
  if not (c->>'claimed')::boolean then raise exception 'claim failed'; end if;
  c := public.fitness_claim_analysis(e.id,'dddddddd-dddd-4ddd-8ddd-dddddddddddd',2);
  if (c->>'claimed')::boolean then raise exception 'duplicate claim accepted'; end if;
  select * into e from public.fitness_save_entry(e.id,2,'{"logged":true}');
  begin
    perform public.fitness_apply_analysis(e.id,'dddddddd-dddd-4ddd-8ddd-dddddddddddd',2,'{"details":[{"type":"food","name":"rice","amount":"one cup"}],"question":null,"reply":"Saved."}');
    raise exception 'stale model result accepted';
  exception when serialization_failure then null; end;
  if not e.logged or e.version <> 3 then raise exception 'explicit logging failed'; end if;
  begin
    perform public.fitness_save_entry(e.id,2,'{"note":"stale"}');
    raise exception 'stale user edit accepted';
  exception when serialization_failure then null; end;
  begin
    update public.fitness_entries set original_note = 'changed' where id=e.id;
    raise exception 'original is mutable';
  exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$begin
  if (select count(*) from public.fitness_entries) <> 0 or (select count(*) from public.fitness_messages) <> 0 then raise exception 'RLS exposed another owner'; end if;
  begin
    perform public.fitness_append_reply('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','steal',3);
    raise exception 'cross-owner reply accepted';
  exception when serialization_failure then null; end;
  begin
    insert into public.fitness_messages(id,entry_id,owner_id,role,content,sequence) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','user','steal',3);
    raise exception 'cross-owner message accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
