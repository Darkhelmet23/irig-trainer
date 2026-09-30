import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthService,normalizeAccount,browserRedirectUrl} from '../public/auth/auth-service.js';
import {loadSupabaseClient,validatePublicConfig} from '../public/auth/supabase-client.js';
import {createSettingsRepository,createPracticeRepository,createMigrationRepository} from '../public/data/local-repositories.js';
import {detectLocalProgress} from '../public/data/migration.js';
import {publicSupabaseConfig} from '../server.js';

const memory=()=>{const data=new Map();return {read:(key,fallback)=>data.has(key)?data.get(key):fallback,save:(key,value)=>data.set(key,value),data};};
const user={id:'user-1',email:'player@example.com',user_metadata:{display_name:'Player'},app_metadata:{providers:['google','email']},email_confirmed_at:'2026-01-01'};
function mockAuth(){
  const calls=[];let listener;
  const auth={
    onAuthStateChange(fn){listener=fn;return {data:{subscription:{unsubscribe(){calls.push('unsubscribe');}}}};},
    getSession:async()=>({data:{session:null},error:null}),
    signInWithOAuth:async(value)=>{calls.push(value);return {error:null};},
    signInWithPassword:async(value)=>{calls.push(value);return {data:{session:{user}},error:null};},
    signUp:async(value)=>{calls.push(value);return {data:{user},error:null};},
    resetPasswordForEmail:async(...value)=>{calls.push(value);return {error:null};},
    updateUser:async(value)=>{calls.push(value);return {error:null};},
    signOut:async(value)=>{calls.push(value);return {error:null};},
  };
  return {auth,calls,emit:(event,session)=>listener(event,session)};
}

test('guest session remains usable when Supabase is missing',async()=>{
  const service=createAuthService({loadClient:async()=>null});
  assert.equal((await service.initialize()).status,'guest');
  assert.equal(service.getSession().availability,'unconfigured');
  await assert.rejects(service.signInWithGoogle(),/not configured/);
  assert.deepEqual(publicSupabaseConfig({}),{configured:false});
});
test('account model normalizes and sanitizes malformed metadata',()=>{
  assert.equal(normalizeAccount(null).status,'guest');
  const result=normalizeAccount({user:{...user,user_metadata:{display_name:'<b>Player</b>',avatar_url:'javascript:alert(1)'},app_metadata:{providers:['google',{},'unknown','email','google']}}});
  assert.deepEqual(result.user.providers,['google','email']);
  assert.equal(result.user.avatarUrl,null);
  assert.equal(result.user.displayName,'<b>Player</b>');
  assert.equal(result.user.emailVerified,true);
  assert.equal(normalizeAccount({user:{id:'\u0000',user_metadata:['bad']}}).status,'guest');
});
test('OAuth provider selection uses one service and safe redirect',async()=>{
  const sdk=mockAuth(),service=createAuthService({loadClient:async()=>sdk,redirectUrl:()=> 'https://trainer.example/app'});
  await service.signInWithApple();await service.signInWithGoogle();await service.signInWithFacebook();
  assert.deepEqual(sdk.calls.map(x=>x.provider),['apple','google','facebook']);
  assert.deepEqual(sdk.calls.map(x=>x.options.redirectTo),Array(3).fill('https://trainer.example/app'));
  await assert.rejects(service.signInWithProvider('other'),/supported/);
  assert.equal(browserRedirectUrl({protocol:'https:',origin:'https://trainer.example',pathname:'/app',hash:'#tree'}),'https://trainer.example/app');
});
test('email sign-in, signup, recovery and sign-out preserve independent local data',async()=>{
  const sdk=mockAuth(),service=createAuthService({loadClient:async()=>sdk,redirectUrl:()=> 'https://trainer.example/'});
  const storage=memory();storage.save('irig-live',{xp:210});
  await service.signInWithEmail('player@example.com','longpassword');
  assert.equal(service.getSession().user.email,'player@example.com');
  assert.equal((await service.signUpWithEmail('new@example.com','longpassword')).needsEmailVerification,true);
  await service.forgotPassword('player@example.com');
  await service.updatePassword('newpassword');
  await service.signOut();
  assert.equal(service.getSession().status,'guest');
  assert.deepEqual(storage.read('irig-live',null),{xp:210});
  assert.deepEqual(sdk.calls.at(-1),{scope:'local'});
});
test('session restoration and auth events update only account state',async()=>{
  const sdk=mockAuth(),service=createAuthService({loadClient:async()=>sdk});
  const events=[];service.subscribe((state,event)=>events.push([event,state.status]));
  await service.initialize();sdk.emit('SIGNED_IN',{user});sdk.emit('TOKEN_REFRESHED',{user});sdk.emit('SIGNED_OUT',null);
  assert.deepEqual(events.slice(-3),[['SIGNED_IN','authenticated'],['TOKEN_REFRESHED','authenticated'],['SIGNED_OUT','guest']]);
  service.dispose();assert.equal(sdk.calls.at(-1),'unsubscribe');
});
test('browser config accepts public keys only and missing configuration does not import SDK',async()=>{
  const publishable='sb_publishable_'+ 'a'.repeat(24);
  assert.equal(publicSupabaseConfig({SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:publishable}).configured,true);
  const serviceKey=['x',Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url'),'y'].join('.');
  assert.equal(publicSupabaseConfig({SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:serviceKey}).configured,false);
  assert.throws(()=>validatePublicConfig({configured:true,url:'https://example.supabase.co',anonKey:serviceKey}),/public Supabase key/);
  let imported=false;
  const client=await loadSupabaseClient({fetchConfig:async()=>({ok:true,json:async()=>({configured:false})}),importSdk:async()=>{imported=true;}});
  assert.equal(client,null);assert.equal(imported,false);
});
test('settings and practice repositories retain existing keys and records',()=>{
  const storage=memory(),settings=createSettingsRepository({storage}),practice=createPracticeRepository({storage});
  settings.saveDevice({tuningId:'drop-d'});settings.savePractice({countInBars:2});
  practice.saveGoals([{id:'goal'}]);practice.saveCheckpoints({verse:{rank:'Gold'}});
  assert.deepEqual(storage.read('irig-settings',null),{tuningId:'drop-d'});
  assert.deepEqual(settings.loadPractice(),{countInBars:2});
  assert.deepEqual(practice.loadGoals(),[{id:'goal'}]);
  assert.equal(practice.loadCheckpoints().verse.rank,'Gold');
});
test('local progress detection finds profiles, projects and imported songs without changing them',async()=>{
  const saved={xp:90,sessions:1},profileStore={loadSaved:mode=>mode==='live'?saved:null};
  const songProjects={listProjects:async()=>[{id:'song'}]};
  const result=await detectLocalProgress({profileStore,songProjects,loadImportedSongs:async()=>[{id:'import'}]});
  assert.equal(result.found,true);assert.equal(result.sources.live,true);
  assert.equal(result.sources.projects,1);assert.equal(result.sources.importedSongs,1);
  assert.deepEqual(saved,{xp:90,sessions:1});
});
test('migration decisions are per account and never perform a sync',()=>{
  const storage=memory(),migration=createMigrationRepository({storage});
  assert.equal(migration.get('user-1'),null);
  assert.equal(migration.set('user-1','pending-sync').choice,'pending-sync');
  assert.equal(migration.get('user-2'),null);
  assert.equal(migration.set('user-2','keep-local').choice,'keep-local');
  assert.equal(migration.get('user-1').choice,'pending-sync');
  assert.throws(()=>migration.set('user-1','overwrite'),/valid local progress/);
});
