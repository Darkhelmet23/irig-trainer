import {CHORDS,TUNING,noteName} from './curriculum.js';
export const noteSet=notes=>[...new Set(notes.map(n=>typeof n==='number'?n:n.midi))].sort((a,b)=>a-b).join(',');
export const pitchClasses=notes=>[...new Set(notes.map(n=>((n%12)+12)%12))].sort((a,b)=>a-b).join(',');
export function suggestPosition(midi,tuning,capo=0){
  return tuning.map((open,i)=>({string:i+1,fret:midi-open-capo,midi,suggested:true})).filter(n=>Number.isInteger(n.fret)&&n.fret>=0&&n.fret<=24).sort((a,b)=>a.fret-b.fret||a.string-b.string)[0]||{midi,string:null,fret:null,suggested:true};
}
export function songLesson(song,trackId,{speed=1,from=1,to=Infinity,focus='full'}={}){
  const part=song.tracks.find(t=>t.id===trackId);if(!part?.playable)throw new Error('Choose a pitched instrument track.');
  if(!Number.isFinite(speed)||speed<.25||speed>1.25)throw new Error('Choose a speed between 25% and 125%.');
  if(!Number.isInteger(from)||from<1||(!Number.isInteger(to)&&to!==Infinity)||to<from)throw new Error('Choose a valid measure range.');
  const source=part.events.filter(e=>e.measure>=from&&e.measure<=to);if(!source.length)throw new Error('This measure range has no events.');
  if(source.length>2000)throw new Error('Choose a shorter section (up to 2,000 events).');
  const tuning=part.tuning.length?part.tuning:TUNING;
  const candidates={},start=source[0].offsetMs;let suggested=false;
  const sequence=source.map(event=>{
    const notes=event.notes.map(n=>n.string?n:{...n,...suggestPosition(n.midi,tuning,part.capo)});suggested||=notes.some(n=>n.suggested);
    let attacks=notes.filter(n=>!n.tie&&!n.dead);
    if(focus==='melody'&&attacks.length>1)attacks=[attacks.reduce((a,b)=>a.midi>b.midi?a:b)];
    const target={offsetMs:(event.offsetMs-start)/speed,durationMs:event.durationMs/speed,measure:event.measure,notes,techniques:event.techniques,passive:!attacks.length,rest:event.rest};
    if(attacks.length===1)Object.assign(target,attacks[0]);
    else if(attacks.length>1){target.chord='score:'+noteSet(attacks);candidates[target.chord]=attacks.map(n=>n.midi);target.label=event.chord||attacks.map(n=>noteName(n.midi)).join(' + ');}
    return target;
  });
  if(!sequence.some(e=>!e.passive))throw new Error('This section has only rests, tied continuations or dead notes. Choose another range.');
  if(Object.keys(candidates).length>128)throw new Error('Choose a shorter section or melody focus (up to 128 distinct voicings).');
  const keys=new Set(Object.values(candidates).map(noteSet));
  for(const [name,notes]of Object.entries(CHORDS)){if(!keys.has(noteSet(notes)))candidates[name]=notes;}
  return {id:'song',songId:song.id,trackId:part.id,fromMeasure:from,toMeasure:to,focus,originalBpm:song.tempo,title:song.title+' · '+part.name,track:'tabs',requires:null,timed:true,tuning,capo:part.capo,transposition:part.transposition,speed,tempos:song.tempos.map(t=>({...t,offsetMs:(t.offsetMs-start)/speed,bpm:t.bpm*speed})),bpm:song.tempo*speed,candidates,sequence,
    guide:`${part.name} · ${Math.round(speed*100)}% speed · ${focus==='melody'?'highest-note melody focus':'full part'}. Original rhythm, tempo changes, rests and repeats are retained. Capo ${part.capo||0}. ${suggested?'Some fingering is suggested because the source has no positions. ':''}Technique and sustain markings are shown for reference; grading checks attacks.`,suggested};
}
let database;
function db(){return database??=new Promise((resolve,reject)=>{const request=indexedDB.open('irig-song-library',1);request.onupgradeneeded=()=>request.result.createObjectStore('songs',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function transaction(mode,action){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('songs',mode);const request=action(tx.objectStore('songs'));tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
export const loadSongs=()=>transaction('readonly',store=>store.getAll());
export const saveSong=song=>transaction('readwrite',store=>store.put(song));
export const deleteSong=id=>transaction('readwrite',store=>store.delete(id));
