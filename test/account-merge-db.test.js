import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const primary = "00000000-0000-4000-8000-000000000001";
const secondary = "00000000-0000-4000-8000-000000000002";
const sql = (text) => text.replaceAll("$PRIMARY", primary).replaceAll("$SECONDARY", secondary);

test("database merge preserves the highest per-skill XP, both histories/projects, and primary preferences on retry", async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
      create table storage.objects(owner_id text);`);
    await db.exec(await readFile(new URL("../supabase/migrations/20261001012726_initial_private_data.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/20261001032929_merge_accounts.sql", import.meta.url), "utf8"));
    const grants = (await db.query(`select
      has_function_privilege('anon','public.merge_user_data(uuid,uuid)','EXECUTE') as anon,
      has_function_privilege('authenticated','public.merge_user_data(uuid,uuid)','EXECUTE') as authenticated,
      has_function_privilege('service_role','public.merge_user_data(uuid,uuid)','EXECUTE') as service`)).rows[0];
    assert.deepEqual(grants, { anon: false, authenticated: false, service: true });
    await db.exec(sql(`
      insert into auth.users values ('$PRIMARY'),('$SECONDARY');
      insert into public.profiles(user_id,display_name) values ('$PRIMARY','Main'),('$SECONDARY','Other');
      insert into public.user_settings(user_id,settings_json) values ('$PRIMARY','{"theme":"primary"}'),('$SECONDARY','{"theme":"other"}');
      insert into public.skill_progress(user_id,skill_id,xp) values
        ('$PRIMARY','tabs',500),('$PRIMARY','chords',100),('$PRIMARY','primary-only',75),
        ('$SECONDARY','tabs',100),('$SECONDARY','chords',500),('$SECONDARY','secondary-only',120);
      insert into public.practice_sessions(id,user_id,lesson_id,accuracy,created_at) values
        ('same','$PRIMARY','lesson-a',80,'2026-01-01'),
        ('same','$SECONDARY','lesson-a',80,'2026-01-01'),
        ('conflict','$PRIMARY','lesson-a',80,'2026-01-01'),
        ('conflict','$SECONDARY','lesson-b',90,'2026-01-02'),
        ('secondary-only','$SECONDARY','lesson-c',95,'2026-01-03');
      insert into public.song_projects(id,user_id,project_json,created_at,updated_at) values
        ('same','$PRIMARY','{"id":"same","title":"Shared"}','2026-01-01','2026-01-01'),
        ('same','$SECONDARY','{"id":"same","title":"Shared"}','2026-01-01','2026-01-02'),
        ('conflict','$PRIMARY','{"id":"conflict","title":"Primary"}','2026-01-01','2026-01-01'),
        ('conflict','$SECONDARY','{"id":"conflict","title":"Other"}','2026-01-01','2026-01-01'),
        ('secondary-only','$SECONDARY','{"id":"secondary-only","title":"New"}','2026-01-01','2026-01-01');
    `));
    const before = await db.query(sql("select public.merge_account_preview('$PRIMARY','$SECONDARY') as value"));
    assert.equal(before.rows[0].value.secondary.projects, 3);
    assert.equal((await db.query(sql("select count(*)::int as n from public.account_merge_operations where primary_user_id='$PRIMARY'"))).rows[0].n, 0);
    await db.query(sql("select public.merge_user_data('$PRIMARY','$SECONDARY')"));
    const skills = (await db.query(sql("select skill_id,xp,revision from public.skill_progress where user_id='$PRIMARY' order by skill_id"))).rows;
    assert.deepEqual(skills.map(({ skill_id, xp }) => [skill_id, xp]), [
      ["chords", 500], ["primary-only", 75], ["secondary-only", 120], ["tabs", 500],
    ]);
    assert.ok(skills.find((row) => row.skill_id === "tabs").revision > 1);
    const sessions = (await db.query(sql("select id,lesson_id from public.practice_sessions where user_id='$PRIMARY' order by id"))).rows;
    assert.equal(sessions.length, 4);
    assert.equal(sessions.filter((row) => row.lesson_id === "lesson-b").length, 1);
    const projects = (await db.query(sql("select id,project_json from public.song_projects where user_id='$PRIMARY' order by id"))).rows;
    assert.equal(projects.length, 4);
    assert.ok(projects.every((row) => row.id === row.project_json.id));
    assert.ok(projects.some((row) => row.project_json.title === "Other" && row.id !== "conflict"));
    assert.equal((await db.query(sql("select display_name from public.profiles where user_id='$PRIMARY'"))).rows[0].display_name, "Main");
    assert.equal((await db.query(sql("select settings_json from public.user_settings where user_id='$PRIMARY'"))).rows[0].settings_json.theme, "primary");
    await db.query(sql("select public.merge_user_data('$PRIMARY','$SECONDARY')"));
    assert.deepEqual((await db.query(sql("select skill_id,xp,revision from public.skill_progress where user_id='$PRIMARY' order by skill_id"))).rows, skills);
    assert.deepEqual((await db.query(sql("select id,lesson_id from public.practice_sessions where user_id='$PRIMARY' order by id"))).rows, sessions);
    assert.deepEqual((await db.query(sql("select id,project_json from public.song_projects where user_id='$PRIMARY' order by id"))).rows, projects);
  } finally { await db.close(); }
});

test("blank primary profile can be filled and secondary settings copy only when primary has none", async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create schema storage; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
      create table storage.objects(owner_id text);`);
    await db.exec(await readFile(new URL("../supabase/migrations/20261001012726_initial_private_data.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/20261001032929_merge_accounts.sql", import.meta.url), "utf8"));
    await db.exec(sql(`insert into auth.users values ('$PRIMARY'),('$SECONDARY');
      insert into public.profiles(user_id,display_name) values ('$PRIMARY',''),('$SECONDARY','Useful name');
      insert into public.user_settings(user_id,settings_json) values ('$SECONDARY','{"tuning":"drop-d"}');`));
    await db.query(sql("select public.merge_user_data('$PRIMARY','$SECONDARY')"));
    assert.equal((await db.query(sql("select display_name from public.profiles where user_id='$PRIMARY'"))).rows[0].display_name, "Useful name");
    assert.equal((await db.query(sql("select settings_json from public.user_settings where user_id='$PRIMARY'"))).rows[0].settings_json.tuning, "drop-d");
  } finally { await db.close(); }
});

test("database Storage preflight aborts before any app data moves", async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create schema storage; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
      create table storage.objects(owner_id text);`);
    await db.exec(await readFile(new URL("../supabase/migrations/20261001012726_initial_private_data.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/20261001032929_merge_accounts.sql", import.meta.url), "utf8"));
    await db.exec(sql(`insert into auth.users values ('$PRIMARY'),('$SECONDARY');
      insert into public.skill_progress(user_id,skill_id,xp) values ('$SECONDARY','chords',500);
      insert into storage.objects(owner_id) values ('$SECONDARY');`));
    await assert.rejects(() => db.query(sql("select public.merge_user_data('$PRIMARY','$SECONDARY')")), /CLOUD_FILES_UNSUPPORTED/);
    assert.equal((await db.query(sql("select count(*)::int as n from public.skill_progress where user_id='$PRIMARY'"))).rows[0].n, 0);
  } finally { await db.close(); }
});
