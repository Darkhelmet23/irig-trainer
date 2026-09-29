import {TUNING,noteName} from './curriculum.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const targetId=event=>event?.chord?`chord:${event.chord}`:`note:${event?.midi}`;
const targetName=event=>event?.chord||noteName(event?.midi||60);
const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;

function timingBins(values){
  const bins=[{label:'Early >150 ms',min:-Infinity,max:-150,count:0},{label:'Early 50-150 ms',min:-150,max:-50,count:0},{label:'On beat ±50 ms',min:-50,max:50,count:0},{label:'Late 50-150 ms',min:50,max:150,count:0},{label:'Late >150 ms',min:150,max:Infinity,count:0}];
  for(const value of values){const bin=bins.find((item,index)=>value>=item.min&&(value<item.max||index===bins.length-1&&value<=item.max));if(bin)bin.count++;}
  return bins;
}

function timingSummary(values){
  const bias=mean(values),absolute=values.map(Math.abs).sort((a,b)=>a-b),medianAbsolute=absolute.length?Math.round(absolute[Math.floor(absolute.length/2)]):null;
  const direction=bias===null?'unavailable':bias>35?'dragging':bias< -35?'rushing':'steady';
  return {bias:bias===null?null:Math.round(bias),medianAbsolute,direction,samples:values.length,bins:timingBins(values)};
}

export function analyzeSession(session,result,history=[]){
  const events=session.events.filter(event=>!event.passive),timed=session.rule.mode!=='wait'&&session.accuracyMode!=='pitch';
  const deltas=timed?events.map(event=>event.deltaMs).filter(Number.isFinite):[],timing=timingSummary(deltas),sections=new Map(),weak=new Map();
  for(const event of events){
    const measure=Number.isInteger(event.measure)?event.measure:null;
    if(measure){const section=sections.get(measure)||{measure,hits:0,total:0,deltas:[]};section.total++;section.hits+=event.status==='hit'?1:0;if(Number.isFinite(event.deltaMs))section.deltas.push(event.deltaMs);sections.set(measure,section);}
    const id=targetId(event),item=weak.get(id)||{label:targetName(event),misses:0,total:0};item.total++;if(event.status!=='hit'||event.wrongAttempts)item.misses++;weak.set(id,item);
  }
  const rankedSections=[...sections.values()].map(section=>({...section,accuracy:Math.round(100*section.hits/section.total),bias:mean(section.deltas)})).sort((a,b)=>a.accuracy-b.accuracy||b.total-a.total);
  const weakest=rankedSections[0]||null,strongest=rankedSections.length>1?rankedSections.at(-1):null;
  const weakTarget=[...weak.values()].filter(item=>item.misses).sort((a,b)=>b.misses-a.misses||a.label.localeCompare(b.label))[0]||null;
  const title=session.skill.title,similar=history.filter(run=>run.title===title),previous=similar[0]||null;
  const personalBest=similar.reduce((best,run)=>!best||run.accuracy>best.accuracy?run:best,null);
  let personalBestMessage=personalBest?`Previous best: ${personalBest.accuracy}% accuracy.`:'First saved run for this lesson.';
  if(personalBest&&result.accuracy>personalBest.accuracy)personalBestMessage=`New personal best: ${result.accuracy}% (up from ${personalBest.accuracy}%).`;
  else if(personalBest&&Number.isFinite(personalBest.trace?.[0])&&timing.medianAbsolute!==null){const old=personalBest.trace.filter(Number.isFinite).map(Math.abs).sort((a,b)=>a-b);if(old.length){const oldMedian=old[Math.floor(old.length/2)],change=oldMedian-timing.medianAbsolute;personalBestMessage+=` Timing ${change>=0?'improved':'shifted'} by ${Math.abs(change)} ms versus that run.`;}}
  const bpm=session.rule.bpm||0,bpmChange=previous&&bpm&&previous.bpm?bpm-previous.bpm:null;
  let recommendation='Repeat this lesson at the same tempo and aim for a cleaner, more even run.';
  if(weakest&&weakest.accuracy<85)recommendation=`Loop measure ${weakest.measure} at a slower tempo until it reaches 90%, then raise speed by 5%.`;
  else if(weakTarget)recommendation=`Use the weak-spot warm-up for ${weakTarget.label}, then retry this lesson.`;
  else if(timing.direction==='dragging')recommendation='You tend to play late. Keep the metronome on and try 5-10 BPM slower.';
  else if(timing.direction==='rushing')recommendation='You tend to play early. Use the count-in and leave more space before each beat.';
  else if(result.accuracy>=90)recommendation='You are ready to raise tempo by 5-10 BPM or move to the next challenge.';
  return {title,accuracy:result.accuracy,hits:session.hits,total:session.total,bpm,bpmChange,timing,weakest,strongest,weakTarget,personalBestMessage,recommendation,hasSections:rankedSections.length>0};
}

