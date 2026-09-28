import {importer,Settings,midi} from '@coderline/alphatab';
import {CHORDS} from './public/curriculum.js';
export const SCORE_EXTENSIONS=['gp','gp3','gp4','gp5','gpx','xml','musicxml','mxl'];
const text=(value,max=200)=>String(value||'').slice(0,max);
function techniqueNames(note,beat){
  return [note.isHammerPullOrigin||note.isHammerPullDestination?'Hammer-on / pull-off':null,
    note.isLetRing||beat.isLetRing?'Let ring':null,note.isStaccato?'Staccato':null,
    note.isTrill?'Trill':null,note.isGrace?'Grace note':null,
    note.slideInType||note.slideOutType?'Slide':null,note.hasBend?'Bend':null,
    note.isPalmMute||beat.isPalmMute?'Palm mute':null,note.harmonicType?'Harmonic':null,
    note.vibrato||beat.vibrato?'Vibrato':null,note.isDead?'Dead note':null,note.isTieDestination?'Tie':null,
    beat.tremoloPicking?'Tremolo picking':null].filter(Boolean);
}
export function tempoClock(changes,division=960){
  const sorted=changes.slice().sort((a,b)=>a.tick-b.tick),points=[];
  for(const change of sorted){if(!Number.isFinite(change.tempo)||change.tempo<10||change.tempo>1000)throw new Error('This score contains an unsupported tempo.');
    if(points.at(-1)?.tick===change.tick)points[points.length-1]={...change};else points.push({...change});}
  if(!points.length)points.push({tick:0,tempo:120});
  if(points[0].tick>0)points.unshift({tick:0,tempo:points[0].tempo});
  points[0].ms=0;for(let i=1;i<points.length;i++)points[i].ms=points[i-1].ms+(points[i].tick-points[i-1].tick)*60000/(points[i-1].tempo*division);
  const at=tick=>{let low=0,high=points.length-1;while(low<high){const mid=Math.ceil((low+high)/2);if(points[mid].tick<=tick)low=mid;else high=mid-1;}const p=points[low];return p.ms+(tick-p.tick)*60000/(p.tempo*division);};
  return {at,points};
}
function chordName(notes){const classes=[...new Set(notes.map(n=>((n.midi%12)+12)%12))].sort((a,b)=>a-b).join(',');return Object.entries(CHORDS).find(([,pitches])=>[...new Set(pitches.map(p=>p%12))].sort((a,b)=>a-b).join(',')===classes)?.[0]||null;}
export function parseScore(bytes,filename){
  const extension=filename.split('.').at(-1).toLowerCase();
  if(!SCORE_EXTENSIONS.includes(extension))throw new Error('Use .gp, .gp3, .gp4, .gp5, .gpx, .musicxml, .xml or .mxl. Export MuseScore projects as MusicXML first.');
  if(!bytes.length||bytes.length>8*1024*1024)throw new Error('Choose a score file between 1 byte and 8 MB.');
  const settings=new Settings();settings.importer.maxDecodingBufferSize=32*1024*1024;
  const score=importer.ScoreLoader.loadScoreFromBytes(bytes,settings);
  if(score.masterBars.length>2500||score.tracks.length>64)throw new Error('This score is too large. Export a section of up to 2,500 bars and 64 instruments.');
  const file=new midi.MidiFile(),generator=new midi.MidiFileGenerator(score,settings,new midi.AlphaSynthMidiFileHandler(file));generator.generate();
  const bars=generator.tickLookup.masterBars;
  if(!bars.length||bars.length>10000)throw new Error('This score has no playable bars or too many repeats.');
  const clock=tempoClock(bars.flatMap(b=>b.tempoChanges),file.division);
  const tracks=[],warnings=new Set();let totalEvents=0;
  for(const track of score.tracks)for(const staff of track.staves){
    const tuning=staff.tuning.slice(),isPercussion=staff.isPercussion||track.playbackInfo?.primaryChannel===9;
    const item={id:`${track.index}-${staff.index}`,name:text(track.name||`Instrument ${track.index+1}`)+(track.staves.length>1?` · staff ${staff.index+1}`:''),instrument:track.playbackInfo?.program??0,isPercussion,tuning,capo:staff.capo||0,transposition:staff.transpositionPitch||0,events:[],techniques:[],hasPositions:false,missingPositions:0};
    const techniques=new Set();
    for(const played of bars){
      const bar=staff.bars[played.masterBar.index];if(!bar)continue;
      const grouped=new Map();
      for(const voice of bar.voices)for(const beat of voice.beats){
        if(beat.isEmpty)continue;
        const relative=generator.tickLookup.getRelativeBeatPlaybackRange(beat);
        const tick=played.start+(relative?.startTick??beat.playbackStart);
        const end=played.start+(relative?.endTick??beat.playbackStart+beat.playbackDuration);
        const ms=Math.max(0,clock.at(tick)),durationMs=Math.max(1,clock.at(end)-clock.at(tick));
        const key=Math.round(ms*1000),event=grouped.get(key)||{offsetMs:ms,durationMs,measure:bar.index+1,notes:[],rest:true,techniques:[]};
        event.durationMs=Math.max(event.durationMs,durationMs);
        for(const note of beat.notes){
          const flags=techniqueNames(note,beat);flags.forEach(t=>techniques.add(t));
          const string=note.isStringed?tuning.length-note.string+1:null;
          const position=string!==null&&string>=1&&string<=tuning.length&&note.fret>=0;
          const n={midi:note.realValue,string:position?string:null,fret:position?note.fret:null,tie:!!note.isTieDestination,dead:!!note.isDead,techniques:flags,bend:note.bendPoints?.map(p=>({offset:p.offset,value:p.value}))||[]};
          if(!Number.isFinite(n.midi))continue;
          if(position)item.hasPositions=true;else if(!isPercussion)item.missingPositions++;
          if(!event.notes.some(other=>other.string===n.string&&other.midi===n.midi&&other.tie===n.tie))event.notes.push(n);
        }
        event.rest=event.notes.length===0;event.techniques=[...new Set(event.notes.flatMap(n=>n.techniques))];grouped.set(key,event);
      }
      for(const event of [...grouped.values()].sort((a,b)=>a.offsetMs-b.offsetMs)){
        event.chord=event.notes.length>1?chordName(event.notes):null;
        item.events.push(event);if(++totalEvents>50000)throw new Error('This score has more than 50,000 events. Export a shorter section.');
      }
    }
    item.techniques=[...techniques];item.playable=!isPercussion&&item.events.some(e=>e.notes.some(n=>!n.tie&&!n.dead));tracks.push(item);
  }
  if(!tracks.some(t=>t.playable))warnings.add('No pitched instrumental part is available for guitar practice.');
  if(tracks.some(t=>t.missingPositions>0&&!t.isPercussion))warnings.add('Some notes have pitches but no source string/fret positions. Suggested positions will be labelled.');
  if(tracks.some(t=>t.techniques.length))warnings.add('Technique markings are retained for reference; automatic grading checks note/chord arrivals, not technique or sustain.');
  if(score.masterBars.some(b=>b.tempoAutomations.some(a=>a.isLinear)))warnings.add('Tempo ramps use the tempo points supplied by the importer.');
  return {version:1,id:crypto.randomUUID(),title:text(score.title||filename.replace(/\.[^.]+$/,'')),artist:text(score.artist||score.music),copyright:text(score.copyright,500),filename:text(filename),format:extension,tempo:score.tempo,durationMs:clock.at(bars.at(-1).end),tempos:clock.points.map(p=>({offsetMs:p.ms,bpm:p.tempo})),tracks,warnings:[...warnings]};
}
