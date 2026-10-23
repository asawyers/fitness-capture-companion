-- Keep clarification context when explicitly toggling logged. A logged edit still
-- invalidates an in-flight result through version/request checks, so processing
-- becomes idle; ready/failed/idle states remain unchanged.
-- Processing claims lease the entry for 60 seconds (the model timeout is 20s).
-- Recovery requires a fresh request ID. Earlier IDs stay deduplicated and an
-- old worker cannot apply or fail the replacement claim.
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
  if e.id is null then raise exception 'version conflict' using errcode='40001'; end if;
  return e;
end $$;
create or replace function public.fitness_claim_analysis(p_entry_id uuid,p_request_id uuid,p_expected_version integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare e public.fitness_entries; begin
  select * into e from public.fitness_entries where id=p_entry_id and owner_id=auth.uid() for update;
  if e.id is null then raise exception 'entry conflict' using errcode='40001'; end if;
  if p_request_id=any(e.analysis_request_ids) then return jsonb_build_object('claimed',false,'entry',to_jsonb(e)); end if;
  if e.version<>p_expected_version or (e.analysis_status='processing' and e.updated_at>clock_timestamp()-interval '60 seconds') then raise exception 'version conflict' using errcode='40001'; end if;
  update public.fitness_entries set analysis_status='processing',analysis_request_id=p_request_id,analysis_request_ids=array_append(analysis_request_ids,p_request_id),updated_at=now() where id=e.id returning * into e;
  return jsonb_build_object('claimed',true,'entry',to_jsonb(e));
end $$;
