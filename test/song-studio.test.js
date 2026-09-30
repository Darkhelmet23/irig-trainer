import test from 'node:test';
import assert from 'node:assert/strict';
import {CHORDS,TUNING} from '../public/curriculum.js';
import {createMemorySongStudioStorage} from '../public/song-studio-storage.js';
import {
  createSongProject,createSongSection,chordsInKey,captureNotesToRiff,deserializeSongProject,
  duplicateProgression,randomChordProgression,reorderItems,restoreSongProjectVersion,
  serializeSongProject,snapshotSongProject,songProjectToPracticeLesson,transposeChordProgression,
  transposeSongProject
} from '../public/song-studio.js';

test('Song Studio creates a local-ready project with sensible blank and chord starts',()=>{
  const blank=createSongProject({now:0,tuning:TUNING});
  assert.equal(blank.title,'Untitled song');
  assert.equal(blank.bpm,80);
  assert.equal(blank.timeSignature,'4/4');
  assert.equal(blank.sections.length,1);
  assert.deepEqual(blank.sections[0].chords,[]);
  const chords=createSongProject({template:'chords',key:'Em',now:0});
  assert.deepEqual(chords.sections[0].chords.map(chord=>chord.name),['Em','C','G','D']);
  assert.equal(chordsInKey('C').slice(0,4).join(','),'C,Dm,Em,F');
});

test('project serialization and autosave survive refresh through local storage adapter',async()=>{
  const project=createSongProject({template:'riff',now:100});
  project.sections[0].lyrics='first line';
  project.sections[0].riff.push({id:'r1',measure:1,beat:1,durationBeats:1,rest:false,notes:[{string:1,fret:3,midi:67}]});
  const serialized=serializeSongProject(project),restored=deserializeSongProject(serialized);
  assert.deepEqual(restored.sections[0].riff,project.sections[0].riff);
  const storage=createMemorySongStudioStorage();
  await storage.saveProject(restored);
  assert.equal((await storage.loadProject(project.id)).sections[0].lyrics,'first line');
  assert.equal((await storage.listProjects()).length,1);
});

test('arrangement sections reorder without losing their ids',()=>{
  assert.deepEqual(reorderItems(['intro','verse','chorus'],2,0),['chorus','intro','verse']);
  const section=createSongSection('Bridge');
  assert.equal(section.name,'Bridge');
  assert.deepEqual(section.riff,[]);
});

test('chord progressions transpose and expose optional random/common helpers',()=>{
  const source=[{id:'a',name:'Em',beats:4},{id:'b',name:'C',beats:2},{id:'c',name:'G',beats:4},{id:'d',name:'D',beats:4}];
  assert.deepEqual(transposeChordProgression(source,2).map(chord=>chord.name),['F#m','D','A','E']);
  assert.equal(duplicateProgression(source).length,8);
  assert.equal(randomChordProgression('Em',()=>0).length,4);
  assert.equal(CHORDS.Em.length,6);
});

test('whole-song transposition moves chord roots and editable tab pitches',()=>{
  const project=createSongProject({template:'chords',key:'Em',now:0});
  project.sections[0].riff=[{id:'r',measure:1,beat:1,durationBeats:1,notes:[{string:1,fret:0,midi:64}],rest:false}];
  const moved=transposeSongProject(project,2);
  assert.equal(moved.key,'F#m');
  assert.equal(moved.sections[0].chords[0].name,'F#m');
  assert.equal(moved.sections[0].riff[0].notes[0].midi,66);
  assert.equal(moved.sections[0].riff[0].notes[0].fret,2);
});

test('captured pitches map to editable string and fret positions on the project beat grid',()=>{
  const riff=captureNotesToRiff([{midi:64,at:100},{midi:62,at:600}],{tuning:TUNING,bpm:120});
  assert.equal(riff.length,2);
  assert.deepEqual(riff.map(event=>[event.measure,event.beat]),[[1,1],[1,2]]);
  assert.deepEqual(riff[0].notes[0],{string:1,fret:0,midi:64});
  assert.equal(riff[1].notes[0].midi,62);
});

test('saved versions restore content while retaining later snapshots and recording metadata',()=>{
  let project=createSongProject({template:'chords',now:0});
  project.recordings=[{id:'take1',sectionId:project.sections[0].id,name:'demo'}];
  project=snapshotSongProject(project,'First idea',1000);
  project.title='Changed';
  project.sections[0].chords[0].name='G';
  const restored=restoreSongProjectVersion(project,project.versions[0].id,2000);
  assert.equal(restored.title,'Untitled song');
  assert.equal(restored.sections[0].chords[0].name,'Em');
  assert.equal(restored.versions.length,1);
  assert.deepEqual(restored.recordings,project.recordings);
});

test('Send to Practice builds timed loop material without progression XP targets',()=>{
  const project=createSongProject({template:'chords',now:0});
  const section=project.sections[0];
  const lesson=songProjectToPracticeLesson(project,section,{source:'chords',loops:2});
  assert.equal(lesson.songStudioProjectId,project.id);
  assert.equal(lesson.sequence.length,8);
  assert.equal(lesson.sequence[0].offsetMs,0);
  assert.equal(lesson.sequence[4].offsetMs,12000);
  assert.equal(lesson.originalBpm,80);
  assert.equal(lesson.progressionSkills,undefined);
  const riff=songProjectToPracticeLesson({...project,id:'riff-project'},{
    ...createSongSection('Riff'),riff:[{id:'r',measure:1,beat:1,durationBeats:1,notes:[{string:1,fret:3,midi:67}],rest:false}]
  });
  assert.equal(riff.sequence[0].midi,67);
});