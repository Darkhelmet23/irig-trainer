import {CHORDS,TUNING} from './curriculum.js';

export const SONG_STUDIO_SCHEMA = 1;
export const SECTION_TYPES = Object.freeze(['Intro','Verse','Pre-Chorus','Chorus','Bridge','Solo','Outro','Custom']);
const CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const NOTE_PC = {C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};
const clone = value => JSON.parse(JSON.stringify(value));
const makeId = prefix => prefix+'-'+(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2,12));
const keyRoot = value => /^([A-G](?:#|b)?)/.exec(String(value||'C'))?.[1]||'C';

export function timeSignatureBeats(signature='4/4'){
  const [numerator,denominator]=String(signature).split('/').map(Number);
  if(!Number.isInteger(numerator)||!Number.isInteger(denominator)||numerator<1||numerator>12||denominator<1)return 4;
  return numerator*4/denominator;
}

export function createSongSection(name='Verse'){
  return {id:makeId('section'),name:String(name||'Custom').trim()||'Custom',measureCount:2,chords:[],riff:[],lyrics:'',notes:''};
}

export function chordsInKey(key='Em'){
  const minor=/m$/.test(key),root=keyRoot(key),rootPc=NOTE_PC[root]??0;
  const intervals=minor?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11];
  const qualities=minor?['m','dim','','m','m','','']:['','m','m','','','m','dim'];
  return intervals.map((interval,index)=>{
    const name=CHROMATIC[(rootPc+interval)%12]+qualities[index];
    return qualities[index]==='dim'?name.slice(0,-3)+'dim':name;
  });
}

export function createSongProject({title='Untitled song',key='Em',bpm=80,timeSignature='4/4',tuning=TUNING,template='blank',now=Date.now()}={}){
  const section=createSongSection(template==='chords'?'Verse':'Intro');
  const project={
    schemaVersion:SONG_STUDIO_SCHEMA,id:makeId('song'),title:String(title||'Untitled song').slice(0,100),
    createdAt:new Date(now).toISOString(),modifiedAt:new Date(now).toISOString(),
    bpm:Math.max(30,Math.min(240,Math.round(Number(bpm)||80))),key,timeSignature,
    tuning:Array.isArray(tuning)&&tuning.length>=4?tuning.slice():TUNING.slice(),
    arrangement:[section.id],sections:[section],versions:[],recordings:[]
  };
  if(template==='chords'){
    const progression=key==='Em'?['Em','C','G','D']:chordsInKey(key).slice(0,4);
    section.chords=progression.map(name=>({id:makeId('chord'),name,beats:4}));
    section.name='Verse';
  } else if(template==='riff') section.name='Riff';
  return project;
}

export function serializeSongProject(project){
  if(!project||!Array.isArray(project.sections)||!Array.isArray(project.arrangement))throw new Error('Choose a valid Song Studio project.');
  return JSON.stringify({...project,schemaVersion:SONG_STUDIO_SCHEMA});
}

export function deserializeSongProject(serialized){
  const project=typeof serialized==='string'?JSON.parse(serialized):clone(serialized);
  if(!project||!Array.isArray(project.sections)||!Array.isArray(project.arrangement))throw new Error('This is not an RiffTree Song Studio project.');
  project.schemaVersion=SONG_STUDIO_SCHEMA;
  project.sections=project.sections.map(section=>({...createSongSection(section.name),...section,chords:Array.isArray(section.chords)?section.chords:[],riff:Array.isArray(section.riff)?section.riff:[],lyrics:section.lyrics||'',notes:section.notes||''}));
  project.arrangement=project.arrangement.filter(id=>project.sections.some(section=>section.id===id));
  project.versions=Array.isArray(project.versions)?project.versions:[];
  project.recordings=Array.isArray(project.recordings)?project.recordings:[];
  project.bpm=Math.max(30,Math.min(240,Math.round(Number(project.bpm)||80)));
  return project;
}

export function reorderItems(items,fromIndex,toIndex){
  if(!Array.isArray(items)||fromIndex<0||toIndex<0||fromIndex>=items.length||toIndex>=items.length)return items?.slice()||[];
  const copy=items.slice(),[item]=copy.splice(fromIndex,1);copy.splice(toIndex,0,item);return copy;
}

export function transposeChordProgression(chords,semitones){
  const shift=((Math.trunc(Number(semitones)||0)%12)+12)%12;
  return chords.map(chord=>{
    const match=/^([A-G](?:#|b)?)(.*)$/.exec(chord.name);
    if(!match)return {...chord};
    const pc=NOTE_PC[match[1]]??0;
    return {...chord,name:CHROMATIC[(pc+shift)%12]+match[2]};
  });
}

export function nextChordSuggestion(chords,key='Em'){
  const options=chordsInKey(key),last=chords.at(-1)?.name,index=options.indexOf(last);
  if(index<0)return options[0];
  const nextIndex=[4,5,3,0,5,3,0][index]??0;
  return options[nextIndex];
}

export function randomChordProgression(key='Em',random=Math.random){
  const chords=chordsInKey(key),degrees=[0,3,4,5];
  return Array.from({length:4},()=>({id:makeId('chord'),name:chords[degrees[Math.floor(random()*degrees.length)]],beats:4}));
}

export function duplicateProgression(chords){
  return [...chords.map(chord=>({...chord,id:makeId('chord')})),...chords.map(chord=>({...chord,id:makeId('chord')}))];
}

export function snapshotSongProject(project,name='Version',now=Date.now()){
  const snapshot=clone({...project,versions:[],modifiedAt:new Date(now).toISOString()});
  return {...project,modifiedAt:new Date(now).toISOString(),versions:[...(project.versions||[]),{id:makeId('version'),name:String(name||'Version').slice(0,80),createdAt:new Date(now).toISOString(),snapshot}]};
}

export function restoreSongProjectVersion(project,versionId,now=Date.now()){
  const version=project.versions?.find(item=>item.id===versionId);
  if(!version)throw new Error('That saved version is no longer available.');
  const restored=clone(version.snapshot);
  return {...project,...restored,id:project.id,createdAt:project.createdAt,versions:project.versions,recordings:project.recordings,modifiedAt:new Date(now).toISOString()};
}

export function duplicateSongProject(project,{id=makeId('song'),now=Date.now()}={}){
  const copy=clone(project),stamp=new Date(now).toISOString();
  return {...copy,id,title:(project.title+' copy').slice(0,100),createdAt:stamp,modifiedAt:stamp,versions:[],recordings:[]};
}

export function captureNotesToRiff(captured,{tuning=TUNING,bpm=80,timeSignature='4/4'}={}){
  if(!Array.isArray(captured)||!captured.length)return [];
  const beatMs=60000/Math.max(30,Number(bpm)||80),beatsPerBar=timeSignatureBeats(timeSignature),firstAt=captured[0].at||0,grouped=new Map();
  for(const note of captured){
    if(!Number.isInteger(note.midi)||!Number.isFinite(note.at))continue;
    const beatIndex=Math.max(0,Math.round(((note.at-firstAt)/beatMs)*4)/4),measure=Math.floor(beatIndex/beatsPerBar)+1,beat=Number((beatIndex%beatsPerBar+1).toFixed(2));
    const position=tuning.map((open,index)=>({string:index+1,fret:note.midi-open})).filter(item=>item.fret>=0&&item.fret<=24).sort((a,b)=>a.fret-b.fret||a.string-b.string)[0];
    if(!position)continue;
    const key=measure+':'+beat;
    const event=grouped.get(key)||{id:makeId('riff'),measure,beat,durationBeats:.25,notes:[],rest:false};
    if(!event.notes.some(item=>item.string===position.string))event.notes.push({...position,midi:note.midi});
    grouped.set(key,event);
  }
  return [...grouped.values()].sort((a,b)=>a.measure-b.measure||a.beat-b.beat);
}

function chordNotes(name){
  if(CHORDS[name])return CHORDS[name].slice();
  const match=/^([A-G](?:#|b)?)(.*)$/.exec(name);
  if(!match)return [];
  const root=48+(NOTE_PC[match[1]]??0),quality=match[2],minor=quality.startsWith('m')&&!quality.startsWith('maj'),diminished=/dim|°/.test(quality),fifth=diminished?6:7,third=minor?3:4;
  const notes=[root,root+third,root+fifth];
  if(/7/.test(quality))notes.push(root+(/maj7/.test(quality)?11:10));
  return notes;
}

function tabPositions(midis,tuning){
  const used=new Set();
  return midis.map(midi=>{
    const positions=tuning.map((open,index)=>({string:index+1,fret:midi-open,midi})).filter(position=>position.fret>=0&&position.fret<=24&&!used.has(position.string)).sort((a,b)=>a.fret-b.fret)[0];
    if(positions)used.add(positions.string);
    return positions||{midi,string:null,fret:null,suggested:true};
  });
}
export function songProjectToPracticeLesson(project,section,{source='riff',loops=1}={}){
  if(!section)throw new Error('Choose a section to practice.');
  const beatsPerBar=timeSignatureBeats(project.timeSignature),msPerBeat=60000/project.bpm,sequence=[],candidates={};
  if(source==='chords'){
    let atBeat=0;
    for(const chord of section.chords||[]){
      const notes=chordNotes(chord.name);
      if(notes.length){
        candidates[chord.name]=notes;
        sequence.push({id:chord.id,measure:Math.floor(atBeat/beatsPerBar)+1,offsetMs:atBeat*msPerBeat,durationMs:chord.beats*msPerBeat,chord:chord.name,label:chord.name,notes:tabPositions(notes,project.tuning),techniques:[],rest:false,passive:false});
      }
      atBeat+=Math.max(.25,Number(chord.beats)||4);
    }
  } else {
    for(const event of section.riff||[]){
      const beat=(event.measure-1)*beatsPerBar+(event.beat-1);
      if(event.rest){sequence.push({measure:event.measure,offsetMs:beat*msPerBeat,durationMs:(event.durationBeats||.25)*msPerBeat,notes:[],techniques:[],passive:true,rest:true});continue;}
      const notes=(event.notes||[]).map(note=>({...note,midi:Number.isInteger(note.midi)?note.midi:project.tuning[note.string-1]+note.fret}));
      if(!notes.length)continue;
      if(notes.length===1)sequence.push({measure:event.measure,offsetMs:beat*msPerBeat,durationMs:(event.durationBeats||1)*msPerBeat,...notes[0],notes,techniques:[],rest:false,passive:false});
      else {
        const chord='Studio shape '+(sequence.filter(item=>item.chord).length+1),midis=notes.map(note=>note.midi);
        candidates[chord]=midis;
        sequence.push({measure:event.measure,offsetMs:beat*msPerBeat,durationMs:(event.durationBeats||1)*msPerBeat,chord,label:notes.map(note=>note.midi).join(' + '),notes,techniques:[],rest:false,passive:false});
      }
    }
  }
  if(!sequence.some(event=>!event.passive))throw new Error(source==='chords'?'Add a chord to this section first.':'Add a riff note to this section first.');
  sequence.sort((a,b)=>a.offsetMs-b.offsetMs);
  const origin=sequence[0].offsetMs,last=Math.max(...sequence.map(event=>event.offsetMs+event.durationMs)),loopDuration=Math.max(msPerBeat*4,last-origin);
  const oneLoop=sequence.map(event=>({...event,offsetMs:event.offsetMs-origin}));
  const repeatCount=Math.max(1,Math.min(8,Math.trunc(Number(loops)||1)));
  const expanded=Array.from({length:repeatCount},(_,loop)=>oneLoop.map(event=>({...event,offsetMs:event.offsetMs+loop*loopDuration}))).flat();
  return {id:'song-studio-'+project.id+'-'+section.id+'-'+source,title:project.title+' · '+section.name,track:source==='chords'?'chords':'tabs',timed:true,songId:'studio-'+project.id,trackId:section.id,songStudioProjectId:project.id,originalBpm:project.bpm,bpm:project.bpm,speed:1,tempos:[{offsetMs:0,bpm:project.bpm}],tuning:project.tuning.slice(),candidates,sequence:expanded,guide:'Your own Song Studio idea · unranked practice · adjust the tempo and count-in before you begin.'};
}
export function transposeSongProject(project,semitones){
  const shift=Math.trunc(Number(semitones)||0);
  if(!shift)return clone(project);
  const key=transposeChordProgression([{name:project.key}],shift)[0].name;
  const sections=project.sections.map(section=>({...section,
    chords:transposeChordProgression(section.chords||[],shift),
    riff:(section.riff||[]).map(event=>({...event,notes:(event.notes||[]).map(note=>{
      const midi=(Number.isInteger(note.midi)?note.midi:project.tuning[note.string-1]+note.fret)+shift;
      const current=project.tuning[note.string-1],fret=midi-current;
      if(fret>=0&&fret<=24)return {...note,midi,fret};
      const position=project.tuning.map((open,index)=>({string:index+1,fret:midi-open})).filter(item=>item.fret>=0&&item.fret<=24).sort((a,b)=>a.fret-b.fret)[0];
      return position?{...note,...position,midi}:{...note,midi};
    })}))
  }));
  return {...project,key,sections,modifiedAt:new Date().toISOString()};
}