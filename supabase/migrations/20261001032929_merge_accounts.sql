-- Only the merge Edge Function's service-role client can call these RPCs.
-- Application data moves in one transaction; Auth deletion happens afterwards.
create table public.account_merge_operations (
  primary_user_id uuid not null,
  secondary_user_id uuid not null,
  merged_at timestamptz not null default now(),
  summary jsonb not null default '{}'::jsonb,
  primary key (primary_user_id, secondary_user_id),
  check (primary_user_id <> secondary_user_id)
);
alter table public.account_merge_operations enable row level security;
revoke all on public.account_merge_operations from public, anon, authenticated;
grant select, insert on public.account_merge_operations to service_role;

create function public.merge_account_preview(p_primary uuid, p_secondary uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if p_primary is null or p_secondary is null or p_primary = p_secondary then
    raise exception 'Two different accounts are required' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_primary)
     or not exists (select 1 from auth.users where id = p_secondary) then
    raise exception 'Account not found' using errcode = '22023';
  end if;
  if exists (select 1 from storage.objects where owner_id = p_secondary::text) then
    raise exception 'CLOUD_FILES_UNSUPPORTED' using errcode = 'P0001';
  end if;
  select jsonb_build_object(
    'primary', jsonb_build_object(
      'skills', (select count(*) from public.skill_progress where user_id = p_primary),
      'sessions', (select count(*) from public.practice_sessions where user_id = p_primary),
      'projects', (select count(*) from public.song_projects where user_id = p_primary)),
    'secondary', jsonb_build_object(
      'skills', (select count(*) from public.skill_progress where user_id = p_secondary),
      'sessions', (select count(*) from public.practice_sessions where user_id = p_secondary),
      'projects', (select count(*) from public.song_projects where user_id = p_secondary)),
    'alreadyMerged', exists (select 1 from public.account_merge_operations
      where primary_user_id = p_primary and secondary_user_id = p_secondary)) into result;
  return result;
end $$;

create function public.merge_user_data(p_primary uuid, p_secondary uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  item record;
  target_id text;
  existing record;
  attempt integer;
  result jsonb;
begin
  if p_primary is null or p_secondary is null or p_primary = p_secondary then
    raise exception 'Two different accounts are required' using errcode = '22023';
  end if;
  -- Serialize this account pair. The operation marker makes retries no-ops.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_primary::text || ':' || p_secondary::text, 0));
  select summary into result from public.account_merge_operations
    where primary_user_id = p_primary and secondary_user_id = p_secondary;
  if found then return result; end if;
  -- Repeat preflight inside the same transaction, before any data moves.
  result := public.merge_account_preview(p_primary, p_secondary);

  insert into public.profiles (user_id, display_name, created_at, updated_at)
    select p_primary, display_name, created_at, now() from public.profiles where user_id = p_secondary
    on conflict (user_id) do update set
      display_name = excluded.display_name, updated_at = now()
      where nullif(pg_catalog.btrim(public.profiles.display_name), '') is null
        and nullif(pg_catalog.btrim(excluded.display_name), '') is not null;
  insert into public.user_settings (user_id, settings_json, revision, updated_at)
    select p_primary, settings_json, revision, now() from public.user_settings where user_id = p_secondary
    on conflict (user_id) do nothing;
  insert into public.skill_progress (user_id, skill_id, xp, revision, updated_at)
    select p_primary, skill_id, xp, revision + 1, now() from public.skill_progress where user_id = p_secondary
    on conflict (user_id, skill_id) do update set
      xp = greatest(public.skill_progress.xp, excluded.xp),
      revision = greatest(public.skill_progress.revision, excluded.revision) + 1,
      updated_at = now();

  for item in select * from public.practice_sessions where user_id = p_secondary order by id loop
    target_id := item.id;
    for attempt in 0..32 loop
      select * into existing from public.practice_sessions where user_id = p_primary and id = target_id;
      exit when not found;
      if existing.lesson_id = item.lesson_id and existing.accuracy = item.accuracy
         and existing.bpm is not distinct from item.bpm
         and existing.speed is not distinct from item.speed
         and existing.created_at = item.created_at then
        target_id := null; exit;
      end if;
      target_id := pg_catalog.left(item.id, 80) || '~' ||
        pg_catalog.substr(pg_catalog.md5(p_secondary::text || ':' || item.id || ':' || attempt::text), 1, 32);
    end loop;
    if target_id is not null then
      if exists (select 1 from public.practice_sessions where user_id = p_primary and id = target_id) then
        raise exception 'Cannot assign a unique practice session ID';
      end if;
      insert into public.practice_sessions (id, user_id, lesson_id, accuracy, bpm, speed, created_at)
        values (target_id, p_primary, item.lesson_id, item.accuracy, item.bpm, item.speed, item.created_at);
    end if;
  end loop;

  for item in select * from public.song_projects where user_id = p_secondary order by id loop
    target_id := item.id;
    for attempt in 0..32 loop
      select * into existing from public.song_projects where user_id = p_primary and id = target_id;
      exit when not found;
      if existing.project_json = (item.project_json || jsonb_build_object('id', target_id)) then
        update public.song_projects set updated_at = greatest(updated_at, item.updated_at)
          where user_id = p_primary and id = target_id;
        target_id := null; exit;
      end if;
      target_id := pg_catalog.left(item.id, 80) || '~' ||
        pg_catalog.substr(pg_catalog.md5(p_secondary::text || ':' || item.id || ':' || attempt::text), 1, 32);
    end loop;
    if target_id is not null then
      if exists (select 1 from public.song_projects where user_id = p_primary and id = target_id) then
        raise exception 'Cannot assign a unique song project ID';
      end if;
      insert into public.song_projects (id, user_id, project_json, revision, created_at, updated_at)
        values (target_id, p_primary, item.project_json || jsonb_build_object('id', target_id),
          item.revision, item.created_at, item.updated_at);
    end if;
  end loop;
  insert into public.account_merge_operations (primary_user_id, secondary_user_id, summary)
    values (p_primary, p_secondary, result);
  return result;
end $$;

revoke all on function public.merge_account_preview(uuid, uuid) from public, anon, authenticated;
revoke all on function public.merge_user_data(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_account_preview(uuid, uuid) to service_role;
grant execute on function public.merge_user_data(uuid, uuid) to service_role;
