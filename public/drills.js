import {CHORDS,SKILLS,TUNING,noteName} from './curriculum.js';

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
    const name=options.scale||'Minor pentatonic',steps=STEPS[name]||STEPS['Minor pentatonic'],root=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].indexOf(options.root||'E'),classes=new Set(steps.map(n=>(n+root)%12)),positions=[];
    for(let string=6;string>=1;string--)for(let fret=0;fret<=12;fret++){const midi=TUNING[string-1]+fret;if(classes.has(midi%12))positions.push({string,fret,midi});}
    positions.sort((a,b)=>a.midi-b.midi||a.string-b.string);const ascent=positions.slice(0,12),sequence=[...ascent,...ascent.slice().reverse()].map((p,i)=>event(p.string,p.fret,i));
    return timed({id:'drill-scale',title:`${options.root||'E'} ${name} scale`,track:'tabs',requires:null,scaleName:`${options.root||'E'} ${name}`,fretboardPattern:ascent,sequence,guide:`Play the ${options.root||'E'} ${name} shape in ascending and descending order. Keep each note even and watch the fretboard map.`},90);
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
  return `<div class="mini-fretboard" aria-label="Scale pattern on the first twelve frets">${Array.from({length:6},(_,i)=>{const string=i+1;return `<div class="mini-fret-row"><b>${['e','B','G','D','A','E'][i]}</b>${Array.from({length:13},(_,f)=>{const p=skill.fretboardPattern.find(n=>n.string===string&&n.fret===f);return `<span class="${p?'scale-dot':''}" title="${p?noteName(p.midi):`Fret ${f}`}">${p?noteName(p.midi):''}</span>`;}).join('')}</div>`;}).join('')}</div>`;
}
export const scaleNames=Object.keys(STEPS);
export const chordProgressions=Object.keys(PROGRESSIONS);
export const chordNames=Object.keys(CHORDS);