export function sessionCoachMarkup(report){
  const timing=report.timing,sectionText=section=>section?`Measure ${section.measure}: ${section.accuracy}% (${section.hits}/${section.total})`:null;
  const histogram=timing.samples?`<div class="timing-histogram" role="img" aria-label="Timing error distribution">${timing.bins.map(bin=>`<div class="timing-bin"><span>${esc(bin.label)}</span><div class="meter"><div style="width:${Math.round(100*bin.count/Math.max(1,...timing.bins.map(item=>item.count)))}%"></div></div><b>${bin.count}</b></div>`).join('')}</div>`:'<p class="tiny muted">This guided or pitch-only run did not score timing.</p>';
  return `<section class="session-coach page-panel"><div class="section-heading"><div><span class="eyebrow">YOUR NEXT BEST STEP</span><h3>Session coach</h3></div><span class="chip">${report.accuracy}% accuracy</span></div><div class="session-insight-grid"><div><small>Timing bias</small><strong>${timing.bias===null?'Not graded':`${timing.bias>0?'+':''}${timing.bias} ms · ${esc(timing.direction)}`}</strong><span>${timing.samples?`${timing.samples} attacks measured`:'Select a timing mode to see early/late trends'}</span></div><div><small>Tempo</small><strong>${report.bpm?`${report.bpm} BPM`:'Player pace'}</strong><span>${report.bpmChange===null?'No earlier run to compare':`${report.bpmChange>=0?'+':''}${report.bpmChange} BPM from the previous run`}</span></div><div><small>Personal best</small><strong>${esc(report.personalBestMessage)}</strong><span>${report.hits} of ${report.total} targets hit</span></div></div><h4>Early / late timing</h4>${histogram}<div class="session-section-highlights">${report.weakest?`<span class="chip weak-chip">Hardest passage · ${esc(sectionText(report.weakest))}</span>`:''}${report.strongest?`<span class="chip strong-chip">Strongest passage · ${esc(sectionText(report.strongest))}</span>`:''}</div><p class="notice coach-recommendation">${esc(report.recommendation)}</p><button class="outline-btn" id="result-warmup">Build a weak-spot warm-up</button></section>`;
}

