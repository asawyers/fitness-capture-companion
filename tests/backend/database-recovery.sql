-- Regression: a terminated worker cannot strand the entry in processing forever.
begin;
insert into auth.users(id) values ('44444444-4444-4444-8444-444444444444');
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select public.fitness_create_capture('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','meal','rice','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4');
do $$declare c jsonb; e public.fitness_entries; begin
  c:=public.fitness_claim_analysis('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','dddddddd-dddd-4ddd-8ddd-ddddddddddd4',1);
  begin
    perform public.fitness_claim_analysis('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4',1);
    raise exception 'unexpired lease was stolen';
  exception when sqlstate 'PT409' then null; end;
  -- Simulate an interrupted request without waiting or making an AI request.
  update public.fitness_entries set updated_at=now()-interval '61 seconds' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
  c:=public.fitness_claim_analysis('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4',1);
  if not (c->>'claimed')::boolean then raise exception 'expired processing entry is stranded'; end if;
  begin
    perform public.fitness_apply_analysis('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','dddddddd-dddd-4ddd-8ddd-ddddddddddd4',1,'{"details":[],"question":null,"reply":"Old worker."}');
    raise exception 'replaced worker result was accepted';
  exception when sqlstate 'PT409' then null; end;
  perform public.fitness_fail_analysis('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','dddddddd-dddd-4ddd-8ddd-ddddddddddd4',1);
  if (select analysis_status from public.fitness_entries where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4')<>'processing' then raise exception 'old worker failed new claim'; end if;
  select * into e from public.fitness_apply_analysis('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4',1,'{"details":[{"type":"food","name":"rice","amount":""}],"question":{"itemIndex":0,"field":"amount","text":"How much rice?"},"reply":"How much rice?"}');
  if e.version<>2 or e.analysis_status<>'ready' then raise exception 'replacement did not finish'; end if;
  c:=public.fitness_claim_analysis(e.id,'dddddddd-dddd-4ddd-8ddd-ddddddddddd4',2);
  if (c->>'claimed')::boolean then raise exception 'old request ID was replayed'; end if;
  if (select count(*) from public.fitness_messages)<>2 then raise exception 'assistant history duplicated'; end if;
end $$;
reset role;
rollback;
