import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateSongDifficulty} from '../public/song-difficulty.js';
import {InputDiagnostics} from '../public/input-diagnostics.js';

test('song difficulty responds to density, tempo, movement, voicings, range, and techniques',()=>{
  const beginner={events:Array.from({length:4},(_,i)=>({measure:1,offsetMs:i*1000,durationMs:1000,notes:[{string:6,fret:0,midi:40}],techniques:[]}))};
  const expert={events:Array.from({length:16},(_,i)=>({measure:i<8?1:2,offsetMs:i*180,durationMs:180,notes:[{string:i%2?1:6,fret:17+(i%3),midi:76},{string:5,fret:14,midi:67}],techniques:['bend','slide','vibrato','hammer-on']}))};
  const easy=estimateSongDifficulty(beginner,{from:1,to:1,tempo:80,speed:.75});
  const hard=estimateSongDifficulty(expert,{from:1,to:2,tempo:190,speed:1});
  assert.equal(easy.level,'Beginner');assert.ok(hard.score>easy.score);assert.equal(hard.level,'Expert');
  assert.equal(estimateSongDifficulty(expert,{from:1,to:1,tempo:190,focus:'melody'}).chordRate,0);
  assert.equal(estimateSongDifficulty(beginner,{from:5,to:8}).level,'Unrated');
});

test('hardware diagnostics calculate confidence and note stability and count player reports',()=>{
  const diagnostics=new InputDiagnostics();
  for(let cents=1;cents<=8;cents++)diagnostics.observe({rms:.05,midi:64,cents,pitchConfidence:.94,frequency:329.6,trigger:cents===1});
  diagnostics.markFalsePositive();diagnostics.markMissedAttack();diagnostics.setCalibration(25);
  const result=diagnostics.snapshot();
  assert.equal(result.stability,'Stable');assert.equal(result.pitchConfidence,.94);assert.equal(result.attacks,1);
  assert.equal(result.falsePositives,1);assert.equal(result.missedAttacks,1);assert.equal(result.calibrationOffset,25);
  diagnostics.reset();assert.equal(diagnostics.snapshot().falsePositives,0);assert.equal(diagnostics.snapshot().calibrationOffset,25);
});
