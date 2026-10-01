import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('signed-in account restores higher cloud XP, adopts guest history by choice, and syncs project JSON', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('irig-mode', JSON.stringify('live'));
    localStorage.setItem('irig-live', JSON.stringify({ version: 3, skills: {},
      skillXP: { 'fundamentals-strings': 250 }, masteryChallenges: {}, xp: 250, sessions: 1,
      history: [{ id: 'guest-run', title: 'Strings', lessonId: 'fundamentals-strings',
        rank: 'Bronze', accuracy: 90, at: 1760000000000 }] }));
  });
  await page.route('**/api/auth-config', route => route.fulfill({ json: {
    configured: true, url: 'https://example.supabase.co', anonKey: 'sb_publishable_' + 'a'.repeat(24),
  } }));
  await page.route('**/vendor/supabase-sdk.js', route => route.fulfill({ contentType: 'text/javascript', body: `
    export function createClient(){
      let listener;
      const user={id:'mock-user',email:'player@example.com',email_confirmed_at:'2026-01-01',
        user_metadata:{display_name:'Player'},app_metadata:{providers:['email']}};
      window.cloudRows={profile:null,skills:[{skill_id:'fundamentals-strings',xp:500}],sessions:[],settings:null,projects:[]};
      const rows=window.cloudRows;
      return {auth:{
        onAuthStateChange(fn){listener=fn;return {data:{subscription:{unsubscribe(){}}}}},
        async getSession(){return {data:{session:localStorage.getItem('mock-authenticated')?{user}:null},error:null}},
        async signInWithPassword(){localStorage.setItem('mock-authenticated','yes');listener('SIGNED_IN',{user});return {data:{session:{user}},error:null}},
        async getUserIdentities(){return {data:{identities:[{provider:'email'}]},error:null}}
      },
      from(table){return {select(){return {eq(){return {async range(){
        const map={profiles:rows.profile?[rows.profile]:[],skill_progress:rows.skills,
          practice_sessions:rows.sessions,user_settings:rows.settings?[rows.settings]:[],song_projects:rows.projects};
        return {data:map[table]||[],error:null};
      }}}}},async upsert(value){if(table==='practice_sessions'&&!rows.sessions.some(item=>item.id===value.id))rows.sessions.push(value);
        return {data:null,error:null}}}},
      async rpc(name,args){
        if(name==='sync_skill_xp'){const item=rows.skills.find(item=>item.skill_id===args.p_skill_id);
          if(item)item.xp=Math.max(item.xp,args.p_xp);else rows.skills.push({skill_id:args.p_skill_id,xp:args.p_xp});
          return {data:rows.skills.find(item=>item.skill_id===args.p_skill_id).xp,error:null}}
        if(name==='sync_live_profile'){rows.profile={profile_json:args.p_profile};return {data:args.p_profile,error:null}}
        if(name==='sync_user_settings'){rows.settings={settings_json:args.p_settings,updated_at:args.p_updated_at};return {data:args.p_settings,error:null}}
        if(name==='sync_song_project'){const item={id:args.p_id,project_json:args.p_project,updated_at:args.p_modified_at};
          const index=rows.projects.findIndex(entry=>entry.id===item.id);if(index<0)rows.projects.push(item);else rows.projects[index]=item;
          return {data:args.p_project,error:null}}
        throw Error('Unexpected RPC: '+name)
      }};
    }` }));
  await page.goto('/');
  await page.locator('#account-open').click();
  await page.locator('#account-email [name=email]').fill('player@example.com');
  await page.locator('#account-email [name=password]').fill('longpassword');
  await page.locator('#account-email button[value="sign-in"]').click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('irig-cloud-live-v1:mock-user'))?.skillXP?.['fundamentals-strings']))
    .toBe(500);
  expect(await page.evaluate(() => window.cloudRows.sessions.length)).toBe(0);
  await page.getByRole('button', { name: 'Sync local progress to my account' }).click();
  await expect.poll(() => page.evaluate(() => window.cloudRows.sessions.length)).toBe(1);
  expect(await page.evaluate(() => window.cloudRows.skills[0].xp)).toBe(500);
  await expect(page.locator('[data-sync-status]')).toContainText('Saved online');
  await page.getByRole('button', { name: 'Close account' }).click();
  await page.locator('[data-page="studio"]').click();
  await page.locator('[data-studio-new="blank"]').click();
  await expect.poll(() => page.evaluate(() => window.cloudRows.projects.length)).toBe(1);
  expect(await page.evaluate(() => window.cloudRows.projects[0].project_json.recordings)).toEqual([]);
});
