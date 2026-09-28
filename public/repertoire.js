import {CHORDS,TUNING} from './curriculum.js';

const N=(string,fret,beats=.5)=>[string,fret,beats];
const R=(beats=.5)=>[0,0,beats];

export const REPERTOIRE_SETS=[
  {id:'rookie-rush',title:'01 · Rookie Rush',caption:'Find the beat. Land the riff.',level:'Starter',charts:[
    {title:'Green Light',genre:'Pop punk',bpm:92,phrase:[N(6,0),N(6,3),N(5,0,1),N(5,2),N(5,0),N(6,3,1),N(6,0),N(5,2)],ending:[N(5,0),N(6,3),N(6,0,1),N(6,0,1)]},
    {title:'Racket Science',genre:'Garage rock',bpm:100,phrase:[N(1,0),N(1,3),N(2,0),N(2,3,1),N(1,3),N(1,0),N(2,3,1),N(2,0)],ending:[N(1,0),N(2,3),N(1,3),N(1,0,1)]},
    {title:'Pocket Rocket',genre:'Indie pop',bpm:104,phrase:[N(5,0),N(5,3),N(4,0),N(4,2),N(3,0,1),N(3,2),N(4,2),N(4,0)],ending:[N(5,3),N(4,2),N(4,0,1),N(5,0,1)]},
    {title:'Fast Lane',genre:'Skate rock',bpm:108,phrase:[N(6,0),N(6,0),N(6,3),N(5,0),N(6,3),N(6,0),R(),N(5,2),N(5,0)],ending:[N(6,3),N(5,2),N(5,0),N(6,0,1)]},
    {title:'Four on the Floor',genre:'Power chords',bpm:88,progression:['E5','E5','G5','A5'],kind:'chords'},
    {title:'Campfire Countdown',genre:'Open chords',bpm:84,progression:['Em','C','G','D'],kind:'chords'},
  ]},
  {id:'amp-city',title:'02 · Amp City',caption:'More strings. Tighter timing.',level:'Rising',charts:[
    {title:'Glass Comet',genre:'Alt rock',bpm:116,phrase:[N(4,0),N(4,2),N(3,0),N(3,2),N(2,0,1),N(2,3),N(1,0),N(1,3)],ending:[N(2,3),N(2,0),N(1,3),N(1,0,1)]},
    {title:'Pixel Riot',genre:'Chiptune rock',bpm:124,phrase:[N(6,0),N(5,2),N(4,0),N(3,2),N(2,0),N(1,3),N(2,0),N(3,2)],ending:[N(4,2),N(3,0),N(5,2),N(6,0,1)]},
    {title:'Midnight Run',genre:'Blues rock',bpm:112,phrase:[N(5,0,1),N(4,2),N(3,0),N(3,2),N(2,0,1),N(1,3),N(2,0),N(3,2)],ending:[N(4,0),N(3,2),N(4,0),N(5,0,1)]},
    {title:'Chrome Hearts',genre:'Arena rock',bpm:120,phrase:[N(4,0),N(4,2),N(3,1),N(3,2),N(2,0,1),N(2,2),N(1,0),N(1,2)],ending:[N(2,2),N(2,0),N(1,2),N(1,0,1)]},
    {title:'Feedback Parade',genre:'Power chords',bpm:112,progression:['A5','D5','E5','D5'],kind:'chords'},
    {title:'Skyline Shuffle',genre:'Open chords',bpm:102,progression:['G','D','Em','C'],kind:'chords'},
  ]},
  {id:'neon-highway',title:'03 · Neon Highway',caption:'Fast runs and bigger changes.',level:'Advanced',charts:[
    {title:'Static Dreams',genre:'Shred rock',bpm:132,phrase:[N(6,12),N(6,15),N(5,12),N(5,14),N(4,12),N(4,14),N(3,12),N(3,14)],ending:[N(2,12),N(2,15),N(1,12),N(1,15,1)]},
    {title:'Wildfire',genre:'Desert rock',bpm:128,phrase:[N(5,5),N(5,8),N(4,5),N(4,7),N(3,5),N(3,7),N(2,5),N(2,8)],ending:[N(1,5),N(1,8),N(2,8),N(1,5,1)]},
    {title:'Orbit Breaker',genre:'Prog rock',bpm:138,phrase:[N(6,3),N(5,2),N(4,0),N(3,2),N(2,0),N(1,3),N(2,0),N(3,2)],ending:[N(4,2),N(3,0),N(5,2),N(6,3,1)]},
    {title:'Thunder Cabinet',genre:'Heavy rock',bpm:144,phrase:[N(6,0,.5),N(6,0,.5),N(6,3,1),R(.5),N(5,0),N(5,2),N(6,3),N(6,0,1)],ending:[N(5,2),N(5,0),N(6,3),N(6,0,1)]},
    {title:'Barre Runner',genre:'Chord sprint',bpm:116,progression:['F','G','Am','C'],kind:'chords'},
    {title:'Ruby Voltage',genre:'Seventh chords',bpm:108,progression:['Am','D7','G','E7'],kind:'chords'},
  ]},
  {id:'final-encore',title:'04 · Final Encore',caption:'The lights are up. Bring it home.',level:'Expert',charts:[
    {title:'Zero Gravity',genre:'Lead guitar',bpm:152,phrase:[N(1,12),N(1,15),N(2,12),N(2,15),N(3,12),N(3,14),N(2,15),N(1,15)],ending:[N(1,12),N(2,15),N(3,14),N(1,12,1)]},
    {title:'Storm Circuit',genre:'Fast blues',bpm:148,phrase:[N(5,5),N(5,8),N(4,5),N(4,7),N(3,5),N(3,7),N(2,5),N(1,8)],ending:[N(2,8),N(3,7),N(4,7),N(5,5,1)]},
    {title:'Zenith Attack',genre:'Melodic metal',bpm:160,phrase:[N(6,3),N(5,2),N(4,0),N(3,0),N(2,0),N(1,3),N(2,0),N(3,0)],ending:[N(4,2),N(3,0),N(2,0),N(1,3,1)]},
    {title:'Final Form',genre:'Boss riff',bpm:164,phrase:[N(6,0,.5),N(6,3,.5),N(5,0),N(4,2),N(3,0),N(2,3),R(.5),N(1,3),N(2,0)],ending:[N(3,2),N(4,2),N(5,0),N(6,0,1)]},
    {title:'Redline Anthem',genre:'Power chord finale',bpm:132,progression:['E5','G5','A5','D5'],kind:'chords'},
    {title:'Afterburner Finale',genre:'Chord finale',bpm:124,progression:['Bm','G','D','A'],kind:'chords'},
  ]},
];