export function dashboardCoachMarkup(profile){
  const history=profile.history||[],recent=history.slice(0,12),targets=new Map(),measures=new Map(),timing=[];
  for(const run of recent){
    for(const item of run.targets||[]){const target=targets.get(item.key)||{label:item.label,hits:0,total:0};target.total++;target.hits+=item.hit?1:0;targets.set(item.key,target);if(item.measure){const section=measures.get(item.measure)||{measure:item.measure,hits:0,total:0};section.total++;section.hits+=item.hit?1:0;measures.set(item.measure,section);}}
    if(run.timingMode&&run.timingMode!=='wait')timing.push(...(run.trace||[]).filter(Number.isFinite));
  }
  const weak=[...targets.values()].filter(target=>target.total>=2).map(target=>({...target,accuracy:Math.round(100*target.hits/target.total)})).sort((a,b)=>a.accuracy-b.accuracy)[0];
  const weakMeasure=[...measures.values()].filter(section=>section.total>=3).map(section=>({...section,accuracy:Math.round(100*section.hits/section.total)})).sort((a,b)=>a.accuracy-b.accuracy)[0];
  let message=history.length?'Keep building a consistent practice habit.':'Start with a short warm-up; the coach will personalize it as you play.';
  if(weakMeasure&&weakMeasure.accuracy<85)message=`Your recent runs struggle most around measure ${weakMeasure.measure} (${weakMeasure.accuracy}%). Loop it slowly, then build back up.`;
  else if(weak)message=`Your biggest recent weak spot is ${weak.label} (${weak.accuracy}% accuracy). A short targeted warm-up is ready.`;
  else if(timing.length){const bias=Math.round(mean(timing));if(bias>35)message=`You tend to drag by about ${bias} ms. Try the metronome and a slightly slower tempo.`;else if(bias< -35)message=`You tend to rush by about ${Math.abs(bias)} ms. Use the count-in and leave more space before the beat.`;else message='Your recent timing is centered near the beat. Try raising tempo by 5 BPM.';}
  const bins=timingBins(timing),hist=timing.length?`<div class="timing-histogram compact">${bins.map(bin=>`<div class="timing-bin"><span>${esc(bin.label)}</span><div class="meter"><div style="width:${Math.round(100*bin.count/Math.max(1,...bins.map(item=>item.count)))}%"></div></div><b>${bin.count}</b></div>`).join('')}</div>`:'<p class="tiny muted">A timing distribution appears after your first scrolling session.</p>';
  return `<section class="page-panel coach-dashboard"><div class="section-heading"><div><span class="eyebrow">PERSONAL COACH</span><h2>Today's recommendation</h2></div><button class="primary" data-hub-drill="warmup">Start weak-spot warm-up</button></div><p>${esc(message)}</p>${hist}</section>`;
}

export function weakSpotWarmup(profile,tuning=TUNING){
  const activeTuning=Array.isArray(tuning)&&tuning.length>=4?tuning:TUNING;
  const positions=new Map();
  for(const run of profile?.history||[])for(const item of run.targets||[]){if(!Number.isInteger(item.string)||item.string<1||item.string>activeTuning.length||!Number.isInteger(item.fret))continue;const key=`${item.string}:${item.fret}`,position=positions.get(key)||{string:item.string,fret:item.fret,hits:0,total:0};position.total++;position.hits+=item.hit?1:0;positions.set(key,position);}
  let selected=[...positions.values()].filter(position=>position.total>=2&&position.hits/position.total<.9).sort((a,b)=>a.hits/a.total-b.hits/b.total||b.total-a.total).slice(0,4);
  const personalized=selected.length>0,low=Math.max(1,Math.min(6,activeTuning.length)-1),high=Math.min(6,activeTuning.length);if(!personalized)selected=[{string:high,fret:0},{string:high,fret:3},{string:low,fret:0},{string:low,fret:2}];
  const bpm=64,pattern=Array.from({length:12},(_,index)=>{const position=selected[index%selected.length],midi=activeTuning[position.string-1]+position.fret;return {string:position.string,fret:position.fret,midi,notes:[{...position,midi}],offsetMs:index*60000/bpm,durationMs:60000/bpm,measure:Math.floor(index/4)+1,techniques:[]};});
  return {id:'warmup-generated',title:personalized?'Weak-spot warm-up':'Starter warm-up',track:'tabs',requires:null,timed:true,speed:.75,bpm,tuning:activeTuning.slice(),sequence:pattern,guide:personalized?'Generated from your recent string/fret accuracy. Play each target cleanly, then repeat the hardest positions before returning to your song.':'A short starter pattern while the coach learns your weak positions. Your future warm-ups will adapt to your practice history.'};
}

