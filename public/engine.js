import { SKILLS, BOOSTS, RULES, CHORDS, TUNING } from './curriculum.js';
import {awardPracticeXP,migrateSkillXP,progressionTargetsForLesson,masteryTier,progressionNode} from './progression.js';
import {generatePracticeSequence,practiceLengthForRule} from './lesson-patterns.js';
export const emptyProfile = () => ({version:3,skills:{},skillXP:{},masteryChallenges:{},xp:0,sessions:0,history:[]});
export function sanitizeProfile(raw) {
  const p = emptyProfile();
  if (!raw || ![1,2,3].includes(raw.version)) return p;
  for (const s of SKILLS) { const t=raw.skills?.[s.id]; if (Number.isInteger(t) && t>=0 && t<=4 && (!s.requires || p.skills[s.requires]>=1)) p.skills[s.id]=t; }
  p.skillXP=migrateSkillXP(p.skills,raw.skillXP);
  p.masteryChallenges=Object.fromEntries(Object.entries(raw.masteryChallenges||{}).filter(([id,value])=>progressionNode(id)&&value===true));
  p.xp=Number.isFinite(raw.xp)?Math.max(0,Math.min(1e9,raw.xp)):0;
  p.sessions=Number.isInteger(raw.sessions)?Math.max(0,raw.sessions):0;
  p.history=Array.isArray(raw.history)?raw.history.filter(h=>h&&typeof h.title==='string'&&typeof h.rank==='string'&&Number.isFinite(h.accuracy)).slice(0,200).map(h=>({
    id:typeof h.id==='string'&&h.id.length<=120?h.id:'',
    title:h.title.slice(0,100),rank:h.rank.slice(0,20),accuracy:Math.max(0,Math.min(100,h.accuracy)),passed:h.passed===true,at:Number.isFinite(h.at)?h.at:0,
    lessonId:typeof h.lessonId==='string'?h.lessonId.slice(0,80):'',activityKey:typeof h.activityKey==='string'?h.activityKey.slice(0,100):'',xpAwarded:Number.isFinite(h.xpAwarded)?Math.max(0,Math.min(1000,h.xpAwarded)):0,
    bpm:Number.isFinite(h.bpm)?h.bpm:0,speed:Number.isFinite(h.speed)?h.speed:1,hits:Number.isFinite(h.hits)?h.hits:0,total:Number.isFinite(h.total)?h.total:0,durationMs:Number.isFinite(h.durationMs)?h.durationMs:0,
    timingMode:['wait','flow','battle'].includes(h.timingMode)?h.timingMode:'wait',
    targets:Array.isArray(h.targets)?h.targets.filter(t=>t&&typeof t.key==='string'&&typeof t.label==='string').slice(0,256).map(t=>({key:t.key.slice(0,64),label:t.label.slice(0,64),kind:typeof t.kind==='string'?t.kind:'note',hit:t.hit===true,string:Number.isInteger(t.string)&&t.string>=1&&t.string<=8?t.string:null,fret:Number.isInteger(t.fret)&&t.fret>=0&&t.fret<=36?t.fret:null,measure:Number.isInteger(t.measure)&&t.measure>0?t.measure:null})):[],
    trace:Array.isArray(h.trace)?h.trace.slice(0,256).map(t=>Number.isFinite(t)?t:null):[]
  })):[];
  return p;
}
export const unlocked = (skill,p) => !skill.requires || (p.skills[skill.requires]||0)>=1;
export const buffs = p => {
  const legacy=Object.entries(p.skills||{}).filter(([id,t])=>SKILLS.some(s=>s.id===id)&&t>0).sort((a,b)=>BOOSTS[b[1]]-BOOSTS[a[1]]).slice(0,3).map(([id,t])=>({id,tier:t,boost:BOOSTS[t]}));
  const mastered=Object.entries(p.skillXP||{}).map(([id,xp])=>({id,tier:masteryTier(xp)})).filter(item=>progressionNode(item.id)&&item.tier>0).sort((a,b)=>BOOSTS[b.tier]-BOOSTS[a.tier]||b.tier-a.tier).slice(0,3).map(item=>({...item,boost:BOOSTS[item.tier]}));
  return mastered.length?mastered:legacy;
};
export const boostTotal = p => buffs(p).reduce((sum,b)=>sum+b.boost,0);
export function scoreResult({hits,total,attempts,mode,boost=0,ai=0,threshold}) {
  const accuracy=total>0?Math.round(100*hits/Math.max(total,mode==='wait'?attempts:total)):0;
  const base=Math.round(accuracy*10);
  const points=Math.round(base*(1+boost/100));
  const aiPoints=Math.round(ai*10);
  return {hits,total,accuracy,points,aiPoints,passed:accuracy>=threshold&&(mode!=='battle'||points>aiPoints)};
}
export function award(p,skill,rule,result) {
  if(skill.progressionSkills?.length)return false;
  if (!unlocked(skill,p)||!result.passed||rule.tier!==(p.skills[skill.id]||0)+1) return false;
  p.skills[skill.id]=rule.tier; return true;
}
export {awardPracticeXP,progressionTargetsForLesson};
export function makeSession(skill,rule,profile,now=0,countInMs=3000,options={}) {
  const library=!!(options.library||skill.libraryPractice),endless=!!(options.endless||skill.endlessPractice);
  const shouldExpand=!skill.timed&&!library&&/^(tabs-|chords-|drill-)/.test(String(skill.id||''));
  const pattern=shouldExpand?generatePracticeSequence(skill,practiceLengthForRule(rule)):skill.sequence;
  const count=skill.timed?pattern.length:shouldExpand?pattern.length:Math.max(12,pattern.length*2);
  const events=Array.from({length:count},(_,i)=>({...pattern[i%pattern.length],at:now+countInMs+(skill.timed?pattern[i].offsetMs:i*60000/rule.bpm),status:'pending'}));
  if(skill.timed)events.forEach((e,i)=>{const next=events.slice(i+1).find(n=>!n.passive);e.window=next?Math.min(rule.window,(next.at-e.at)*.45):rule.window;});
  return {skill,rule,events,practiceTemplate:endless&&!skill.timed?pattern:[],endless:endless&&!skill.timed&&!library,total:events.filter(e=>!e.passive).length,index:0,judged:0,hits:0,attempts:0,boost:boostTotal(profile),started:now,countInMs,ended:false,feedback:'Get ready',lastAttempt:-Infinity};
}
function appendEndlessBlock(session){
  if(!session.endless||!session.practiceTemplate.length)return;
  const beat=60000/Math.max(30,session.rule.bpm||60),start=(session.events.at(-1)?.at??session.started)+beat,measureOffset=Math.floor(session.events.length/4);
  const events=session.practiceTemplate.map((event,index)=>({...event,at:start+index*beat,measure:measureOffset+Math.floor(index/4)+1,status:'pending'}));
  session.events.push(...events);session.total+=events.filter(event=>!event.passive).length;
}
function updateSessionEnd(session){if(session.index!==session.events.length)return;if(session.endless){appendEndlessBlock(session);return;}session.ended=true;}
export function advanceMisses(s,now) {
  if(s.ended)return;
  while(s.index<s.events.length){const e=s.events[s.index];
    if(e.passive&&(s.rule.mode==='wait'||now>=e.at+e.durationMs)){e.status='pass';s.index++;continue;}
    if(s.rule.mode!=='wait'&&!e.passive&&now>e.at+(e.window??s.rule.window)){e.status='miss';s.index++;s.judged++;s.feedback='Missed · keep going';continue;}
    break;
  }
  updateSessionEnd(s);
}
export function attempt(s,match,now) {
  if(s.ended||now<s.started+s.countInMs||now-s.lastAttempt<(s.skill.timed?60:160)) return false;
  advanceMisses(s,now); if(s.ended)return false;
  const event=s.events[s.index];
  if(event.passive)return false;
  if(s.rule.mode!=='wait' && Math.abs(now-event.at)>(event.window??s.rule.window)) {s.feedback='Too early · watch the play line';return false;}
  s.lastAttempt=now;s.attempts++;event.deltaMs=Math.round(now-event.at);
  if(match){event.status='hit';s.hits++;s.index++;s.judged++;s.feedback='Nice!';}
  else {event.wrongAttempts=(event.wrongAttempts||0)+1;s.feedback='Try again · listen to the target';if(s.rule.mode!=='wait'){event.status='wrong';s.index++;s.judged++;s.feedback='Wrong note · keep going';}}
  updateSessionEnd(s); return true;
}
export function validatePack(data) {
  if(!data||data.version!==1||typeof data.title!=='string'||!data.title.trim()||data.title.length>100)throw new Error('A pack needs version 1 and a title (1–100 characters).');
  if(!['CC0-1.0','CC-BY-4.0','CC-BY-SA-4.0','Public-Domain'].includes(data.license))throw new Error('Choose CC0-1.0, CC-BY-4.0, CC-BY-SA-4.0 or Public-Domain.');
  if(typeof data.author!=='string'||!data.author.trim()||data.author.length>160)throw new Error('Include the author or arranger (up to 160 characters).');
  try {if(!['https:','http:'].includes(new URL(data.source).protocol))throw 0;}catch{throw new Error('Include a valid http or https source URL.');}
  if(!Array.isArray(data.sequence)||data.sequence.length<4||data.sequence.length>256)throw new Error('Include 4–256 tab notes or chords.');
  const sequence=data.sequence.map(e=>{
    if(e&&typeof e.chord==='string'&&Object.hasOwn(CHORDS,e.chord))return {chord:e.chord};
    if(e&&Number.isInteger(e.string)&&e.string>=1&&e.string<=6&&Number.isInteger(e.fret)&&e.fret>=0&&e.fret<=24)return {string:e.string,fret:e.fret,midi:TUNING[e.string-1]+e.fret};
    throw new Error('Each event needs a supported chord name or string (1–6) and fret (0–24).');
  });
  if(sequence.some(e=>e.chord)&&sequence.some(e=>!e.chord))throw new Error('Keep each pack to either tabs or chords.');
  return {version:1,title:data.title.trim(),author:data.author.trim(),source:data.source,license:data.license,sequence};
}
export { RULES };
