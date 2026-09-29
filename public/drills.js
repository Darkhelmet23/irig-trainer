import {CHORDS,SKILLS,TUNING,noteName} from './curriculum.js';
import {weakSpotWarmup} from './session-coach.js';

const STEPS={
  'Major':[0,2,4,5,7,9,11],'Natural minor':[0,2,3,5,7,8,10],
  'Minor pentatonic':[0,3,5,7,10],'Major pentatonic':[0,2,4,7,9],
  'Blues':[0,3,5,6,7,10],'Dorian':[0,2,3,5,7,9,10],
  'Mixolydian':[0,2,4,5,7,9,10],'Phrygian':[0,1,3,5,7,8,10],
};
const PROGRESSIONS={
  'G → C → D':['G','C','D','G'],'Am → F → C → G':['Am','F','C','G'],
  'Em → C → G → D':['Em','C','G','D'],'A → D → E → A':['A','D','E','A'],
};
const SHAPES={Em:'0 2 2 0 0 0',E:'0 2 2 1 0 0',Am:'× 0 2 2 1 0',A:'× 0 2 2 2 0',D:'× × 0 2 3 2',C:'× 3 2 0 1 0',G:'3 2 0 0 0 3',F:'1 3 3 2 1 1',Bm:'× 2 4 4 3 2'};
const event=(string,fret,index,{ear=false,find=false}={})=>{const midi=TUNING[string-1]+fret;return {string,fret,midi,offsetMs:index*500,durationMs:500,measure:Math.floor(index/8)+1,techniques:[],notes:[{string,fret,midi}],...(ear?{earPrompt:true}:{}),...(find?{findPrompt:true}:{})};};
const timed=(skill,bpm=120)=>({...skill,tuning:TUNING,timed:true,speed:1,bpm,offsets:true,sequence:skill.sequence.map((e,i)=>({...e,offsetMs:i*60000/bpm,durationMs:60000/bpm,measure:Math.floor(i/4)+1,techniques:e.techniques||[]}))});