function scaledSongSkill(skill,newSpeed){const oldSpeed=skill.speed||1,ratio=oldSpeed/newSpeed;return {...skill,speed:newSpeed,bpm:skill.bpm*newSpeed/oldSpeed,sequence:skill.sequence.map(event=>({...event,offsetMs:event.offsetMs*ratio,durationMs:event.durationMs*ratio}))};}
function adaptiveSection(session){
  const misses=session.events.filter(event=>!event.passive&&(event.status==='miss'||event.status==='wrong'||event.wrongAttempts));if(misses.length<2)return null;
  const id=targetId,eventCounts=new Map();for(const event of misses){const key=id(event);eventCounts.set(key,(eventCounts.get(key)||0)+1);}const [targetKey,count]=[...eventCounts].sort((a,b)=>b[1]-a[1])[0];if(count<2)return null;
  const failed=misses.find(event=>id(event)===targetKey),measure=failed?.measure||1,measureMisses=misses.filter(event=>(event.measure||1)===measure).length;let sequence,label;
  if(session.skill.timed&&measureMisses>=2){sequence=session.skill.sequence.filter(event=>(event.measure||1)===measure);if(sequence.length<2)sequence=session.skill.sequence.filter(event=>Math.abs((event.measure||1)-measure)<=1);label=`measure ${measure}`;}
  else{const target=session.skill.sequence.find(event=>id(event)===targetKey);if(!target)return null;sequence=session.skill.timed?Array.from({length:4},(_,index)=>({...target,offsetMs:index*60000/Math.max(30,session.skill.bpm*.8),durationMs:60000/Math.max(30,session.skill.bpm*.8),measure:1})):Array.from({length:6},()=>({...target}));label=target.chord||noteName(target.midi);}
  if(!sequence.length)return null;const nextSpeed=Math.max(.4,(session.skill.speed||1)*.8),ratio=(session.skill.speed||1)/nextSpeed,first=sequence[0].offsetMs||0;
  if(session.skill.timed)sequence=sequence.map(event=>({...event,offsetMs:((event.offsetMs||0)-first)*ratio,durationMs:(event.durationMs||250)*ratio}));
  return {...session.skill,title:`${session.skill.title} · Focus ${label}`,speed:nextSpeed,bpm:session.skill.bpm?session.skill.bpm*nextSpeed/(session.skill.speed||1):session.rule.bpm*.8,adaptiveTempo:!session.skill.timed,adaptiveReplay:true,sequence,guide:`Adaptive replay focused on ${label}, slowed by 20%. Repeat the phrase and aim for clean, even attacks.`};
}

export function nextPractice(lesson,session,result){
  const options=session.practiceOptions||{};if(!lesson||session.userStoppedEndless)return null;
  if(session.skill.tempoLadder&&options.progressionPractice&&result.accuracy>=90){const stages=session.skill.tempoStages||[.6,.7,.8,.9,1],stage=Number(session.skill.tempoStage)||0;if(stage<stages.length-1){const nextStage=stage+1,bpm=Math.round(session.skill.tempoTargetBpm*stages[nextStage]),beat=60000/bpm;lesson.skill={...lesson.skill,bpm,speed:stages[nextStage],tempoStage:nextStage,sequence:lesson.skill.sequence.map((event,index)=>({...event,offsetMs:index*beat,durationMs:beat}))};lesson.loopRound=1;return `Great run · scale tempo ladder moving to ${Math.round(stages[nextStage]*100)}% (${bpm} BPM).`;}}
  if(session.skill.timed&&options.speedLadder&&result.accuracy>=90&&(session.skill.speed||1)<.995){const next=Math.min(1,Math.round(((session.skill.speed||1)+.1)*10)/10);lesson.skill=scaledSongSkill(session.skill,next);lesson.loopRound=1;return `Great run · speed ladder moving to ${Math.round(next*100)}%.`;}
  if(session.skill.timed&&options.loop&&session.loopRound<3&&result.accuracy>=75){lesson.loopRound=session.loopRound+1;return `A-B loop ${lesson.loopRound}/3 · keep the section moving.`;}
  if(options.adaptive&&result.accuracy<80){const focused=adaptiveSection(session);if(focused){lesson.skill=focused;lesson.options={...options,adaptive:false,loop:false,speedLadder:false};lesson.loopRound=1;return `Adaptive coach found a section to slow down and repeat.`;}}
  return null;
}
