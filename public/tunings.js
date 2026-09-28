import {noteName} from './curriculum.js';
// All arrays use tablature order: highest string first, lowest string last.
const preset=(id,name,lowToHigh)=>({id,name,notes:lowToHigh.slice().reverse()});
export const TUNINGS=[
  preset('standard','Standard E',[40,45,50,55,59,64]),
  preset('drop-d','Drop D',[38,45,50,55,59,64]),
  preset('double-drop-d','Double Drop D',[38,45,50,55,59,62]),
  preset('half-down','Half step down (E♭)',[39,44,49,54,58,63]),
  preset('d-standard','D standard',[38,43,48,53,57,62]),
  preset('c-standard','C standard',[36,41,46,51,55,60]),
  preset('b-standard','B standard',[35,40,45,50,54,59]),
  preset('drop-c-sharp','Drop C♯',[37,44,49,54,58,63]),
  preset('drop-c','Drop C',[36,43,48,53,57,62]),
  preset('drop-b','Drop B',[35,42,47,52,56,61]),
  preset('drop-a','Drop A',[33,40,45,50,54,59]),
  preset('dadgad','DADGAD',[38,45,50,55,57,62]),
  preset('open-d','Open D',[38,45,50,54,57,62]),
  preset('open-g','Open G',[38,43,50,55,59,62]),
  preset('open-e','Open E',[40,47,52,56,59,64]),
  preset('open-a','Open A',[40,45,52,57,61,64]),
  preset('open-c','Open C',[36,43,48,55,60,64]),
  preset('seven-standard','7-string standard',[35,40,45,50,55,59,64]),
  preset('seven-drop-a','7-string Drop A',[33,40,45,50,55,59,64]),
  preset('eight-standard','8-string standard',[30,35,40,45,50,55,59,64]),
];
export const validTuning=notes=>Array.isArray(notes)&&notes.length>=4&&notes.length<=8&&notes.every(n=>Number.isInteger(n)&&n>=24&&n<=88);
export const tuningLabel=notes=>notes.slice().reverse().map(noteName).join(' · ');
export function parseTuning(text){
  const notes=text.trim().split(/[\s,]+/).map(value=>{
    const m=/^([A-Ga-g])([#♯b♭]?)([0-6])$/.exec(value);
    if(!m)throw new Error('Use note names with octaves, low to high: D2 A2 D3 G3 B3 E4.');
    return (Number(m[3])+1)*12+({C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1].toUpperCase()])+(['#','♯'].includes(m[2])?1:['b','♭'].includes(m[2])?-1:0);
  }).reverse();
  if(!validTuning(notes))throw new Error('Enter 4–8 strings, from C1 through E6.');
  return notes;
}
export function tuningTarget(frequency,notes,fixedString=0,reference=440){
  if(!Number.isFinite(frequency)||frequency<=0||!validTuning(notes))return null;
  const exact=69+12*Math.log2(frequency/reference);
  const index=fixedString>=1&&fixedString<=notes.length?fixedString-1:notes.reduce((best,n,i)=>Math.abs(n-exact)<Math.abs(notes[best]-exact)?i:best,0);
  return {string:index+1,midi:notes[index],name:noteName(notes[index]),cents:100*(exact-notes[index]),frequency:reference*2**((notes[index]-69)/12)};
}
