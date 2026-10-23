-- Caller-scoped RPCs deliberately keep RLS active. No service-role access is needed.
create table public.fitness_entries (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('meal','workout')),
  original_note text not null check (length(original_note) between 1 and 4000),
  note text not null check (length(note) between 1 and 4000),
  details jsonb not null default '[]',
  pending_question jsonb,
  analysis_status text not null default 'idle' check (analysis_status in ('idle','processing','ready','failed')),
  logged boolean not null default false,
  version integer not null default 1 check (version > 0),
  analysis_request_id uuid,
  analysis_request_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,owner_id)
);
create index fitness_entries_owner_created on public.fitness_entries(owner_id,created_at desc);
create table public.fitness_messages (
  id uuid primary key,
  entry_id uuid not null,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (length(content) between 1 and 4000),
  sequence integer not null check(sequence > 0),
  created_at timestamptz not null default now(),
  foreign key(entry_id,owner_id) references public.fitness_entries(id,owner_id) on delete cascade,
  unique(entry_id,sequence)
);
create index fitness_messages_owner_entry on public.fitness_messages(owner_id,entry_id,sequence);
alter table public.fitness_entries enable row level security;
alter table public.fitness_messages enable row level security;
create policy fitness_entries_select on public.fitness_entries for select to authenticated using ((select auth.uid())=owner_id);
create policy fitness_entries_insert on public.fitness_entries for insert to authenticated with check ((select auth.uid())=owner_id);
create policy fitness_entries_update on public.fitness_entries for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy fitness_messages_select on public.fitness_messages for select to authenticated using ((select auth.uid())=owner_id);
create policy fitness_messages_insert on public.fitness_messages for insert to authenticated with check ((select auth.uid())=owner_id and exists(select 1 from public.fitness_entries e where e.id=entry_id and e.owner_id=(select auth.uid())));
revoke all on public.fitness_entries,public.fitness_messages from anon,authenticated;
grant select,insert,update on public.fitness_entries to authenticated;
grant select,insert on public.fitness_messages to authenticated;

create function public.fitness_validate_details(p_kind text,p_details jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare d jsonb; expected text[]; k text; begin
  if jsonb_typeof(p_details) is distinct from 'array' or jsonb_array_length(p_details)>30 then return false; end if;
  for d in select value from jsonb_array_elements(p_details) loop
    if p_kind='meal' and d->>'type'='food' then expected:=array['type','name','amount'];
    elsif p_kind='workout' and d->>'type'='strength' then expected:=array['type','exercise','sets','reps','weight'];
    elsif p_kind='workout' and d->>'type'='cardio' then expected:=array['type','activity','duration','distance'];
    else return false; end if;
    if jsonb_typeof(d) is distinct from 'object' or (select count(*) from jsonb_object_keys(d))<>cardinality(expected) then return false; end if;
    foreach k in array expected loop
      if jsonb_typeof(d->k) is distinct from 'string' or length(d->>k)>500 then return false; end if;
    end loop;
  end loop;
  return true;
end $$;
create function public.fitness_validate_question(p_details jsonb,p_question jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare idx integer; begin
  if p_question is null or p_question='null'::jsonb then return true; end if;
  if jsonb_typeof(p_question) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_question))<>3
    or jsonb_typeof(p_question->'itemIndex') is distinct from 'number'
    or jsonb_typeof(p_question->'field') is distinct from 'string'
    or jsonb_typeof(p_question->'text') is distinct from 'string'
    or length(p_question->>'text') not between 1 and 300 then return false; end if;
  begin idx:=(p_question->>'itemIndex')::integer; exception when others then return false; end;
  return idx>=0 and idx<jsonb_array_length(p_details) and p_question->>'field'<>'type'
    and (p_details->idx ? (p_question->>'field')) and p_details->idx->>(p_question->>'field')='';
end $$;
alter table public.fitness_entries add constraint fitness_details_valid check(public.fitness_validate_details(kind,details));
alter table public.fitness_entries add constraint fitness_question_valid check(public.fitness_validate_question(details,pending_question));
create function public.fitness_immutable_original() returns trigger language plpgsql security invoker set search_path='' as $$begin
  if new.id<>old.id or new.owner_id<>old.owner_id or new.original_note<>old.original_note or new.kind<>old.kind or new.created_at<>old.created_at then
    raise exception 'capture identity and original are immutable' using errcode='23514'; end if;
  return new;
end $$;
create trigger fitness_immutable_original before update on public.fitness_entries for each row execute function public.fitness_immutable_original();

create function public.fitness_create_capture(p_id uuid,p_kind text,p_note text,p_message_id uuid) returns public.fitness_entries language plpgsql security invoker set search_path='' as $$
declare e public.fitness_entries; begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  insert into public.fitness_entries(id,kind,original_note,note) values(p_id,p_kind,p_note,p_note) on conflict(id) do nothing returning * into e;
  if e.id is null then
    select * into e from public.fitness_entries where id=p_id and owner_id=auth.uid() for update;
    if e.id is null or e.kind<>p_kind or e.original_note<>p_note or not exists(select 1 from public.fitness_messages where id=p_message_id and entry_id=e.id and content=p_note and role='user') then raise exception 'capture conflict' using errcode='40001'; end if;
    return e;
  end if;
  insert into public.fitness_messages(id,entry_id,role,content,sequence) values(p_message_id,e.id,'user',p_note,1);
  return e;
