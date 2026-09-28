const levelFor=score=>score<=3?'Beginner':score<=6?'Intermediate':score<=8?'Advanced':'Expert';

export function estimateSongDifficulty(part,{from=1,to=Infinity,speed=1,focus='full',tempo=120}={}){
  const events=(part?.events||[]).filter(event=>(event.measure||1)>=from&&(event.measure||1)<=to).slice().sort((a,b)=>a.offsetMs-b.offsetMs);
  const attacks=events.map(event=>({event,notes:(event.notes||[]).filter(note=>!note.tie&&!note.dead)})).filter(item=>item.notes.length);
  if(!attacks.length)return {score:0,level:'Unrated',attacks:0,attacksPerSecond:0,effectiveBpm:0,chordRate:0,fretMovement:null,techniqueCount:0,summary:'This section has no playable attacks to rate.'};
  const playable=focus==='melody'?attacks.map(item=>({...item,notes:[item.notes.reduce((a,b)=>a.midi>b.midi?a:b)]})):attacks;
  const first=events[0],last=events.at(-1),durationMs=Math.max(1,(last.offsetMs||0)+(last.durationMs||0)-(first.offsetMs||0)),practiceSpeed=Math.max(.25,Math.min(1.25,Number(speed)||1)),effectiveBpm=Math.round(Math.max(0,tempo*practiceSpeed));
  const attacksPerSecond=playable.length/(durationMs/1000/practiceSpeed),chordRate=playable.filter(item=>item.notes.length>1).length/playable.length;
  const positions=playable.map(item=>item.notes.find(note=>Number.isInteger(note.string)&&Number.isInteger(note.fret))).filter(Boolean);
  const movements=[];for(let i=1;i<positions.length;i++)movements.push(Math.abs(positions[i].fret-positions[i-1].fret)+(positions[i].string===positions[i-1].string?0:.5));
  const fretMovement=movements.length?movements.reduce((sum,value)=>sum+value,0)/movements.length:null;
  const techniques=new Set(playable.flatMap(item=>item.event.techniques||item.notes.flatMap(note=>note.techniques||[])));
  let score=1;
  score+=attacksPerSecond>=5?3:attacksPerSecond>=3?2:attacksPerSecond>=1.5?1:0;
  score+=effectiveBpm>160?2:effectiveBpm>120?1:0;
  score+=fretMovement===null?0:fretMovement>=4?2:fretMovement>=2?1:0;
  score+=chordRate>.4?2:chordRate>.15?1:0;
  score+=techniques.size>=4?2:techniques.size>=2?1:0;
  const highestFret=Math.max(0,...positions.map(note=>note.fret));score+=highestFret>=17?2:highestFret>=12?1:0;
  score=Math.min(10,score);
  const positionText=fretMovement===null?'source positions unavailable':`avg. fret/string move ${fretMovement.toFixed(1)}`;
  return {score,level:levelFor(score),attacks:playable.length,attacksPerSecond:Number(attacksPerSecond.toFixed(1)),effectiveBpm,chordRate:Number(chordRate.toFixed(2)),fretMovement,techniqueCount:techniques.size,highestFret,summary:`${attacksPerSecond.toFixed(1)} attacks/s · ${effectiveBpm} BPM · ${Math.round(chordRate*100)}% multi-note attacks · ${positionText} · ${techniques.size} techniques`};
}
