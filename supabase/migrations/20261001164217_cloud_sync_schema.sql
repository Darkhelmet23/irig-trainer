-- Structured live-profile fields and detailed practice history are needed for
-- cross-device restoration. Existing rows remain valid and merge RPCs continue
-- to operate on their original columns.
alter table public.profiles add column profile_json jsonb not null default '{}'::jsonb
  check (jsonb_typeof(profile_json) = 'object');
alter table public.practice_sessions add column session_json jsonb not null default '{}'::jsonb
  check (jsonb_typeof(session_json) = 'object');

create function public.merge_live_profile_json(p_left jsonb, p_right jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'xp', greatest(coalesce((p_left->>'xp')::integer, 0), coalesce((p_right->>'xp')::integer, 0)),
    'sessions', greatest(coalesce((p_left->>'sessions')::integer, 0), coalesce((p_right->>'sessions')::integer, 0)),
    'skills', coalesce((select pg_catalog.jsonb_object_agg(skill_id,
      greatest(coalesce((p_left->'skills'->>skill_id)::integer, 0),
               coalesce((p_right->'skills'->>skill_id)::integer, 0)))
      from (select key as skill_id from pg_catalog.jsonb_object_keys(coalesce(p_left->'skills', '{}'::jsonb)) key
            union select key as skill_id from pg_catalog.jsonb_object_keys(coalesce(p_right->'skills', '{}'::jsonb)) key) keys), '{}'::jsonb),
    'masteryChallenges', coalesce((select pg_catalog.jsonb_object_agg(challenge_id, true)
      from (select key as challenge_id from pg_catalog.jsonb_each_text(coalesce(p_left->'masteryChallenges', '{}'::jsonb))
              where value = 'true'
            union select key as challenge_id from pg_catalog.jsonb_each_text(coalesce(p_right->'masteryChallenges', '{}'::jsonb))
              where value = 'true') wins), '{}'::jsonb));
$$;
revoke all on function public.merge_live_profile_json(jsonb, jsonb) from public, anon;
grant execute on function public.merge_live_profile_json(jsonb, jsonb) to authenticated;

create function public.sync_live_profile(p_user_id uuid, p_profile jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if (select auth.uid()) is distinct from p_user_id or p_profile is null or
     jsonb_typeof(p_profile) <> 'object' then
    raise exception 'Invalid live profile' using errcode = '22023';
  end if;
  insert into public.profiles (user_id, profile_json)
    values (p_user_id, public.merge_live_profile_json('{}'::jsonb, p_profile))
    on conflict (user_id) do update set
      profile_json = public.merge_live_profile_json(public.profiles.profile_json, excluded.profile_json),
      updated_at = now()
    returning profile_json into result;
  return result;
end $$;
revoke all on function public.sync_live_profile(uuid, jsonb) from public, anon;
grant execute on function public.sync_live_profile(uuid, jsonb) to authenticated;

-- A stale device must never replace a larger skill XP value. The caller's
-- user_id comes only from the authenticated JWT; invoker mode applies RLS.
create function public.sync_skill_xp(p_user_id uuid, p_skill_id text, p_xp integer)
returns integer language plpgsql security invoker set search_path = '' as $$
declare result integer;
begin
  if (select auth.uid()) is distinct from p_user_id or p_skill_id is null or
     char_length(p_skill_id) not between 1 and 120 or p_xp is null or p_xp < 0 then
    raise exception 'Invalid skill progress' using errcode = '22023';
  end if;
  insert into public.skill_progress (user_id, skill_id, xp)
    values (p_user_id, p_skill_id, p_xp)
    on conflict (user_id, skill_id) do update set
      xp = greatest(public.skill_progress.xp, excluded.xp),
      revision = public.skill_progress.revision + 1,
      updated_at = now()
    returning xp into result;
  return result;
end $$;
revoke all on function public.sync_skill_xp(uuid, text, integer) from public, anon;
grant execute on function public.sync_skill_xp(uuid, text, integer) to authenticated;

-- Newer project edits win. This preserves the embedded project ID and does
-- not delete projects absent on the current device.
create function public.sync_song_project(p_user_id uuid, p_id text, p_project jsonb, p_modified_at timestamptz)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if (select auth.uid()) is distinct from p_user_id or p_id is null or char_length(p_id) not between 1 and 120
     or p_project is null or jsonb_typeof(p_project) <> 'object'
     or p_project->>'id' is distinct from p_id or p_modified_at is null then
    raise exception 'Invalid song project' using errcode = '22023';
  end if;
  insert into public.song_projects (id, user_id, project_json, updated_at)
    values (p_id, p_user_id, p_project, p_modified_at)
    on conflict (user_id, id) do update set
      project_json = excluded.project_json,
      revision = public.song_projects.revision + 1,
      updated_at = excluded.updated_at
    where public.song_projects.updated_at < excluded.updated_at;
  select project_json into result from public.song_projects
    where user_id = p_user_id and id = p_id;
  return result;
end $$;
revoke all on function public.sync_song_project(uuid, text, jsonb, timestamptz) from public, anon;
grant execute on function public.sync_song_project(uuid, text, jsonb, timestamptz) to authenticated;

create function public.sync_user_settings(p_user_id uuid, p_settings jsonb, p_updated_at timestamptz)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if (select auth.uid()) is distinct from p_user_id or p_settings is null or
     jsonb_typeof(p_settings) <> 'object' or p_updated_at is null then
    raise exception 'Invalid user settings' using errcode = '22023';
  end if;
  insert into public.user_settings (user_id, settings_json, updated_at)
    values (p_user_id, p_settings, p_updated_at)
    on conflict (user_id) do update set
      settings_json = excluded.settings_json,
      revision = public.user_settings.revision + 1,
      updated_at = excluded.updated_at
    where public.user_settings.updated_at < excluded.updated_at;
  select settings_json into result from public.user_settings where user_id = p_user_id;
  return result;
end $$;
revoke all on function public.sync_user_settings(uuid, jsonb, timestamptz) from public, anon;
grant execute on function public.sync_user_settings(uuid, jsonb, timestamptz) to authenticated;

-- Preserve detailed session data and profile state in the existing merge transaction.
create or replace function public.merge_user_data(p_primary uuid, p_secondary uuid)
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

  insert into public.profiles (user_id, display_name, created_at, updated_at, profile_json)
    select p_primary, display_name, created_at, now(), profile_json from public.profiles where user_id = p_secondary
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
         and existing.created_at = item.created_at and existing.session_json = item.session_json then
        target_id := null; exit;
      end if;
      target_id := pg_catalog.left(item.id, 80) || '~' ||
        pg_catalog.substr(pg_catalog.md5(p_secondary::text || ':' || item.id || ':' || attempt::text), 1, 32);
    end loop;
    if target_id is not null then
      if exists (select 1 from public.practice_sessions where user_id = p_primary and id = target_id) then
        raise exception 'Cannot assign a unique practice session ID';
      end if;
      insert into public.practice_sessions (id, user_id, lesson_id, accuracy, bpm, speed, created_at, session_json)
        values (target_id, p_primary, item.lesson_id, item.accuracy, item.bpm, item.speed, item.created_at, item.session_json);
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
