import test from 'node:test';
import assert from 'node:assert/strict';
import {createDrill} from '../public/drills.js';
import {analyzeSession,dashboardCoachMarkup,nextPractice,weakSpotWarmup} from '../public/session-coach.js';

test('session report measures timing bias and ranks difficult song measures',()=>{
  const session={
    events:[
      {midi:60,status:'miss',deltaMs:-130,measure:2,wrongAttempts:1},
      {midi:62,status:'hit',deltaMs:-70,measure:2},
      {midi:64,status:'hit',deltaMs:20,measure:3},
      {midi:65,status:'hit',deltaMs:110,measure:3},
      {midi:67,status:'miss',deltaMs:999,measure:3,passive:true},
    ],
    rule:{mode:'flow',bpm:80},accuracyMode:'both',skill:{title:'Song',timed:true},hits:3,total:4,
  };
  const report=analyzeSession(session,{accuracy:75},[{title:'Song',accuracy:70,bpm:70,trace:[-200]}]);
  assert.equal(report.timing.samples,4);
  assert.equal(report.timing.bias,-17);
  assert.equal(report.weakest.measure,2);
  assert.equal(report.strongest.measure,3);
  assert.match(report.recommendation,/Loop measure 2/);
  assert.match(report.personalBestMessage,/up from 70%/);
  assert.equal(report.timing.bins.reduce((count,bin)=>count+bin.count,0),4);
});

test('weak-spot warm-up uses repeated misses and the selected tuning',()=>{
  const profile={history:[
    {targets:[{string:4,fret:7,hit:false}]},
    {targets:[{string:4,fret:7,hit:true},{string:6,fret:2,hit:true}]},
  ]};
  const tuning=[42,47,52,57,62,67];
  const warmup=weakSpotWarmup(profile,tuning);
  assert.equal(warmup.title,'Weak-spot warm-up');
  assert.deepEqual(warmup.tuning,tuning);
  assert.ok(warmup.sequence.some(event=>event.string===4&&event.fret===7&&event.midi===64));
  assert.equal(createDrill('warmup',{profile,tuning}).sequence.length,12);
});

test('new players receive a playable starter pattern that respects four-string tuning',()=>{
  const warmup=weakSpotWarmup({history:[]},[40,45,50,55]);
  assert.equal(warmup.title,'Starter warm-up');
  assert.ok(warmup.sequence.every(event=>event.string<=4));
});

test('dashboard coach shows the recent timing trend and targeted recommendation safely',()=>{
  const profile={history:Array.from({length:2},(_,index)=>({
    title:'<script>song</script>',rank:'Silver',accuracy:65,passed:false,bpm:70,timingMode:'flow',trace:[-180,-70,-100],
    targets:[{key:'position:5:3',label:'String 5 · fret 3',hit:false,string:5,fret:3,measure:1}],
  }))};
  const html=dashboardCoachMarkup(profile);
  assert.match(html,/biggest recent weak spot is String 5/);
  assert.match(html,/data-hub-drill="warmup"/);
  assert.match(html,/Early &gt;150 ms/);
  assert.doesNotMatch(html,/<script>/);
});

test('speed ladder advances only after the accuracy threshold',()=>{
  const lesson={skill:{timed:true,speed:.6,bpm:60,sequence:[{offsetMs:0,durationMs:1000}]},loopRound:1};
  const session={skill:lesson.skill,practiceOptions:{speedLadder:true},rule:{bpm:60}};
  assert.match(nextPractice(lesson,session,{accuracy:95}),/70%/);
  assert.equal(lesson.skill.speed,.7);
  assert.equal(nextPractice({skill:{speed:.6,timed:true},loopRound:1},session,{accuracy:89}),null);
});

test('scale tempo ladder starts at sixty percent and raises BPM after accurate rounds',()=>{
  const skill=createDrill('scale',{root:'E',scale:'Minor pentatonic',tempoLadder:true,bpm:80});
  const lesson={skill,options:{progressionPractice:true},loopRound:1},session={skill,practiceOptions:lesson.options,rule:{mode:'flow',bpm:skill.bpm}};
  assert.equal(skill.bpm,48);assert.equal(skill.tempoStage,0);
  assert.match(nextPractice(lesson,session,{accuracy:95}),/70% \(56 BPM\)/);
  assert.equal(lesson.skill.tempoStage,1);assert.equal(lesson.skill.bpm,56);assert.equal(lesson.skill.sequence[1].offsetMs,60000/56);
  session.skill=lesson.skill;assert.match(nextPractice(lesson,session,{accuracy:95}),/80% \(64 BPM\)/);
  const paused={skill:createDrill('scale',{tempoLadder:true,bpm:80}),options:{progressionPractice:true},loopRound:1};
  assert.equal(nextPractice(paused,{skill:paused.skill,practiceOptions:paused.options},{accuracy:89}),null);
});
