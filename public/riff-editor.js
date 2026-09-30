import {timeSignatureBeats} from './song-studio.js';

const STRING_NAMES=['e','B','G','D','A','E','B','F#'];
const id=()=>globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2,12);

export function renderRiffEditor(section,{tuning=[],timeSignature='4/4',esc=value=>String(value)}={}){
  const measures=Math.max(1,Math.min(16,Number(section.measureCount)||2)),beats=Math.max(1,Math.min(12,Math.round(timeSignatureBeats(timeSignature))));
  const headings=Array.from({length:measures*beats},(_,index)=>{
    const measure=Math.floor(index/beats)+1,beat=index%beats+1;
    return '<th scope="col">m'+measure+'<br><span>'+beat+'</span></th>';
  }).join('');
  const rows=Array.from({length:Math.min(8,Math.max(4,tuning.length||6))},(_,index)=>{
    const labelIndex=Math.max(0,6-Math.min(8,tuning.length||6))+index,label=STRING_NAMES[labelIndex]||('S'+(index+1));
    const string=index+1,cells=Array.from({length:measures*beats},(_,step)=>{
      const measure=Math.floor(step/beats)+1,beat=step%beats+1,event=section.riff?.find(item=>item.measure===measure&&Math.abs(item.beat-beat)<.01);
      const note=event?.notes?.find(item=>item.string===string),value=note?.fret??'';
      return '<td><input type="number" min="0" max="24" inputmode="numeric" value="'+value+'" aria-label="'+esc(label)+' string, measure '+measure+', beat '+beat+', fret" data-riff-cell data-string="'+string+'" data-measure="'+measure+'" data-beat="'+beat+'"></td>';
    }).join('');
    return '<tr><th scope="row">'+label+'</th>'+cells+'</tr>';
  }).join('');
  const rests=Array.from({length:measures*beats},(_,step)=>{
    const measure=Math.floor(step/beats)+1,beat=step%beats+1,event=section.riff?.find(item=>item.measure===measure&&Math.abs(item.beat-beat)<.01),pressed=!!event?.rest;
    return '<td><button class="riff-rest '+(pressed?'selected':'')+'" type="button" aria-pressed="'+pressed+'" aria-label="'+(pressed?'Remove':'Mark')+' rest at measure '+measure+', beat '+beat+'" data-riff-rest data-measure="'+measure+'" data-beat="'+beat+'">'+(pressed?'Rest':'·')+'</button></td>';
  }).join('');
  return '<section class="studio-lane riff-lane"><div class="studio-lane-heading"><div><span class="eyebrow">GUITAR TAB</span><h3>Riff editor</h3></div><div class="studio-lane-actions"><button class="subtle-btn" data-add-measure>Add measure</button><button class="outline-btn" data-capture-riff>Capture riff <span class="tiny">experimental</span></button></div></div><p class="tiny muted">Enter fret numbers on the beat grid. Add notes on other strings at the same beat to make a chord. Empty cells are open space; use Rest for an intentional rest.</p><div class="riff-grid-scroll"><table class="riff-grid"><thead><tr><th scope="col">String</th>'+headings+'</tr></thead><tbody>'+rows+'<tr class="riff-rest-row"><th scope="row">Rest</th>'+rests+'</tr></tbody></table></div><div class="capture-draft" data-capture-draft hidden></div></section>';
}

export function bindRiffEditor(root,section,{tuning=[],onChange=()=>{},onCapture=()=>{}}={}){
  root.querySelectorAll('[data-riff-cell]').forEach(input=>input.addEventListener('input',()=>{
    const string=Number(input.dataset.string),measure=Number(input.dataset.measure),beat=Number(input.dataset.beat),fret=input.value===''?null:Number(input.value);
    if(fret!==null&&(!Number.isInteger(fret)||fret<0||fret>24)){input.value='';return;}
    let event=section.riff.find(item=>item.measure===measure&&Math.abs(item.beat-beat)<.01);
    if(fret===null){
      if(event){event.notes=event.notes.filter(note=>note.string!==string);if(!event.notes.length&&!event.rest)section.riff=section.riff.filter(item=>item!==event);}
    }else{
      if(!event){event={id:'riff-'+id(),measure,beat,durationBeats:1,notes:[],rest:false};section.riff.push(event);}
      event.rest=false;
      const note={string,fret,midi:Number.isInteger(tuning[string-1])?tuning[string-1]+fret:null},old=event.notes.findIndex(item=>item.string===string);
      if(old>=0)event.notes[old]=note;else event.notes.push(note);
    }
    onChange('note');
  }));
  root.querySelectorAll('[data-riff-rest]').forEach(button=>button.addEventListener('click',()=>{
    const measure=Number(button.dataset.measure),beat=Number(button.dataset.beat),event=section.riff.find(item=>item.measure===measure&&Math.abs(item.beat-beat)<.01);
    if(event?.rest)section.riff=section.riff.filter(item=>item!==event);
    else if(event){event.notes=[];event.rest=true;}
    else section.riff.push({id:'riff-'+id(),measure,beat,durationBeats:1,notes:[],rest:true});
    onChange('rest');
  }));
  root.querySelector('[data-add-measure]')?.addEventListener('click',()=>{
    section.measureCount=Math.min(16,(Number(section.measureCount)||2)+1);onChange('measure');
  });
  root.querySelector('[data-capture-riff]')?.addEventListener('click',onCapture);
}