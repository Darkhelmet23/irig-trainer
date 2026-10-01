import {test,expect} from '@playwright/test';

// Keep external-auth mocks deterministic across reloads; the PWA cache is
// covered by the existing dedicated service-worker test.
test.use({serviceWorkers:'block'});

test('account screen offers Google, Facebook, email, recovery and guest access',async({page})=>{
  await page.goto('/');
  await page.locator('#account-open').click();
  await expect(page.locator('#account-dialog')).toHaveAttribute('open','');
  for(const provider of ['Google','Facebook'])
    await expect(page.getByRole('button',{name:`Continue with ${provider}`})).toBeVisible();
  await expect(page.getByRole('button',{name:'Continue with Apple'})).toHaveCount(0);
  await expect(page.locator('#account-email [name=email]')).toBeVisible();
  await expect(page.locator('#account-email [name=password]')).toBeVisible();
  await expect(page.getByRole('button',{name:'Create account'})).toBeVisible();
  await page.getByRole('button',{name:'Forgot password?'}).click();
  await expect(page.locator('#account-forgot')).toBeVisible();
  await page.getByRole('button',{name:'Back to sign in'}).click();
  await page.getByRole('button',{name:'Continue without an account'}).click();
  await expect(page.locator('#account-dialog')).not.toHaveAttribute('open','');
  await expect(page.getByRole('heading',{name:'Guitar skill tree'})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await page.locator('#account-open').click();
  await expect(page.getByRole('button',{name:'Continue with Google'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('unconfigured authentication reports a useful error while guest practice remains open',async({page})=>{
  await page.route('**/api/auth-config',route=>route.fulfill({json:{configured:false}}));
  await page.goto('/');await page.locator('#account-open').click();
  await page.getByRole('button',{name:'Continue with Google'}).click();
  await expect(page.locator('#account-message')).toContainText('not configured');
  await page.getByRole('button',{name:'Continue without an account'}).click();
  await page.locator('#practice-related').click();
  await expect(page.locator('[data-progression-lesson="tabs-0"]')).toBeVisible();
});

test('mocked sign-in offers a migration choice and never overwrites local progress',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('irig-demo',JSON.stringify({version:1,xp:155,sessions:2,history:[]})));
  await page.route('**/api/auth-config',route=>route.fulfill({json:{configured:true,url:'https://example.supabase.co',anonKey:'sb_publishable_'+'a'.repeat(24)}}));
  await page.route('**/vendor/supabase-sdk.js',route=>route.fulfill({contentType:'text/javascript',body:`
    export function createClient(){
      let listener;const user={id:'mock-user',email:'player@example.com',user_metadata:{display_name:'Guitar Player'},app_metadata:{providers:['email']},email_confirmed_at:'2026-01-01'};
      return {auth:{
        onAuthStateChange(fn){listener=fn;return {data:{subscription:{unsubscribe(){}}}}},
        async getSession(){return {data:{session:localStorage.getItem('mock-authenticated')?{user}:null},error:null}},
        async signInWithPassword(){const session={user};localStorage.setItem('mock-authenticated','yes');listener('SIGNED_IN',session);return {data:{session},error:null}},
        async signOut(){localStorage.removeItem('mock-authenticated');listener('SIGNED_OUT',null);return {error:null}}
      }};
    }` }));
  await page.goto('/');await page.locator('#account-open').click();
  await page.locator('#account-email [name=email]').fill('player@example.com');
  await page.locator('#account-email [name=password]').fill('longpassword');
  await page.locator('#account-email button[value="sign-in"]').click();
  await expect(page.locator('#account-status')).toHaveText('Guitar Player');
  await expect(page.locator('.account-migration')).toContainText('We found practice progress');
  await page.getByRole('button',{name:'Keep local progress separate'}).click();
  await expect(page.locator('.account-migration')).toContainText('stay separate');
  const saved=await page.evaluate(()=>({profile:JSON.parse(localStorage.getItem('irig-demo')),migration:JSON.parse(localStorage.getItem('irig-account-migration-v1'))}));
  expect(saved.profile.xp).toBe(155);
  expect(saved.migration['mock-user'].choice).toBe('keep-local');
  await page.reload();
  await expect(page.locator('#account-status')).toHaveText('Guitar Player');
  await page.locator('#account-open').click();
  await expect(page.locator('.account-migration')).toContainText('stay separate');
  await page.getByRole('button',{name:'Sign out'}).click();
  await expect(page.locator('#account-status')).toHaveText('Guest / Local player');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('irig-demo')).xp)).toBe(155);
});

test('offline guest can open local lessons and Song Studio',async({page,context})=>{
  await page.goto('/');await context.setOffline(true);
  await page.locator('#account-open').click();
  await expect(page.locator('.account-offline')).toContainText('Offline');
  await page.getByRole('button',{name:'Continue without an account'}).click();
  await page.locator('#practice-related').click();
  await expect(page.locator('[data-progression-lesson="tabs-0"]')).toBeVisible();
  await page.locator('[data-page="studio"]').click();
  await expect(page.getByRole('heading',{name:/Song Studio|Create/})).toBeVisible();
});

test('signed-in methods connect, report conflicts, and disconnect only when another method remains',async({page})=>{
  await page.route('**/api/auth-config',route=>route.fulfill({json:{configured:true,url:'https://example.supabase.co',anonKey:'sb_publishable_'+'a'.repeat(24)}}));
  await page.route('**/vendor/supabase-sdk.js',route=>route.fulfill({contentType:'text/javascript',body:`
    export function createClient(){
      let listener;
      const user={id:'main-user',email:'player@example.com',user_metadata:{display_name:'Player'},app_metadata:{providers:['email']},email_confirmed_at:'2026-01-01'};
      const identities=[{id:'email-id',provider:'email'}];
      window.identityCalls=[];
      window.facebookConflict=false;
      window.setIdentities=(next)=>identities.splice(0,identities.length,...next);
      return {auth:{
        onAuthStateChange(fn){listener=fn;return {data:{subscription:{unsubscribe(){}}}}},
        async getSession(){return {data:{session:null},error:null}},
        async signInWithPassword(){const session={user};listener('SIGNED_IN',session);return {data:{session},error:null}},
        async getUserIdentities(){return {data:{identities:[...identities]},error:null}},
        async linkIdentity(value){window.identityCalls.push({kind:'link',provider:value.provider});
          if(value.provider==='facebook'&&window.facebookConflict)return {error:{code:'identity_already_exists',message:'private details'}};
          identities.push({id:value.provider+'-id',provider:value.provider});return {error:null}},
        async unlinkIdentity(identity){window.identityCalls.push({kind:'unlink',id:identity.id});
          identities.splice(identities.indexOf(identity),1);return {error:null}}
      }};
    }` }));
  await page.goto('/');await page.locator('#account-open').click();
  await page.locator('#account-email [name=email]').fill('player@example.com');
  await page.locator('#account-email [name=password]').fill('longpassword');
  await page.locator('#account-email button[value="sign-in"]').click();
  await expect(page.locator('.account-methods')).toContainText('Email/password');
  await expect(page.locator('.account-methods')).toContainText('Not connected');
  await page.getByRole('button',{name:'Connect Google'}).click();
  await expect(page.getByRole('button',{name:'Disconnect Google'})).toBeEnabled();
  await page.evaluate(()=>{window.facebookConflict=true});
  await page.getByRole('button',{name:'Connect Facebook'}).click();
  await expect(page.locator('#account-message')).toHaveText('This Facebook account is already connected to another iRig Trainer account.');
  await page.evaluate(()=>{window.facebookConflict=false});
  await page.getByRole('button',{name:'Connect Facebook'}).click();
  await expect(page.getByRole('button',{name:'Disconnect Facebook'})).toBeEnabled();
  await page.getByRole('button',{name:'Disconnect Google'}).click();
  await expect(page.getByRole('button',{name:'Connect Google'})).toBeVisible();
  expect(await page.evaluate(()=>window.identityCalls)).toEqual([
    {kind:'link',provider:'google'},
    {kind:'link',provider:'facebook'},
    {kind:'link',provider:'facebook'},
    {kind:'unlink',id:'google-id'},
  ]);
  await page.evaluate(()=>window.setIdentities([{id:'facebook-id',provider:'facebook'}]));
  await page.getByRole('button',{name:'Close account'}).click();
  await page.locator('#account-open').click();
  await expect(page.getByRole('button',{name:'Disconnect Facebook'})).toBeDisabled();
});

test('identity conflict returned after OAuth redirects is shown without raw provider details',async({page})=>{
  await page.route('**/api/auth-config',route=>route.fulfill({json:{configured:true,url:'https://example.supabase.co',anonKey:'sb_publishable_'+'a'.repeat(24)}}));
  await page.route('**/vendor/supabase-sdk.js',route=>route.fulfill({contentType:'text/javascript',body:`
    export function createClient(){return {auth:{
      onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}},
      async getSession(){return {data:{session:null},error:null}}
    }}}` }));
  await page.goto('/?error=server_error&error_code=identity_already_exists&error_description=%3Cscript%3E');
  await expect(page.locator('#account-dialog')).toHaveAttribute('open','');
  await expect(page.locator('#account-message')).toHaveText('That sign-in account is already connected to another iRig Trainer account.');
  await expect(page.locator('#account-message')).not.toContainText('<script>');
});
