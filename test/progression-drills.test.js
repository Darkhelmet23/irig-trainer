import test from 'node:test';
import assert from 'node:assert/strict';
import {createDrill} from '../public/drills.js';

test('scale practice covers different roots, modes, and fretboard positions',()=>{
  const gDorian=createDrill('scale',{root:'G',scale:'Dorian',position:2,direction:'ascending'});
  const allowed=new Set([7,9,10,0,2,4,5]);
  assert.equal(gDorian.scaleName,'G Dorian');assert.equal(gDorian.position,2);assert.ok(gDorian.sequence.length>=8);
  assert.ok(gDorian.sequence.every(note=>allowed.has(note.midi%12)));
  assert.ok(gDorian.sequence.every((note,index,array)=>index===0||array[index-1].midi<=note.midi));
  assert.ok(gDorian.sequence.every(note=>note.fret>=2&&note.fret<=6));
  const cMajor=createDrill('scale',{root:'C',scale:'Major',position:1,direction:'descending'});
  assert.ok(cMajor.sequence.every((note,index,array)=>index===0||array[index-1].midi>=note.midi));
  assert.notDeepEqual(cMajor.sequence.map(note=>note.midi),gDorian.sequence.map(note=>note.midi));
});

test('scale drills build two, three, and four-note motifs with varied endings',()=>{
  const line=createDrill('scale',{root:'A',scale:'Minor pentatonic',direction:'ascending'});
  for(const sequenceLength of [2,3,4]){
    const sequence=createDrill('scale',{root:'A',scale:'Minor pentatonic',position:2,sequenceLength,direction:'ascending'});
    assert.ok(sequence.sequence.length>line.sequence.length/2,`${sequenceLength}-note sequence should be a useful phrase`);
    assert.ok(sequence.sequence.some((note,index,array)=>index>1&&note.midi<array[index-1].midi),'alternating sequence fragments should reverse direction');
    assert.equal(sequence.sequenceLength,sequenceLength);
  }
});

test('scale shifting connects adjacent positions and carries an optional tempo ladder',()=>{
  const drill=createDrill('scale',{root:'D',scale:'Blues',position:2,positionShift:true,sequenceLength:3,tempoLadder:true});
  assert.equal(drill.positionShift,true);assert.equal(drill.tempoLadder,true);assert.deepEqual(drill.tempoStages,[.6,.7,.8,.9,1]);
  assert.match(drill.title,/positions 2–3/);assert.match(drill.guide,/Connect positions 2 and 3/);
  assert.ok(drill.fretboardPattern.some(note=>note.fret<=6));assert.ok(drill.fretboardPattern.some(note=>note.fret>=8));
  assert.ok(drill.sequence.length>=16);
});
