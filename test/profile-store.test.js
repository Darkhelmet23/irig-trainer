import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfileStore} from '../public/profile-store.js';

test('profile store keeps demo and live saves separate when switching modes',()=>{
  const values=new Map([['irig-mode','demo'],['irig-demo',{value:'demo'}],['irig-live',{value:'live'}]]),writes=[];
  const store=createProfileStore({read:(key,fallback)=>values.has(key)?values.get(key):fallback,save:(key,value)=>{writes.push(key);values.set(key,value);},sanitizeProfile:raw=>({clean:true,...raw})});
  assert.equal(store.mode,'demo');assert.deepEqual(store.profile,{clean:true,value:'demo'});
  const live=store.switchTo('live');assert.equal(store.mode,'live');assert.deepEqual(live,{clean:true,value:'live'});
  live.sessions=2;store.persist('live',live);assert.equal(values.get('irig-live').sessions,2);assert.equal(values.get('irig-demo').value,'demo');
  assert.deepEqual(writes,['irig-mode','irig-live']);
});
