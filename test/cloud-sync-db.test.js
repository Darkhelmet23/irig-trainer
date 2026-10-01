import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

test("cloud sync migration enforces ownership and atomic MAX XP", async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated;
      create table storage.objects(owner_id text);`);
    for (const name of ["20261001012726_initial_private_data.sql",
      "20261001032929_merge_accounts.sql", "20261001164217_cloud_sync_schema.sql"])
      await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
    await db.exec(`insert into auth.users values ('${A}'),('${B}');
      set role authenticated;
      select set_config('request.jwt.claim.sub','${A}',false);`);
    assert.equal((await db.query(`select public.sync_skill_xp('${A}','chords',500) as xp`)).rows[0].xp, 500);
    assert.equal((await db.query(`select public.sync_skill_xp('${A}','chords',250) as xp`)).rows[0].xp, 500);
    await assert.rejects(() => db.query(`select public.sync_skill_xp('${B}','chords',900)`), /Invalid skill progress/);
    await assert.rejects(() => db.query(`insert into public.practice_sessions(id,user_id,lesson_id,accuracy)
      values('foreign','${B}','lesson',90)`), /row-level security/);
    assert.equal((await db.query(`select count(*)::int as n from public.skill_progress where user_id='${B}'`)).rows[0].n, 0);
    const profile = await db.query(`select public.sync_live_profile('${A}',
      '{"xp":50,"sessions":1,"skills":{"chords":2},"masteryChallenges":{"songs":true}}'::jsonb) as value`);
    assert.equal(profile.rows[0].value.xp, 50);
    const merged = await db.query(`select public.sync_live_profile('${A}',
      '{"xp":20,"sessions":0,"skills":{"chords":1},"masteryChallenges":{}}'::jsonb) as value`);
    assert.equal(merged.rows[0].value.xp, 50);
    assert.equal(merged.rows[0].value.skills.chords, 2);
    assert.equal(merged.rows[0].value.masteryChallenges.songs, true);
    const latest = "2026-10-01T12:00:00Z", older = "2026-09-30T12:00:00Z";
    await db.query(`select public.sync_song_project('${A}','song-one',
      '{"id":"song-one","title":"Latest"}'::jsonb,'${latest}')`);
    const song = await db.query(`select public.sync_song_project('${A}','song-one',
      '{"id":"song-one","title":"Old"}'::jsonb,'${older}') as value`);
    assert.equal(song.rows[0].value.title, "Latest");
    await db.query(`select public.sync_user_settings('${A}',
      '{"practice":{"countInBars":2}}'::jsonb,'${latest}')`);
    const settings = await db.query(`select public.sync_user_settings('${A}',
      '{"practice":{"countInBars":1}}'::jsonb,'${older}') as value`);
    assert.equal(settings.rows[0].value.practice.countInBars, 2);
    await db.exec(`reset role;
      insert into public.practice_sessions(id,user_id,lesson_id,accuracy,session_json)
        values ('secondary-run','${B}','lesson',91,'{"title":"Other run","rank":"Gold","accuracy":91}');
      insert into public.song_projects(id,user_id,project_json)
        values ('secondary-song','${B}','{"id":"secondary-song","title":"Other song"}');`);
    await db.query(`select public.merge_user_data('${A}','${B}')`);
    assert.equal((await db.query(`select session_json->>'title' as title from public.practice_sessions
      where user_id='${A}' and id='secondary-run'`)).rows[0].title, "Other run");
    assert.equal((await db.query(`select project_json->>'title' as title from public.song_projects
      where user_id='${A}' and id='secondary-song'`)).rows[0].title, "Other song");
  } finally { await db.close(); }
});
