import test from 'node:test';
import assert from 'node:assert/strict';
import {onboardingStepFor} from '../public/onboarding.js';

test('first-run onboarding resumes its local step and stays dismissed',()=>{
  assert.equal(onboardingStepFor(null,false),'welcome');
  assert.equal(onboardingStepFor('tuning',true),'tuning');
  assert.equal(onboardingStepFor(null,true),null);
  assert.equal(onboardingStepFor('complete',false),null);
  assert.equal(onboardingStepFor('dismissed',false),null);
});

import {SONG_TIER_SPEEDS,songSpeedForTier,songTempoLabel,scaleSongSkill,suggestNextSongSpeed} from '../public/song-tempo.js';
import {songLesson} from '../public/songs.js';
import {skillById} from '../public/curriculum.js';
import {generatePracticeSequence} from '../public/lesson-patterns.js';
import {SKILL_TREE_GEOMETRY} from '../public/skill-tree-ui.js';
import fs from 'node:fs';
import {renderSongPreparation} from '../public/song-practice-ui.js';

test('song mastery tiers reduce imported tempo and preserve BPM plus percentage',()=>{
  assert.deepEqual(SONG_TIER_SPEEDS,[.6,.7,.85,1]);
  assert.equal(songSpeedForTier('Bronze'),.6);
  assert.equal(songSpeedForTier(2),.85);
  assert.deepEqual(songTempoLabel(120,.6),{bpm:72,percent:60});
  assert.deepEqual(songTempoLabel(120,.85),{bpm:102,percent:85});
});

test('song speed scaling preserves event timing and tempo suggestions require a clear threshold',()=>{
  const skill={speed:.6,originalBpm:120,bpm:72,sequence:[{offsetMs:0,durationMs:250},{offsetMs:500,durationMs:250}]};
  const faster=scaleSongSkill(skill,.7);
  assert.equal(faster.bpm,84);
  assert.equal(faster.sequence[1].offsetMs,500*.6/.7);
  assert.equal(suggestNextSongSpeed(.6,89),null);
  assert.equal(suggestNextSongSpeed(.6,92),.65);
  assert.equal(suggestNextSongSpeed(1,100),null);
});

test('multiple imported tempo changes scale opposite to synchronized event timing',()=>{
  const song={id:'multi-tempo',title:'Tempo Map',tempo:120,tempos:[{offsetMs:1000,bpm:120},{offsetMs:5000,bpm:90},{offsetMs:8000,bpm:150}],tracks:[{id:'lead',name:'Lead',playable:true,tuning:[64,59,55,50,45,40],capo:0,transposition:0,events:[1000,5000,8000].map((offsetMs,index)=>({measure:index+1,offsetMs,durationMs:500+index*100,notes:[{string:1,fret:index,midi:64+index}],techniques:[],rest:false}))}]};
  const atSixty=songLesson(song,'lead',{speed:.6});
  const atSeventy=scaleSongSkill(atSixty,.7);
  assert.equal(atSeventy.originalBpm,120);
  assert.equal(atSeventy.bpm,84);
  assert.deepEqual(atSeventy.tempos.map(({offsetMs,bpm})=>[Math.round(offsetMs*.7),Math.round(bpm)]),[[0,84],[4000,63],[7000,105]]);
  assert.deepEqual(atSeventy.sequence.map(({offsetMs})=>Math.round(offsetMs*.7)),[0,4000,7000]);
  assert.deepEqual(atSeventy.sequence.map(({durationMs},index)=>Math.round(durationMs*.7)),[500,600,700]);

  const atFull=songLesson(song,'lead',{speed:1}),atHalf=scaleSongSkill(atFull,.5);
  assert.equal(atHalf.bpm,60);
  assert.deepEqual(atHalf.tempos.map(({offsetMs,bpm})=>[Math.round(offsetMs),Math.round(bpm)]),[[0,60],[8000,45],[14000,75]]);
  assert.deepEqual(atHalf.sequence.map(({offsetMs})=>Math.round(offsetMs)),[0,8000,14000]);
  assert.deepEqual(atHalf.sequence.map(({durationMs})=>Math.round(durationMs)),[1000,1200,1400]);
});
test('song preparation displays the selected percentage and rounded original-tempo BPM',()=>{
  const skill={title:'Tempo map',originalBpm:190,bpm:114,speed:.6,sequence:[{measure:3},{measure:8}]};
  const html=renderSongPreparation({skill,accuracyGoal:80,countInBars:2,practiceMode:'guided',esc:value=>String(value)});
  for(const [speed,bpm,percent]of[[.6,114,60],[.7,133,70],[.85,162,85],[1,190,100]])assert.ok(html.includes(`value="${speed}"`)&&html.includes(`${percent}% &middot; ${bpm} BPM`));
  assert.match(html,/ORIGINAL<\/span><strong>190 BPM/);
  assert.match(html,/2 bars &middot; 8 beats/);
});
test('imported song lessons retain original tempo and start at their selected mastery speed',()=>{
  const song={id:'fixture',title:'Fixture',tempo:120,tempos:[{offsetMs:0,bpm:120}],tracks:[{id:'lead',name:'Lead',playable:true,tuning:[64,59,55,50,45,40],capo:0,transposition:0,events:[{measure:1,offsetMs:0,durationMs:500,notes:[{string:1,fret:0,midi:64}],techniques:[],rest:false}]}]};
  const skill=songLesson(song,'lead',{speed:.6});
  assert.equal(skill.originalBpm,120);assert.equal(skill.bpm,72);assert.equal(skill.speed,.6);assert.equal(skill.songId,'fixture');
});