end $$;
create function public.fitness_append_reply(p_entry_id uuid,p_message_id uuid,p_content text,p_expected_version integer) returns public.fitness_entries language plpgsql security invoker set search_path='' as $$
declare e public.fitness_entries; m public.fitness_messages; begin
  select * into e from public.fitness_entries where id=p_entry_id and owner_id=auth.uid() for update;
  if e.id is null then raise exception 'entry conflict' using errcode='40001'; end if;
  select * into m from public.fitness_messages where id=p_message_id;
  if m.id is not null then
    if m.entry_id<>e.id or m.role<>'user' or m.content<>p_content then raise exception 'message conflict' using errcode='40001'; end if;
    return e;
  end if;
  if e.version<>p_expected_version then raise exception 'version conflict' using errcode='40001'; end if;
  insert into public.fitness_messages(id,entry_id,role,content,sequence) select p_message_id,e.id,'user',p_content,coalesce(max(sequence),0)+1 from public.fitness_messages where entry_id=e.id;
  update public.fitness_entries set version=version+1,analysis_status='idle',analysis_request_id=null,updated_at=now() where id=e.id returning * into e;
  return e;
end $$;
create function public.fitness_save_entry(p_entry_id uuid,p_expected_version integer,p_patch jsonb) returns public.fitness_entries language plpgsql security invoker set search_path='' as $$
declare e public.fitness_entries; k text; begin
  if jsonb_typeof(p_patch) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_patch))<>1 then raise exception 'one patch field required' using errcode='22023'; end if;
  select jsonb_object_keys(p_patch) into k;
  if k not in ('note','details','logged','pendingQuestion') or (k='pendingQuestion' and p_patch->k<>'null'::jsonb)
    or (k='note' and jsonb_typeof(p_patch->k)<>'string') or (k='logged' and jsonb_typeof(p_patch->k)<>'boolean') then raise exception 'invalid patch' using errcode='22023'; end if;
  update public.fitness_entries set
    note=case when k='note' then p_patch->>k else note end,
    details=case when k='details' then p_patch->k else details end,
    logged=case when k='logged' then (p_patch->>k)::boolean else logged end,
    pending_question=null,analysis_status='idle',analysis_request_id=null,version=version+1,updated_at=now()
  where id=p_entry_id and owner_id=auth.uid() and version=p_expected_version returning * into e;
  if e.id is null then raise exception 'version conflict' using errcode='40001'; end if;
  return e;
end $$;
create function public.fitness_claim_analysis(p_entry_id uuid,p_request_id uuid,p_expected_version integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare e public.fitness_entries; begin
  select * into e from public.fitness_entries where id=p_entry_id and owner_id=auth.uid() for update;
  if e.id is null then raise exception 'entry conflict' using errcode='40001'; end if;
  if p_request_id=any(e.analysis_request_ids) then return jsonb_build_object('claimed',false,'entry',to_jsonb(e)); end if;
  if e.version<>p_expected_version or e.analysis_status='processing' then raise exception 'version conflict' using errcode='40001'; end if;
  update public.fitness_entries set analysis_status='processing',analysis_request_id=p_request_id,analysis_request_ids=array_append(analysis_request_ids,p_request_id),updated_at=now() where id=e.id returning * into e;
  return jsonb_build_object('claimed',true,'entry',to_jsonb(e));
end $$;
create function public.fitness_apply_analysis(p_entry_id uuid,p_request_id uuid,p_expected_version integer,p_result jsonb) returns public.fitness_entries language plpgsql security invoker set search_path='' as $$
declare e public.fitness_entries; begin
  if jsonb_typeof(p_result) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_result))<>3
    or not (p_result ?& array['details','question','reply']) or jsonb_typeof(p_result->'reply') is distinct from 'string' or length(p_result->>'reply') not between 1 and 500 then raise exception 'invalid analysis' using errcode='22023'; end if;
  update public.fitness_entries set details=p_result->'details',pending_question=nullif(p_result->'question','null'::jsonb),analysis_status='ready',version=version+1,updated_at=now()
    where id=p_entry_id and owner_id=auth.uid() and version=p_expected_version and analysis_request_id=p_request_id and analysis_status='processing' returning * into e;
  if e.id is null then raise exception 'version conflict' using errcode='40001'; end if;
  insert into public.fitness_messages(id,entry_id,role,content,sequence) select p_request_id,e.id,'assistant',p_result->>'reply',coalesce(max(sequence),0)+1 from public.fitness_messages where entry_id=e.id;
  return e;
end $$;
create function public.fitness_fail_analysis(p_entry_id uuid,p_request_id uuid,p_expected_version integer) returns void language plpgsql security invoker set search_path='' as $$begin
  update public.fitness_entries set analysis_status='failed',updated_at=now() where id=p_entry_id and owner_id=auth.uid() and version=p_expected_version and analysis_request_id=p_request_id and analysis_status='processing';
end $$;
-- Postgres defaults EXECUTE to PUBLIC; limit the complete RPC/helper surface explicitly.
revoke all on function public.fitness_validate_details(text,jsonb), public.fitness_validate_question(jsonb,jsonb), public.fitness_immutable_original(), public.fitness_create_capture(uuid,text,text,uuid), public.fitness_append_reply(uuid,uuid,text,integer), public.fitness_save_entry(uuid,integer,jsonb), public.fitness_claim_analysis(uuid,uuid,integer), public.fitness_apply_analysis(uuid,uuid,integer,jsonb), public.fitness_fail_analysis(uuid,uuid,integer) from public,anon;
grant execute on function public.fitness_validate_details(text,jsonb), public.fitness_validate_question(jsonb,jsonb), public.fitness_immutable_original(), public.fitness_create_capture(uuid,text,text,uuid), public.fitness_append_reply(uuid,uuid,text,integer), public.fitness_save_entry(uuid,integer,jsonb), public.fitness_claim_analysis(uuid,uuid,integer), public.fitness_apply_analysis(uuid,uuid,integer,jsonb), public.fitness_fail_analysis(uuid,uuid,integer) to authenticated;
