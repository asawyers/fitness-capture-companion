-- Regression: marking logged and undoing must preserve a resumable question.
begin;
insert into auth.users(id) values ('33333333-3333-4333-8333-333333333333');
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select public.fitness_create_capture('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','meal','rice','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3');
update public.fitness_entries set details='[{"type":"food","name":"rice","amount":""}]',pending_question='{"itemIndex":0,"field":"amount","text":"How much rice?"}',analysis_status='ready';
do $$declare e public.fitness_entries; begin
  select * into e from public.fitness_save_entry('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',1,'{"logged":true}');
  if not e.logged or e.pending_question is null or e.analysis_status<>'ready' then raise exception 'logging erased the resumable question/status'; end if;
  select * into e from public.fitness_save_entry(e.id,e.version,'{"logged":false}');
  if e.logged or e.pending_question is null or e.analysis_status<>'ready' then raise exception 'undo erased the resumable question/status'; end if;
  select * into e from public.fitness_append_reply(e.id,'cccccccc-cccc-4ccc-8ccc-ccccccccccc3','one cup',e.version);
  if e.pending_question is null or e.original_note<>'rice' then raise exception 'reply lost clarification context/original'; end if;
  perform public.fitness_claim_analysis(e.id,'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',e.version);
  select * into e from public.fitness_save_entry(e.id,e.version,'{"logged":true}');
  if e.pending_question is null or e.analysis_status<>'idle' or e.analysis_request_id is not null then raise exception 'logging did not safely cancel in-flight analysis'; end if;
  begin
    perform public.fitness_apply_analysis(e.id,'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',e.version-1,'{"details":[],"question":null,"reply":"Stale worker."}');
    raise exception 'logging allowed a stale worker result';
  exception when sqlstate 'PT409' then null; end;
  select * into e from public.fitness_save_entry(e.id,e.version,'{"pendingQuestion":null}');
  if e.pending_question is not null then raise exception 'explicit skip did not clear question'; end if;
end $$;
reset role;
rollback;