const VOICINGS={
  Em:[[6,0],[5,2],[4,2],[3,0],[2,0],[1,0]],E:[[6,0],[5,2],[4,2],[3,1],[2,0],[1,0]],
  Am:[[5,0],[4,2],[3,2],[2,1],[1,0]],A:[[5,0],[4,2],[3,2],[2,2],[1,0]],
  D:[[4,0],[3,2],[2,3],[1,2]],C:[[5,3],[4,2],[3,0],[2,1],[1,0]],
  G:[[6,3],[5,2],[4,0],[3,0],[2,0],[1,3]],F:[[6,1],[5,3],[4,3],[3,2],[2,1],[1,1]],
  Bm:[[5,2],[4,4],[3,4],[2,3],[1,2]],E5:[[6,0],[5,2],[4,2]],A5:[[5,0],[4,2],[3,2]],
  G5:[[6,3],[5,5],[4,5]],D5:[[4,0],[3,2],[2,3]],
  E7:[[6,0],[5,2],[4,0],[3,1],[2,0],[1,0]],A7:[[5,0],[4,2],[3,0],[2,2],[1,0]],
  D7:[[4,0],[3,2],[2,1],[1,2]],
};

function timedEvents(cells,bpm,chordMode=false){
  const beatMs=60000/bpm;let beat=0;
  return cells.map(cell=>{
    const [first,second,duration=1]=cell;
    const event={offsetMs:Math.round(beat*beatMs),durationMs:Math.round(duration*beatMs),measure:Math.floor(beat/4)+1,techniques:[]};
    beat+=duration;
    if(chordMode){
      const chord=first,notes=VOICINGS[chord].map(([string,fret])=>({string,fret,midi:TUNING[string-1]+fret}));
      return {...event,chord,notes};
    }
    if(!first)return {...event,rest:true,passive:true,notes:[]};
    const note={string:first,fret:second,midi:TUNING[first-1]+second};
    return {...event,...note,notes:[note]};
  });
}

export const REPERTOIRE=REPERTOIRE_SETS.flatMap(set=>set.charts.map((chart,index)=>{
  const id=`${set.id}-${index+1}`;
  const cells=chart.kind==='chords'
    ?Array.from({length:4},()=>chart.progression.map(chord=>[chord,1,1])).flat()
    :[...chart.phrase,...chart.phrase.slice(4),...chart.phrase.slice(0,4),...chart.ending];
  const track=chart.kind==='chords'?'chords':'tabs';
  const count=cells.length;
  return {id,title:chart.title,set:set.title,setId:set.id,level:set.level,genre:chart.genre,bpm:chart.bpm,track,timed:true,speed:1,tuning:TUNING,sequence:timedEvents(cells,chart.bpm,track==='chords'),requires:null,
    guide:`${set.title} · ${chart.genre} · ${chart.bpm} BPM. Original ${track==='chords'?'chord':'single-note'} chart, arranged for this trainer. Use guided mode to learn the pattern, then scrolling mode to chase the notes. ${count} chart events; practice only, no progression rank.`};
}));

if(REPERTOIRE.length!==24||REPERTOIRE.some(chart=>chart.sequence.length<12||chart.sequence.some(event=>!Number.isFinite(event.offsetMs))))throw new Error('Original repertoire chart data is incomplete.');
