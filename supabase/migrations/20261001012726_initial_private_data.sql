-- Cloud-side storage foundation only. The app continues to save locally until
-- an explicit, conflict-aware sync flow is implemented.
-- Auth identities and passwords remain in Supabase Auth.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.skill_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  skill_id text not null check (char_length(skill_id) between 1 and 120),
  xp integer not null default 0 check (xp >= 0),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

create table public.practice_sessions (
  id text not null check (char_length(id) between 1 and 120),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null check (char_length(lesson_id) between 1 and 200),
  accuracy numeric(5, 2) not null check (accuracy between 0 and 100),
  bpm numeric(7, 2) check (bpm > 0),
  speed numeric(5, 3) check (speed > 0 and speed <= 2),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  settings_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings_json) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

create table public.song_projects (
  id text not null check (char_length(id) between 1 and 120),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_json jsonb not null check (jsonb_typeof(project_json) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Ownership lookups and account deletion both use these indexes.
create index practice_sessions_user_created_idx
  on public.practice_sessions (user_id, created_at desc);
create index song_projects_user_updated_idx
  on public.song_projects (user_id, updated_at desc);

alter table public.profiles enable row level security;
alter table public.skill_progress enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.user_settings enable row level security;
alter table public.song_projects enable row level security;

-- The publishable key may be used by guests, but guests cannot access these
-- private tables. Every authenticated operation is restricted to its owner.
revoke all on public.profiles, public.skill_progress,
  public.practice_sessions, public.user_settings, public.song_projects
  from public, anon;
grant select, insert, update, delete on public.profiles,
  public.skill_progress, public.practice_sessions, public.user_settings,
  public.song_projects to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy profiles_delete_own on public.profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy skill_progress_select_own on public.skill_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy skill_progress_insert_own on public.skill_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy skill_progress_update_own on public.skill_progress
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy skill_progress_delete_own on public.skill_progress
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy practice_sessions_select_own on public.practice_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy practice_sessions_insert_own on public.practice_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy practice_sessions_update_own on public.practice_sessions
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy practice_sessions_delete_own on public.practice_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy user_settings_select_own on public.user_settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy user_settings_insert_own on public.user_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy user_settings_update_own on public.user_settings
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy user_settings_delete_own on public.user_settings
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy song_projects_select_own on public.song_projects
  for select to authenticated using ((select auth.uid()) = user_id);
create policy song_projects_insert_own on public.song_projects
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy song_projects_update_own on public.song_projects
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy song_projects_delete_own on public.song_projects
  for delete to authenticated using ((select auth.uid()) = user_id);
