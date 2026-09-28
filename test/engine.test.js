import test from 'node:test';
import assert from 'node:assert/strict';
import {SKILLS,RULES,CHORDS,skillById} from '../public/curriculum.js';
import {emptyProfile,sanitizeProfile,unlocked,boostTotal,scoreResult,award,makeSession,advanceMisses,attempt,validatePack} from '../public/engine.js';
import {detectPitch,detectChord,midiHz} from '../public/audio.js';
import {createServer} from '../server.js';

test('every skill has playable events and dependencies come before it',()=>{
  assert.equal(SKILLS.length,32);
  for(const s of SKILLS){assert.ok(s.guide.length>30);assert.ok(s.sequence.length);if(s.requires)assert.ok(SKILLS.indexOf(skillById(s.requires))<SKILLS.indexOf(s));for(const e of s.sequence)assert.ok(e.chord?CHORDS[e.chord]:Number.isFinite(e.midi));}
});
test('Bronze unlocks the next skill; ranks cannot be skipped or farmed',()=>{
  const p=emptyProfile(),first=SKILLS[0],next=SKILLS[1];assert.equal(unlocked(next,p),false);
  assert.equal(award(p,first,RULES[2],{passed:true}),false);
  assert.equal(award(p,first,RULES[0],{passed:false}),false);
  assert.equal(award(p,first,RULES[0],{passed:true}),true);assert.equal(unlocked(next,p),true);
  assert.equal(award(p,first,RULES[0],{passed:true}),false);assert.equal(p.xp,100);
  for(const rule of RULES.slice(1))assert.equal(award(p,first,rule,{passed:true}),true);
  assert.equal(p.skills[first.id],4);assert.equal(p.xp,1000);
});
test('top three buffs replace lower tiers and cap at 15%',()=>{
  const p=emptyProfile();p.skills={'tabs-0':4,'tabs-1':4,'tabs-2':4,'tabs-3':4};assert.equal(boostTotal(p),15);
  p.skills={'tabs-0':1,'chords-0':3};assert.equal(boostTotal(p),4);
});
test('accuracy gates ignore buffs and Diamond also requires beating the AI',()=>{
  const score=(hits,boost=0)=>scoreResult({hits,total:100,attempts:100,mode:'battle',boost,ai:94,threshold:90});
  assert.equal(score(89,15).passed,false);assert.equal(score(90,0).passed,false);assert.equal(score(94,0).passed,false);assert.equal(score(90,5).passed,true);
  assert.equal(scoreResult({hits:12,total:12,attempts:24,mode:'wait',threshold:75}).accuracy,50);
});
test('guided mode waits, counts wrong attempts, rejects early and repeated events',()=>{
  const s=makeSession(SKILLS[0],RULES[0],emptyProfile(),0);
  assert.equal(attempt(s,true,2900),false);assert.equal(s.index,0);
  advanceMisses(s,100000);assert.equal(s.index,0);
  assert.equal(attempt(s,false,3000),true);assert.equal(s.index,0);assert.equal(s.attempts,1);
  assert.equal(attempt(s,true,3100),false);assert.equal(attempt(s,true,3200),true);assert.equal(s.index,1);
});
test('flow consumes a wrong note, misses late events, and ends after the last window',()=>{
  const s=makeSession(SKILLS[0],RULES[1],emptyProfile(),0);
  assert.equal(attempt(s,false,3000),true);assert.equal(s.index,1);assert.equal(s.events[0].status,'wrong');
  const second=s.events[1];attempt(s,true,second.at);assert.equal(s.hits,1);
  advanceMisses(s,s.events.at(-1).at+s.rule.window+1);assert.equal(s.ended,true);assert.equal(s.index,s.events.length);assert.equal(s.events.at(-1).status,'miss');
});
test('saved progress sanitizes corrupt tiers and locked descendants',()=>{
  const p=sanitizeProfile({version:1,skills:{'tabs-0':6,'tabs-1':4,'chords-0':2},xp:-4,sessions:1});assert.equal(p.skills['tabs-1'],undefined);assert.equal(p.skills['chords-0'],2);assert.equal(p.xp,0);
  assert.deepEqual(sanitizeProfile(null),emptyProfile());
  assert.deepEqual(sanitizeProfile({version:1,history:[null,1,{},'broken']}).history,[]);
});
test('lesson packs validate license, URL, notes and length without trusting supplied MIDI',()=>{
  const base={version:1,title:'Study',author:'Test',source:'https://example.com/study',license:'CC0-1.0',sequence:Array(4).fill({string:6,fret:0,midi:99})};
  assert.equal(validatePack(base).sequence[0].midi,40);
  for(const override of [{license:'All rights reserved'},{source:'javascript:alert(1)'},{sequence:[{fret:99}]},{sequence:Array(4).fill({chord:'H9'})},{author:''}])assert.throws(()=>validatePack({...base,...override}));
});
test('YIN detects every open string and fretted notes at common audio sample rates',()=>{
  for(const rate of [44100,48000])for(const midi of [40,45,50,55,59,64,67,72,76]){
    const wave=Float32Array.from({length:8192},(_,i)=>.18*Math.sin(2*Math.PI*midiHz(midi)*i/rate)+.06*Math.sin(4*Math.PI*midiHz(midi)*i/rate));
    const result=detectPitch(wave,rate);assert.equal(result.midi,midi,`MIDI ${midi} at ${rate}`);assert.ok(Math.abs(result.cents)<5);
  }
  assert.equal(detectPitch(new Float32Array(8192),48000).midi,null);
});
function synthesizeSpectrum(notes) {
  const count=8192,real=new Float64Array(count),imag=new Float64Array(count);
  for(let i=0;i<count;i++){
    let sample=0;
    for(const note of notes)for(let harmonic=1;harmonic<=5;harmonic++)sample+=Math.sin(2*Math.PI*440*2**((note-69)/12)*harmonic*i/48000)/(harmonic**1.2*notes.length);
    real[i]=sample*(.42-.5*Math.cos(2*Math.PI*i/count)+.08*Math.cos(4*Math.PI*i/count));
  }
  // Independent radix-2 FFT over actual synthesized PCM, with the browser's Blackman window.
  for(let i=1,j=0;i<count;i++){let bit=count>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j)[real[i],real[j]]=[real[j],real[i]];}
  for(let size=2;size<=count;size*=2)for(let start=0;start<count;start+=size)for(let j=0;j<size/2;j++){
    const a=start+j,b=a+size/2,angle=-2*Math.PI*j/size,c=Math.cos(angle),s=Math.sin(angle),r=real[b]*c-imag[b]*s,im=real[b]*s+imag[b]*c;
    real[b]=real[a]-r;imag[b]=imag[a]-im;real[a]+=r;imag[a]+=im;
  }
  return Float32Array.from({length:count/2},(_,i)=>20*Math.log10(Math.max(1e-9,Math.hypot(real[i],imag[i])/count)));
}
test('chord classifier identifies independent synthesized PCM chords and rejects silence',()=>{
  for(const [name,notes]of Object.entries(CHORDS)){
    assert.equal(detectChord(synthesizeSpectrum(notes),48000,8192).chord,name,name);
  }
  assert.equal(detectChord(new Float32Array(4096).fill(-120),48000,8192).chord,null);
});
test('HTTP serves app assets, rejects traversal and unsupported methods',async()=>{
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{const base=`http://127.0.0.1:${server.address().port}`;const html=await fetch(base);assert.equal(html.status,200);assert.match(await html.text(),/iRig Trainer/);assert.equal((await fetch(base+'/audio.js')).status,200);assert.equal((await fetch(base+'/%2e%2e%5cpackage.json')).status,403);assert.equal((await fetch(base+'/absent')).status,404);assert.equal((await fetch(base,{method:'POST'})).status,405);}finally{await new Promise(resolve=>server.close(resolve));}
});
