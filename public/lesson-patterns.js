import {TUNING} from './curriculum.js';

const copy=event=>({...event,notes:event.notes?.map(note=>({...note}))});
const rotate=(sequence,offset)=>[...sequence.slice(offset),...sequence.slice(0,offset)];
const signature=sequence=>sequence.map(event=>event.chord||`${event.midi}:${event.string}:${event.fret}`).join('|');

function alternatePosition(event,index,tuning){
  if(event.chord||!Number.isFinite(event.midi))return copy(event);
  const positions=[];
  for(let string=1;string<=tuning.length;string++)for(let fret=0;fret<=12;fret++)if(tuning[string-1]+fret===event.midi&&string!==event.string)positions.push({string,fret});
  if(!positions.length)return copy(event);
  positions.sort((a,b)=>(Math.abs(a.fret-event.fret)*2+Math.abs(a.string-event.string))-(Math.abs(b.fret-event.fret)*2+Math.abs(b.string-event.string)));
  const target=positions[index%Math.min(2,positions.length)];
  const next=copy(event);next.string=target.string;next.fret=target.fret;
  if(next.notes?.length)next.notes=next.notes.map(note=>note.midi===event.midi?{...note,string:target.string,fret:target.fret}:note);
  return next;
}

function phrasesFor(skill){
  const source=skill.sequence.map(copy);if(source.length<2)return [source];
  const authored=(skill.practicePhrases||[]).filter(phrase=>Array.isArray(phrase)&&phrase.length).map(phrase=>phrase.map(copy));
  const phrases=[...authored,source,source.slice().reverse(),rotate(source,Math.floor(source.length/2))];
  if(source.length>=4)phrases.push([...source.slice(0,-2),source.at(-1),source.at(-2)]);
  if(skill.scaleName&&source.length>=8){const width=Math.max(3,Math.floor(source.length/2)),fragment=source.slice(0,width);phrases.push([...fragment,...fragment.slice().reverse().slice(1)]);}
  const seen=new Set();return phrases.filter(phrase=>{const key=signature(phrase);if(seen.has(key))return false;seen.add(key);return true;});
}

export function practiceLengthForRule(rule={}){
  const tier=Math.max(1,Math.min(4,Math.trunc(Number(rule.tier)||1)));
  return [32,48,72,96][tier-1];
}

export function generatePracticeSequence(skill,requestedLength=practiceLengthForRule()){
  if(!Array.isArray(skill?.sequence)||!skill.sequence.length)return [];
  const target=Math.max(1,Math.min(120,Math.trunc(Number(requestedLength)||32))),phrases=phrasesFor(skill),tuning=Array.isArray(skill.tuning)&&skill.tuning.length?skill.tuning:TUNING;
  const sequence=[];let phraseNumber=0;
  while(sequence.length<target){
    let phrase=phrases[phraseNumber%phrases.length].map(copy);
    if(phraseNumber%2===1&&skill.track==='tabs'&&!skill.hiddenTarget)phrase=phrase.map((event,index)=>index%2?alternatePosition(event,index,tuning):event);
    if(phraseNumber%4===3&&phrase.length>=4){const midpoint=Math.ceil(phrase.length/2),opening=phrase.slice(0,midpoint),ending=phrase.slice(midpoint).reverse();phrase=[...opening,...ending];}
    for(const event of phrase){if(sequence.length>=target)break;sequence.push({...event,measure:Math.floor(sequence.length/4)+1,phrase:phraseNumber+1});}
    phraseNumber++;
  }
  return sequence;
}
