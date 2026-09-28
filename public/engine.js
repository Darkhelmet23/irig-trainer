import { SKILLS, BOOSTS, RULES, CHORDS, TUNING } from './curriculum.js';
export const emptyProfile = () => ({version:1,skills:{},xp:0,sessions:0,history:[]});
export function sanitizeProfile(raw) {
  const p = emptyProfile();
  if (!raw || raw.version!==1) return p;
  for (const s of SKILLS) { const t=raw.skills?.[s.id]; if (Number.isInteger(t) && t>=0 && t<=4 && (!s.requires || p.skills[s.requires]>=1)) p.skills[s.id]=t; }
  p.xp=Number.isFinite(raw.xp)?Math.max(0,Math.min(1e9,raw.xp)):0;
  p.sessions=Number.isInteger(raw.sessions)?Math.max(0,raw.sessions):0;
  p.history=Array.isArray(raw.history)?raw.history.filter(h=>h&&typeof h.title==='string'&&typeof h.rank==='string'&&Number.isFinite(h.accuracy)).slice(0,20).map(h=>({title:h.title.slice(0,100),rank:h.rank.slice(0,20),accuracy:Math.max(0,Math.min(100,h.accuracy)),passed:h.passed===true})):[];
  return p;
}
export const unlocked = (skill,p) => !skill.requires || (p.skills[skill.requires]||0)>=1;
export const buffs = p => Object.entries(p.skills).filter(([id,t])=>SKILLS.some(s=>s.id===id)&&t>0).sort((a,b)=>BOOSTS[b[1]]-BOOSTS[a[1]]).slice(0,3).map(([id,t])=>({id,tier:t,boost:BOOSTS[t]}));
export const boostTotal = p => buffs(p).reduce((sum,b)=>sum+b.boost,0);
export function scoreResult({hits,total,attempts,mode,boost=0,ai=0,threshold}) {
  const accuracy=total>0?Math.round(100*hits/Math.max(total,mode==='wait'?attempts:total)):0;
  const base=Math.round(accuracy*10);
  const points=Math.round(base*(1+boost/100));
  const aiPoints=Math.round(ai*10);
  return {hits,total,accuracy,points,aiPoints,passed:accuracy>=threshold&&(mode!=='battle'||points>aiPoints)};
}
export function award(p,skill,rule,result) {
  if (!unlocked(skill,p)||!result.passed||rule.tier!==(p.skills[skill.id]||0)+1) return false;
  p.skills[skill.id]=rule.tier; p.xp+=rule.tier*100; return true;
}
export function makeSession(skill,rule,profile,now=0) {
  const pattern=skill.sequence;
  const count=skill.timed?pattern.length:Math.max(12,pattern.length*2);
  const events=Array.from({length:count},(_,i)=>({...pattern[i%pattern.length],at:now+3000+(skill.timed?pattern[i].offsetMs:i*60000/rule.bpm),status:'pending'}));
  if(skill.timed)events.forEach((e,i)=>{const next=events.slice(i+1).find(n=>!n.passive);e.window=next?Math.min(rule.window,(next.at-e.at)*.45):rule.window;});
  return {skill,rule,events,total:events.filter(e=>!e.passive).length,index:0,judged:0,hits:0,attempts:0,boost:boostTotal(profile),started:now,ended:false,feedback:'Get ready',lastAttempt:-Infinity};
}
export function advanceMisses(s,now) {
  if(s.ended)return;
  while(s.index<s.events.length){const e=s.events[s.index];
    if(e.passive&&(s.rule.mode==='wait'||now>=e.at+e.durationMs)){e.status='pass';s.index++;continue;}
    if(s.rule.mode!=='wait'&&!e.passive&&now>e.at+(e.window??s.rule.window)){e.status='miss';s.index++;s.judged++;s.feedback='Missed · keep going';continue;}
    break;
  }
  s.ended=s.index===s.events.length;
}
export function attempt(s,match,now) {
  if(s.ended||now<s.started+3000||now-s.lastAttempt<(s.skill.timed?60:160)) return false;
  advanceMisses(s,now); if(s.ended)return false;
  const event=s.events[s.index];
  if(event.passive)return false;
  if(s.rule.mode!=='wait' && Math.abs(now-event.at)>(event.window??s.rule.window)) {s.feedback='Too early · watch the play line';return false;}
  s.lastAttempt=now;s.attempts++;
  if(match){event.status='hit';s.hits++;s.index++;s.judged++;s.feedback='Nice!';}
  else {s.feedback='Try again · listen to the target';if(s.rule.mode!=='wait'){event.status='wrong';s.index++;s.judged++;s.feedback='Wrong note · keep going';}}
  s.ended=s.index===s.events.length; return true;
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
