-- Intentional application conflicts must not use serialization_failure: older
-- hosted PostgREST versions retry SQLSTATE 40001 indefinitely. PT409 maps to
-- HTTP 409 immediately. Genuine database serialization failures are untouched.
-- https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b
-- CREATE OR REPLACE preserves existing SECURITY INVOKER behavior and ACLs.
create or replace function public.fitness_create_capture(p_id uuid,p_kind text,p_note text,p_message_id uuid) returns public.fitness_entries language plpgsql security invoker set search_path='' as $$
declare e public.fitness_entries; begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  insert into public.fitness_entries(id,kind,original_note,note) values(p_id,p_kind,p_note,p_note) on conflict(id) do nothing returning * into e;
  if e.id is null then
    select * into e from public.fitness_entries where id=p_id and owner_id=auth.uid() for update;
    if e.id is null or e.kind<>p_kind or e.original_note<>p_note or not exists(select 1 from public.fitness_messages where id=p_message_id and entry_id=e.id and content=p_note and role='user') then raise exception 'capture conflict' using errcode='PT409'; end if;
    return e;
  end if;
  insert into public.fitness_messages(id,entry_id,role,content,sequence) values(p_message_id,e.id,'user',p_note,1);
  return e;
end $$;

create or replace function public.fitness_append_reply(p_entry_id uuid,p_message_id uuid,p_content text,p_expected_version integer) returns public.fitness_entries language plpgsql security invoker set search_path='' as $$
declare e public.fitness_entries; m public.fitness_messages; begin
  select * into e from public.fitness_entries where id=p_entry_id and owner_id=auth.uid() for update;
  if e.id is null then raise exception 'entry conflict' using errcode='PT409'; end if;
  select * into m from public.fitness_messages where id=p_message_id;
  if m.id is not null then
    if m.entry_id<>e.id or m.role<>'user' or m.content<>p_content then raise exception 'message conflict' using errcode='PT409'; end if;
    return e;
  end if;
  if e.version<>p_expected_version then raise exception 'version conflict' using errcode='PT409'; end if;
  insert into public.fitness_messages(id,entry_id,role,content,sequence) select p_message_id,e.id,'user',p_content,coalesce(max(sequence),0)+1 from public.fitness_messages where entry_id=e.id;
  update public.fitness_entries set version=version+1,analysis_status='idle',analysis_request_id=null,updated_at=now() where id=e.id returning * into e;
  return e;
end $$;

create or replace function public.fitness_save_entry(p_entry_id uuid,p_expected_version integer,p_patch jsonb) returns public.fitness_entries language plpgsql security invoker set search_path='' as $$
declare e public.fitness_entries; k text; begin
  if jsonb_typeof(p_patch) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_patch))<>1 then raise exception 'one patch field required' using errcode='22023'; end if;
  select jsonb_object_keys(p_patch) into k;
  if k not in ('note','details','logged','pendingQuestion') or (k='pendingQuestion' and p_patch->k<>'null'::jsonb)
    or (k='note' and jsonb_typeof(p_patch->k)<>'string') or (k='logged' and jsonb_typeof(p_patch->k)<>'boolean') then raise exception 'invalid patch' using errcode='22023'; end if;
  update public.fitness_entries set
    note=case when k='note' then p_patch->>k else note end,
    details=case when k='details' then p_patch->k else details end,
    logged=case when k='logged' then (p_patch->>k)::boolean else logged end,
    pending_question=case when k='logged' then pending_question else null end,
    analysis_status=case when k='logged' and analysis_status<>'processing' then analysis_status else 'idle' end,
    analysis_request_id=null,version=version+1,updated_at=now()
  where id=p_entry_id and owner_id=auth.uid() and version=p_expected_version returning * into e;
  if e.id is null then raise exception 'version conflict' using errcode='PT409'; end if;
  return e;
end $$;

create or replace function public.fitness_claim_analysis(p_entry_id uuid,p_request_id uuid,p_expected_version integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare e public.fitness_entries; begin
  select * into e from public.fitness_entries where id=p_entry_id and owner_id=auth.uid() for update;
  if e.id is null then raise exception 'entry conflict' using errcode='PT409'; end if;
  if p_request_id=any(e.analysis_request_ids) then return jsonb_build_object('claimed',false,'entry',to_jsonb(e)); end if;
  if e.version<>p_expected_version or (e.analysis_status='processing' and e.updated_at>clock_timestamp()-interval '60 seconds') then raise exception 'version conflict' using errcode='PT409'; end if;
  update public.fitness_entries set analysis_status='processing',analysis_request_id=p_request_id,analysis_request_ids=array_append(analysis_request_ids,p_request_id),updated_at=now() where id=e.id returning * into e;
  return jsonb_build_object('claimed',true,'entry',to_jsonb(e));
end $$;

create or replace function public.fitness_apply_analysis(p_entry_id uuid,p_request_id uuid,p_expected_version integer,p_result jsonb) returns public.fitness_entries language plpgsql security invoker set search_path='' as $$
declare e public.fitness_entries; begin
  if jsonb_typeof(p_result) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_result))<>3
    or not (p_result ?& array['details','question','reply']) or jsonb_typeof(p_result->'reply') is distinct from 'string' or length(p_result->>'reply') not between 1 and 500 then raise exception 'invalid analysis' using errcode='22023'; end if;
  update public.fitness_entries set details=p_result->'details',pending_question=nullif(p_result->'question','null'::jsonb),analysis_status='ready',version=version+1,updated_at=now()
    where id=p_entry_id and owner_id=auth.uid() and version=p_expected_version and analysis_request_id=p_request_id and analysis_status='processing' returning * into e;
  if e.id is null then raise exception 'version conflict' using errcode='PT409'; end if;
  insert into public.fitness_messages(id,entry_id,role,content,sequence) select p_request_id,e.id,'assistant',p_result->>'reply',coalesce(max(sequence),0)+1 from public.fitness_messages where entry_id=e.id;
  return e;
end $$;