test('authored string-switching phrases lead their longer practice sequence',()=>{
  const skill=skillById('tabs-3'),sequence=generatePracticeSequence(skill,40),expected=skill.practicePhrases[0];
  assert.ok(skill.practicePhrases.length>=5);
  assert.deepEqual(sequence.slice(0,expected.length).map(({string,fret})=>[string,fret]),expected.map(({string,fret})=>[string,fret]));
  assert.equal(sequence.length,40);
});

test('service-worker precache paths all resolve to existing app files',()=>{
  const worker=fs.readFileSync(new URL('../public/service-worker.js',import.meta.url),'utf8');
  const assets=worker.match(/const ASSETS = \[(.*?)\];/s)?.[1];
  assert.ok(assets,'service-worker asset list exists');
  for(const [,asset]of assets.matchAll(/'([^']+)'/g)){
    const relative=asset==='/'?'index.html':asset.slice(1);
    assert.ok(fs.existsSync(new URL(`../public/${relative}`,import.meta.url)),`missing precached file ${asset}`);
  }
});
test('skill-tree node geometry matches the dimensions shared with CSS',()=>{
  const css=fs.readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
  const ui=fs.readFileSync(new URL('../public/skill-tree-ui.js',import.meta.url),'utf8');
  assert.match(ui,/--tree-node-width:'\+NODE_WIDTH\+'px/);
  assert.match(ui,/--tree-node-height:'\+NODE_HEIGHT\+'px/);
  assert.match(css,/width:\s*var\(--tree-node-width\)/);
  assert.match(css,/height:\s*var\(--tree-node-height\)/);
});

import {emptyProfile} from '../public/engine.js';
import {awardPracticeXP,masteryProgress,isProgressionUnlocked,MASTERY_THRESHOLDS} from '../public/progression.js';

test('a brand-new profile opens a useful next node early and reaches Bronze after focused practice',()=>{
  const profile=emptyProfile(),lesson={id:'tabs-0',title:'Read Tab Numbers',progressionSkills:['fundamentals-strings']};
  const session={total:32,rule:{tier:1,bpm:60}},result={total:32,accuracy:100,passed:true},history=[],day=Date.parse('2026-06-01T12:00:00Z');
  const first=awardPracticeXP(profile,lesson,session,result,{history,at:day});
  assert.equal(first.xp,35);assert.deepEqual(first.targets,['fundamentals-strings']);history.push({activityKey:first.activityKey,at:day,accuracy:100});
  assert.equal(isProgressionUnlocked('fundamentals-fretboard',profile),true);
  assert.equal(isProgressionUnlocked('tabs-reading',profile),true);
  for(let run=1;run<3;run++){const reward=awardPracticeXP(profile,lesson,session,result,{history,at:day+run});history.push({activityKey:reward.activityKey,at:day+run,accuracy:100});}
  assert.equal(masteryProgress(profile,'fundamentals-strings').xp,70);
  const capped=awardPracticeXP(profile,lesson,session,result,{history,at:day+4});assert.equal(capped.xp,0);
  const nextDay=awardPracticeXP(profile,lesson,session,result,{history,at:day+86400000});
  assert.equal(nextDay.xp,35);assert.equal(masteryProgress(profile,'fundamentals-strings').tier,1);
  assert.deepEqual(MASTERY_THRESHOLDS,[0,100,250,500,900]);
});