export function createDrill(kind,options={}){
  if(kind==='warmup')return weakSpotWarmup(options.profile,options.tuning);
  if(kind==='fretboard'){
    const wanted=options.note||'C',pc=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].indexOf(wanted),string=Number(options.string)||5;
    const positions=[];for(let fret=0;fret<=12;fret++){const midi=TUNING[string-1]+fret;if(midi%12===pc)positions.push({string,fret});}
    if(!positions.length)throw new Error('No matching note on that string.');
    const sequence=Array.from({length:12},(_,i)=>{const p=positions[Math.floor(Math.random()*positions.length)],e=event(p.string,p.fret,i,{find:true});e.label=`Find ${wanted} on the ${['high e','B','G','D','A','low E'][string-1]} string`;delete e.string;delete e.fret;return e;});
    return timed({id:'drill-fretboard',title:`Find ${wanted} on the ${['high e','B','G','D','A','low E'][string-1]} string`,track:'tabs',requires:null,hiddenTarget:true,findOnFretboard:true,sequence,guide:'Find the named pitch on the requested string. The fret number stays hidden; use the sound and your fretboard knowledge. Accuracy is recorded by the actual string and fret you played.'},108);
  }
  if(kind==='ear'){
    const scale=[40,43,45,47,50,52,55,57,59,62,64,67],sequence=Array.from({length:12},(_,i)=>{const midi=scale[Math.floor(Math.random()*scale.length)],positions=[];for(let s=1;s<=6;s++)for(let f=0;f<=17;f++)if(TUNING[s-1]+f===midi)positions.push({string:s,fret:f});const p=positions[0],e=event(p.string,p.fret,i,{ear:true});e.label='Listen, then play the reference note';delete e.string;delete e.fret;return e;});
    return timed({id:'drill-ear',title:'Ear training · hear and find it',track:'tabs',requires:null,hiddenTarget:true,earTraining:true,sequence,guide:'Press Play reference to hear the target note, then find it on your guitar. The chart hides the answer until the attempt is complete.'},96);
  }
  if(kind==='chords'){
    const progression=options.progression||'G → C → D',names=PROGRESSIONS[progression]||PROGRESSIONS['G → C → D'];
    return {id:'drill-chords',title:`Chord transitions · ${progression}`,track:'chords',requires:null,sequence:Array.from({length:4},()=>names).flat().map(chord=>({chord})),guide:'Keep your strumming hand moving and change shape on each beat. The app records chord accuracy and transitions per minute; it does not grade strum direction or fingering.'};
  }
  if(kind==='scale'){
    const roots=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'],rootName=roots.includes(options.root)?options.root:'E';
    const name=STEPS[options.scale]?options.scale:'Minor pentatonic',steps=STEPS[name],root=roots.indexOf(rootName),tuning=Array.isArray(options.tuning)&&options.tuning.length===6?options.tuning:TUNING,classes=new Set(steps.map(n=>(n+root)%12));
    const requestedPosition=Math.max(1,Math.min(5,Math.trunc(Number(options.position)||1))),shift=!!options.positionShift,position=shift&&requestedPosition===5?4:requestedPosition,shiftedPosition=shift?position+1:position;
    const lineAt=box=>{const low=(box-1)*2,high=low+4,notes=[];for(let string=tuning.length;string>=1;string--)for(let fret=low;fret<=Math.min(12,high);fret++){const midi=tuning[string-1]+fret;if(classes.has(midi%12))notes.push({string,fret,midi});}return notes.sort((a,b)=>a.midi-b.midi||a.string-b.string);};
    const first=lineAt(position),second=shift?lineAt(shiftedPosition).filter(note=>note.midi>(first.at(-1)?.midi??-1)):[],line=[...first,...second];
    const sequenceLength=Math.max(1,Math.min(4,Math.trunc(Number(options.sequenceLength)||1)));
    let phrase=line;
    if(sequenceLength>1){phrase=[];let group=0;for(let start=0;start<line.length;start+=sequenceLength-1){const notes=line.slice(start,start+sequenceLength);if(notes.length<sequenceLength)break;if(group++%2)notes.reverse();phrase.push(...notes);}}
    const direction=['ascending','descending','up-down'].includes(options.direction)?options.direction:'up-down';
    if(direction==='descending')phrase=phrase.slice().reverse();
    else if(direction==='up-down')phrase=[...phrase,...phrase.slice().reverse().slice(1)];
    const sequence=phrase.map((p,i)=>event(p.string,p.fret,i));
    const tempoTargetBpm=Math.max(40,Math.min(180,Number(options.bpm)||72)),tempoLadder=!!options.tempoLadder,bpm=tempoLadder?Math.round(tempoTargetBpm*.6):tempoTargetBpm;
    const positionText=shift?` · positions ${position}–${shiftedPosition}`:` · position ${position}`;
    const sequenceText=sequenceLength>1?` using ${sequenceLength}-note sequences`:'';
    const directionText=direction==='descending'?'descending':direction==='ascending'?'ascending':'ascending and descending';
    return timed({id:'drill-scale',title:`${rootName} ${name}${positionText}`,track:'tabs',requires:null,scaleName:`${rootName} ${name}`,scaleRoot:rootName,tuning:tuning.slice(),position,sequenceLength,direction,positionShift:shift,tempoTarget:tempoLadder,tempoLadder,tempoTargetBpm,tempoStage:0,tempoStages:tempoLadder?[.6,.7,.8,.9,1]:[],adaptiveTempo:tempoLadder,fretboardPattern:[...first,...second],sequence,guide:`Play ${directionText}${sequenceText} in ${rootName} ${name}. ${shift?`Connect positions ${position} and ${shiftedPosition}. `:''}${tempoLadder?'Begin at 60% tempo and move up only after you meet the accuracy goal. ':'Keep each note even and listen for the scale color. '}Follow the fretboard map.`},bpm);
  }
  if(kind==='technique'){
    const source=SKILLS.find(s=>s.technique)||SKILLS.find(s=>s.title==='Alternate Picking')||SKILLS[10];
    const sequence=Array.from({length:4},()=>source.sequence).flat().map((e,i)=>({...e}));
    return {...source,id:'drill-technique',title:`Technique focus · ${source.title}`,requires:null,sequence,guide:`${source.guide} This exercise can check pitch and timing; use the written cue to work on the physical motion.`};
  }
  throw new Error('Choose a practice drill.');
}

export function fretboardMap(skill){
  if(!skill.fretboardPattern?.length)return '';
  const roots=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'],rootPitch=roots.indexOf(skill.scaleRoot),tuning=Array.isArray(skill.tuning)&&skill.tuning.length===6?skill.tuning:TUNING;
  return `<div class="mini-fretboard" aria-label="${skill.scaleName||'Scale'} pattern on frets zero through twelve">${Array.from({length:6},(_,i)=>{const string=i+1,label=noteName(tuning[string-1]).replace(/-?\d+$/,'');return `<div class="mini-fret-row"><b>${label}</b>${Array.from({length:13},(_,f)=>{const note=skill.fretboardPattern.find(item=>item.string===string&&item.fret===f),isRoot=!!note&&rootPitch>=0&&note.midi%12===rootPitch,base=Math.max(0,(skill.position-1)*2),finger=!note?'':f===0?'open string':`suggested finger ${Math.max(1,Math.min(4,f-base+1))}`,title=note?`${noteName(note.midi)}${isRoot?' · root':''}${finger?' · '+finger:''}`:`Fret ${f}`;return `<span class="${note?'scale-dot':''}${isRoot?' root-dot':''}" title="${title}">${note?noteName(note.midi):''}</span>`;}).join('')}</div>`;}).join('')}</div>`;
}
export const scaleNames=Object.keys(STEPS);
export const chordProgressions=Object.keys(PROGRESSIONS);
export const chordNames=Object.keys(CHORDS);
