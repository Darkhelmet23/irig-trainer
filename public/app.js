import {SKILLS,CHORDS,SHAPES,TIERS,BOOSTS,RULES,noteName,skillById} from './curriculum.js';
import {emptyProfile,sanitizeProfile,unlocked,buffs,boostTotal,scoreResult,award,awardPracticeXP,makeSession,advanceMisses,attempt,validatePack} from './engine.js';
import {PROGRESSION_NODES,progressionNode,isProgressionUnlocked,masteryProgress,MASTERY_NAMES} from './progression.js';
import {GuitarInput} from './audio.js';
import {TUNINGS,validTuning,parseTuning,tuningLabel,tuningTarget} from './tunings.js';
import {loadSongs,saveSong,deleteSong,songLesson,pitchClasses} from './songs.js';
import {REPERTOIRE} from './repertoire.js';
import {riffArcadeMarkup} from './arcade-ui.js';
import {progressPage,bindProgressPage} from './practice-hub.js';
import {createDrill,fretboardMap,scaleNames,chordProgressions} from './drills.js';
import {Metronome} from './metronome.js';
import {sessionToolsMarkup,bindSessionTools,renderInputDiagnostics} from './session-controls.js';
import {scorePracticeMarkup,updateSongDifficulty} from './score-practice.js';
import {libraryToolsMarkup,bindLibraryTools} from './library-tools.js';
import {InputDiagnostics} from './input-diagnostics.js';
import {analyzeSession,sessionCoachMarkup,dashboardCoachMarkup,nextPractice} from './session-coach.js';
import {createStorage} from './storage.js';
import {createProfileStore} from './profile-store.js';
import {createRouter,PAGE_NAMES} from './navigation.js';
import {renderSkillTreePage} from './skill-tree-ui.js';
import {renderLessonLibraryPage} from './lesson-library-ui.js';
import {renderProgressionLessons} from './progression-library-ui.js';
import {renderSetupPage} from './setup-ui.js';
import {renderLessonHeading,renderSkillPreview} from './lesson-session-ui.js';
import {createSongImportUI} from './song-import-ui.js';
import {songSpeedForTier,scaleSongSkill,suggestNextSongSpeed} from './song-tempo.js';
import {renderSongPreparation} from './song-practice-ui.js';
import {onboardingStepFor,renderOnboardingPanel} from './onboarding.js';
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const {read,save}=createStorage({onWriteError:()=>toast('Storage is unavailable. Progress will last only for this visit.')});
const profileStore=createProfileStore({read,save,sanitizeProfile});
let mode=profileStore.mode,profile=profileStore.profile;
let onboardingStep=onboardingStepFor(read('irig-onboarding-v1',null),!!(read('irig-demo',null)||read('irig-live',null)));
let page='tree',selected='fundamentals-strings',lessonFilter='',session=null,lesson=null,selectedRule=0,frame=0,devices=[],audioLabel='',connecting=false;
let packs=[];for(const pack of read('irig-packs',[]).slice?.(0,30)||[]){try{packs.push(validatePack(pack));}catch{}}
const settings={gate:0.008,offset:0,channel:0,...read('irig-settings',{})};
const inputDiagnostics=new InputDiagnostics(settings.offset);
const practicePrefs={countInBars:1,songCountInBars:2,metronome:false,subdivision:1,accent:true,record:false,accuracyMode:'both',...read('irig-practice-settings',{})};
let latencyCalibration=null,lastMetronomePulse=0,lastDiagnosticRender=0;
const metronome=new Metronome(pulse=>{lastMetronomePulse=pulse.at;const light=$('#beat-light');if(light){light.classList.add('on');setTimeout(()=>light.classList.remove('on'),100);}});
let activeRecorder=null,recordingParts=[],recordedAudioUrl=null;
let songs=[],selectedSong=null,selectedPart=null,selectedCheckpoint=null,importingScore=false;
const songImportUI=createSongImportUI({$,esc,noteName,tuningLabel,getState:()=>({songs,selectedSong,selectedPart,selectedCheckpoint,importingScore,settings,page}),setState:updates=>{if('songs'in updates)songs=updates.songs;if('selectedSong'in updates)selectedSong=updates.selectedSong;if('selectedPart'in updates)selectedPart=updates.selectedPart;if('selectedCheckpoint'in updates)selectedCheckpoint=updates.selectedCheckpoint;if('importingScore'in updates)importingScore=updates.importingScore;},updateSongDifficulty,deleteSong,saveSong,songLesson,pitchClasses,TUNINGS,validTuning,save,go:next=>go(next),toast,render:()=>render(),openLesson:(...args)=>openLesson(...args)});
const {songPreview,songStaff,songEvent}=songImportUI;
if(!validTuning(settings.tuning))settings.tuning=TUNINGS[0].notes.slice();
settings.tuningId=TUNINGS.some(t=>t.id===settings.tuningId)?settings.tuningId:'custom';
settings.fixedString=0;
settings.gate=Math.max(.001,Math.min(.05,Number(settings.gate)||.008));settings.offset=Math.max(-300,Math.min(300,Number(settings.offset)||0));settings.channel=settings.channel===1?1:0;
let lastFocused=null,autoRetryTimer=null;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),4500);}
const input=new GuitarInput(onAudio,label=>{audioLabel=label;updateTop();if(!input.running&&session&&mode==='live'){cancelSession();renderLesson();toast(label);}});
input.gate=settings.gate;
function updateTop(){
  $('footer span').textContent=`TUNER · ${tuningLabel(settings.tuning)}`;
  $('#xp-label').textContent=`✦ ${profile.xp.toLocaleString()} XP`;
  $('#profile-label').textContent=mode==='demo'?'Demo explorer':'Guitar player';
  $('#input-status').classList.toggle('connected',input.running&&!connecting);
  $('#input-status').innerHTML=`<span class="status-dot"></span> ${connecting?'Connecting…':input.running?'Guitar connected':'Connect guitar'} <span>↗</span>`;
}
function setMode(next){if(session||connecting)return;profile=profileStore.switchTo(next);mode=profileStore.mode;render();}
function saveOnboardingStep(step){onboardingStep=step;save('irig-onboarding-v1',step);}
function bindOnboarding(){
  if(page!=='tree'||!onboardingStep)return;
  $('#onboarding-skip')?.addEventListener('click',()=>{saveOnboardingStep('dismissed');render();});
  $('#onboarding-live')?.addEventListener('click',()=>{saveOnboardingStep('tuning');setMode('live');});
  $('#onboarding-demo')?.addEventListener('click',()=>{saveOnboardingStep('tuning');setMode('demo');});
  $('#onboarding-tuning-next')?.addEventListener('click',()=>{const tuning=TUNINGS.find(item=>item.id===$('#onboarding-tuning')?.value);if(tuning){settings.tuningId=tuning.id;settings.tuning=tuning.notes.slice();settings.fixedString=0;save('irig-settings',settings);}saveOnboardingStep('input');render();});
  $('#onboarding-open-setup')?.addEventListener('click',()=>go('setup'));
  $('#onboarding-fundamentals')?.addEventListener('click',()=>{const first=skillById('tabs-0');if(first)openLesson({...first,requires:null,progressionSkills:['fundamentals-strings'],progressionNodeId:'fundamentals-strings'},false,0,{progressionPractice:true,onboarding:true});});
}
function updateScaleBuilderPreview(){
  const target=$('#scale-preview');if(!target)return;
  try{
    const drill=createDrill('scale',{tuning:settings.tuning,root:$('#scale-root')?.value||'E',scale:$('#scale-name')?.value||'Minor pentatonic',position:Number($('#scale-position')?.value)||1,sequenceLength:Number($('#scale-sequence')?.value)||1,direction:$('#scale-direction')?.value||'up-down',positionShift:$('#scale-shift')?.checked||false,tempoLadder:$('#scale-ladder')?.checked||false});
    const frets=drill.fretboardPattern.map(note=>note.fret),low=Math.min(...frets),high=Math.max(...frets),stages=drill.tempoStages||[];
    target.innerHTML=`<div class="scale-preview-heading"><strong>${esc(drill.scaleName)}</strong><span>Position ${drill.position}${drill.positionShift?' to '+(drill.position+1):''} · frets ${low}–${high}</span></div>${fretboardMap(drill)}<p class="tiny muted">${drill.direction==='up-down'?'Ascending + descending':drill.direction} · ${drill.sequenceLength===1?'Scale line':drill.sequenceLength+'-note sequence'} · ${drill.tempoLadder?'Tempo ladder starts at '+Math.round(stages[0]*100)+'%':'Target '+drill.bpm+' BPM'} · gold dots mark roots</p>`;
  }catch{target.textContent='Choose scale settings to preview the pattern.';}
}
function bindScaleBuilder(){
  if(!$('#scale-preview'))return;
  ['#scale-root','#scale-name','#scale-position','#scale-sequence','#scale-direction','#scale-shift','#scale-ladder'].forEach(selector=>$(selector)?.addEventListener('change',updateScaleBuilderPreview));
  updateScaleBuilderPreview();
}
function centerSelectedProgressionNode(){
  const map=document.querySelector('.progression-map-scroll'),node=map?.querySelector('.progression-node.selected');
  if(!map||!node)return;
  const left=node.offsetLeft+(node.offsetWidth-map.clientWidth)/2;
  map.scrollLeft=Math.max(0,Math.min(map.scrollWidth-map.clientWidth,left));
}function render(){
  updateTop();document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  const title=PAGE_NAMES[page];
  $('#breadcrumb').innerHTML=`Your journey <span>/</span> ${title}`;
  const views={tree:()=>`${onboardingStep?renderOnboardingPanel({step:onboardingStep,mode,tunings:TUNINGS,tuningId:settings.tuningId,esc}):''}${renderSkillTreePage({profile,selected,esc,boostTotal,modeBanner})}`,arena:arenaPage,library:()=>renderLessonLibraryPage({modeBanner,songLibrary:songImportUI.songLibrary,packs,esc}),progress:()=>progressPage(profile),setup:()=>renderSetupPage({modeBanner,devices,connecting,inputRunning:input.running,audioLabel,settings,mode,tunerControls,tuningButtons,esc})};
  $('#main').innerHTML=views[page]();
  if(page==='library'&&lessonFilter){const node=progressionNode(lessonFilter);if(node)document.querySelector('.mode-banner')?.insertAdjacentHTML('afterend',renderProgressionLessons(node,SKILLS,esc));}
  if(page==='progress')document.querySelector('#main .title-row')?.insertAdjacentHTML('afterend',dashboardCoachMarkup(profile));
  if(page==='library'){document.querySelector('.song-import')?.insertAdjacentHTML('afterend',riffArcadeMarkup());const song=songs.find(s=>s.id===selectedSong),part=song?.tracks.find(t=>t.id===selectedPart);if(song&&part){document.querySelector('#song-editor .song-options')?.insertAdjacentHTML('afterend',scorePracticeMarkup(song,part,{from:1,to:Math.min(16,Math.max(1,...part.events.map(e=>e.measure||1)))}));if($('#song-from'))$('#song-from').closest('label').querySelector('span').textContent='A - Start measure';if($('#song-to'))$('#song-to').closest('label').querySelector('span').textContent='B - End measure';for(const speed of [.6,.7,.8,.9]){const select=$('#song-speed');if(select&&!select.querySelector(`option[value="${speed}"]`)){const option=document.createElement('option');option.value=String(speed);option.textContent=Math.round(speed*100)+'% · ladder';select.insertBefore(option,select.querySelector('option[value="1"]'));}}}}
  if(page==='library')document.querySelector('.riff-arcade')?.insertAdjacentHTML('afterend',libraryToolsMarkup());
  if(page==='setup')document.querySelector('#main .two-col')?.insertAdjacentHTML('afterend',sessionToolsMarkup(practicePrefs,input,inputDiagnostics.snapshot()));
  bindPage();if(page==='tree')requestAnimationFrame(centerSelectedProgressionNode);
}
const router=createRouter({getPage:()=>page,setPage:next=>page=next,render,onInputStatus:()=>go('setup')});
function go(next){return router.navigate(next);}
function modeBanner(){return `<div class="mode-banner"><span>${mode==='demo'?'◈ DEMO MODE · Try lessons with your keyboard. Demo ranks never count toward guitar progress.':'◉ LIVE GUITAR · Your lessons use real audio input. Progress is saved on this browser.'}</span><button class="outline-btn" id="switch-mode">${mode==='demo'?'Use guitar':'Try demo'}</button></div>`;}
function arenaPage(){const equipped=buffs(profile),ready=PROGRESSION_NODES.filter(node=>masteryProgress(profile,node.id).tier>=3);return `<div class="title-row"><div><span class="eyebrow">PRACTICE MEETS PLAY</span><h1>The arena.</h1><p>Meet your rival. Prove your mastery. Take home Diamond.</p></div></div>${modeBanner()}<div class="two-col"><section class="page-panel arena-card"><span class="eyebrow">YOUR AI RIVAL</span><div class="opponent"><div class="bot-avatar">◉‿◉</div><div><h2>Echo</h2><span class="muted tiny">Patient in practice. Precise in battle.</span></div></div><p>Echo sets a score of <strong>940 points</strong> over the same notes. Reach Gold mastery, score at least <strong>90% accuracy</strong>, and beat Echo to record your skill challenge.</p><div class="chips"><span class="chip">100 BPM</span><span class="chip">±230 ms window</span><span class="chip">Gold mastery required</span></div><label class="form-group"><span>Choose your mastery challenge</span><select id="arena-skill" ${ready.length?'':'disabled'}>${ready.length?ready.map(node=>`<option value="${node.id}">${esc(node.title)}${profile.masteryChallenges?.[node.id]?' · Rematch':''}</option>`).join(''):'<option>Earn Gold mastery in a skill to enter</option>'}</select></label><button class="primary wide" id="battle" ${ready.length?'':'disabled'}>Challenge Echo <span>⚔</span></button></section><section class="page-panel"><span class="eyebrow">YOUR LOADOUT</span><h3 style="margin-top:14px">Skills that give you an edge.</h3><p>Your three strongest mastery skills are equipped automatically. Higher mastery replaces its previous bonus.</p>${equipped.length?equipped.map(b=>`<div class="buff-item"><span>${esc(progressionNode(b.id)?.title||skillById(b.id)?.title||b.id)}<br><small class="muted">${TIERS[b.tier]}</small></span><strong>+${b.boost}%</strong></div>`).join(''):'<div class="empty">Reach Bronze mastery to equip your first arena bonus.</div>'}<div class="buff-item"><span>Total score boost</span><strong>+${boostTotal(profile)}%</strong></div><p style="margin-top:20px">Bonuses increase battle points, never your accuracy. Diamond caps each skill at +5%; three slots cap the total at +15%.</p></section></div><div class="section-heading"><h2>Recent sessions</h2></div><div class="page-panel">${profile.history.length?profile.history.map(h=>`<div class="history-row"><span>${esc(h.title)} <small class="muted">${esc(h.rank)}</small></span><span>${Number(h.accuracy)||0}% · ${h.passed?'Passed':'Keep practicing'}</span></div>`).join(''):'<p class="empty">Your story starts with your first practice session.</p>'}</div>`;}
function bindPage(){
  songImportUI.bind();bindTuner();bindOnboarding();bindScaleBuilder();
  if(page==='library')bindLibraryTools({packs,settings,practice:practicePrefs,onPack:pack=>{if(packs.length>=30)return toast('This library holds up to 30 imported packs.');packs.push(pack);save('irig-packs',packs);render();toast('Custom lesson added to your library.');},onBundle:bundle=>{if(packs.length+bundle.packs.length>30)return toast('Remove some imported packs first; the library holds up to 30.');packs=[...packs,...bundle.packs];if(validTuning(bundle.tuner?.tuning)){settings.tuning=bundle.tuner.tuning.slice();settings.tuningId=TUNINGS.find(t=>t.notes.join(',')===settings.tuning.join(','))?.id||'custom';settings.gate=Math.max(.001,Math.min(.05,Number(bundle.tuner.gate)||settings.gate));settings.offset=Math.max(-300,Math.min(300,Number(bundle.tuner.offset)||0));save('irig-settings',settings);}const p=bundle.practice||{};practicePrefs.countInBars=[0,1,2].includes(Number(p.countInBars))?Number(p.countInBars):practicePrefs.countInBars;practicePrefs.subdivision=[1,2,4].includes(Number(p.subdivision))?Number(p.subdivision):practicePrefs.subdivision;practicePrefs.metronome=!!p.metronome;practicePrefs.accent=p.accent!==false;practicePrefs.accuracyMode=['both','pitch','rhythm'].includes(p.accuracyMode)?p.accuracyMode:practicePrefs.accuracyMode;save('irig-packs',packs);save('irig-practice-settings',practicePrefs);render();toast('Bundle imported. Lessons and practice settings are ready.');}});
  if(page==='progress')bindProgressPage((type,options)=>{try{openLesson(createDrill(type,{...options,profile,tuning:settings.tuning}),true);}catch(error){toast(error.message);}});
  if(page==='setup')bindSessionTools(practicePrefs,prefs=>save('irig-practice-settings',prefs),startLatencyCalibration,inputDiagnostics);
  $('#switch-mode')?.addEventListener('click',()=>{setMode(mode==='demo'?'live':'demo');if(mode==='live'&&!input.running)go('setup');});
  $('#view-arena')?.addEventListener('click',()=>go('arena'));$('#buff-info')?.addEventListener('click',()=>go('arena'));
  $('#practice-related')?.addEventListener('click',e=>{lessonFilter=e.currentTarget.dataset.node;go('library');});
  $('#clear-lessons-filter')?.addEventListener('click',()=>{lessonFilter='';render();});
  document.querySelectorAll('[data-progression-node]').forEach(button=>button.addEventListener('click',()=>{selected=button.dataset.progressionNode;render();document.querySelector('.progression-detail')?.scrollIntoView({behavior:'smooth',block:'nearest'});}));
  document.querySelectorAll('[data-progression-lesson]').forEach(button=>button.addEventListener('click',()=>{const base=skillById(button.dataset.progressionLesson),node=progressionNode(lessonFilter);if(!base||!node)return;openLesson({...base,requires:null,progressionSkills:[node.id],progressionNodeId:node.id},false,0,{progressionPractice:true});}));
  document.querySelectorAll('[data-progression-drill]').forEach(button=>button.addEventListener('click',()=>{const node=progressionNode(lessonFilter);if(!node)return;try{const type=button.dataset.progressionDrill,drillOptions={profile,tuning:settings.tuning};if(type==='scale'){drillOptions.root=$('#scale-root')?.value||'E';drillOptions.scale=$('#scale-name')?.value||'Minor pentatonic';drillOptions.position=Number($('#scale-position')?.value)||1;drillOptions.sequenceLength=Number($('#scale-sequence')?.value)||1;drillOptions.direction=$('#scale-direction')?.value||'up-down';drillOptions.positionShift=$('#scale-shift')?.checked||false;drillOptions.tempoLadder=$('#scale-ladder')?.checked||false;}const activity=createDrill(type,drillOptions);openLesson({...activity,requires:null,progressionSkills:[node.id],progressionNodeId:node.id},false,0,{progressionPractice:true});}catch(error){toast(error.message);}}));
  $('#battle')?.addEventListener('click',()=>{const node=progressionNode($('#arena-skill').value);if(!node)return;try{const base=node.activityIds.map(id=>skillById(id)).find(Boolean),drillId=node.activityIds.find(id=>id.startsWith('drill-'));const activity=base||createDrill((drillId||'drill-scale').slice(6),{tuning:settings.tuning,root:'E',scale:'Minor pentatonic',position:node.id==='scales-positions'?2:1,sequenceLength:node.id==='scales-sequences'?3:1,positionShift:node.id==='scales-shifts'});openLesson({...activity,requires:null,progressionSkills:[node.id],progressionNodeId:node.id,progressionChallenge:true},false,3,{progressionPractice:true});}catch(error){toast(error.message);}});
  document.querySelectorAll('[data-repertoire]').forEach(b=>b.onclick=()=>{const chart=REPERTOIRE.find(item=>item.id===b.dataset.repertoire);if(chart)openLesson(chart,true);});
  document.querySelectorAll('[data-library]').forEach(b=>b.onclick=()=>{const key=b.dataset.library;let s;if(key.startsWith('pack-')){const p=packs[Number(key.slice(5))];s={...p,id:'library',track:p.sequence[0].chord?'chords':'tabs',guide:`Practice “${p.title}” by ${p.author}. Start slowly and focus on clean changes.`,requires:null};}else{s={...skillById(key),title:key==='tabs-4'?'First light · E minor pentatonic':'Open road · Four-chord loop'};}openLesson(s,true);});
  $('#import-pack')?.addEventListener('click',()=>$('#pack-file').click());$('#pack-file')?.addEventListener('change',importPack);$('#download-pack')?.addEventListener('click',downloadPack);
  $('#connect')?.addEventListener('click',connect);$('#disconnect')?.addEventListener('click',async()=>{await input.disconnect();audioLabel='Disconnected';render();});
  $('#channel')?.addEventListener('change',e=>{settings.channel=Number(e.target.value);save('irig-settings',settings);toast('Channel saved. Reconnect input to apply.');});
  $('#gate')?.addEventListener('input',e=>{settings.gate=Number(e.target.value);input.gate=settings.gate;$('#gate-label').textContent=settings.gate.toFixed(3);save('irig-settings',settings);});
  $('#offset')?.addEventListener('input',e=>{settings.offset=Number(e.target.value);inputDiagnostics.setCalibration(settings.offset);$('#offset-label').textContent=settings.offset+' ms';renderInputDiagnostics(inputDiagnostics.snapshot());save('irig-settings',settings);});
  $('#live-mode')?.addEventListener('change',e=>setMode(e.target.checked?'live':'demo'));
}
async function connect(){const id=$('#device-select').value;connecting=true;render();try{devices=await input.connect(id,settings.channel);profile=profileStore.switchTo('live');mode=profileStore.mode;toast('Audio connected. Play a note to check the tuner.');}catch(e){audioLabel=e.name==='NotAllowedError'?'Permission denied. Allow microphone access in your browser and try again.':e.name==='NotFoundError'?'No audio input found. Connect your iRig and try again.':e.message;toast(audioLabel);}finally{connecting=false;render();}}
async function importPack(e){const file=e.target.files?.[0];if(!file)return;try{if(file.size>200000)throw new Error('Keep lesson packs under 200 KB.');if(packs.length>=30)throw new Error('This library holds up to 30 imported packs.');const pack=validatePack(JSON.parse(await file.text()));packs.push(pack);save('irig-packs',packs);render();toast('Lesson pack added to your library.');}catch(error){toast(error.message);e.target.value='';}}
function downloadPack(){const pack={version:1,title:'First light · E minor pentatonic',author:'iRig Trainer',source:'https://github.com/Darkhelmet23/irig-trainer',license:'CC0-1.0',sequence:skillById('tabs-4').sequence.map(({string,fret})=>({string,fret}))};const url=URL.createObjectURL(new Blob([JSON.stringify(pack,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='irig-lesson-example.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function openLesson(skill,library=false,tierIndex,options={}){
  clearTimeout(autoRetryTimer);autoRetryTimer=null;
  const progressionPractice=options.progressionPractice===true,focusId=skill.progressionNodeId||skill.progressionSkills?.[0];
  if(progressionPractice&&!isProgressionUnlocked(focusId,profile))return toast('Unlock this progression path before practicing it.');
  if(!library&&!progressionPractice&&!unlocked(skill,profile))return toast('Earn Bronze in the previous skill first.');
  lastFocused=document.activeElement;
  selectedRule=tierIndex??(library||progressionPractice?0:Math.min(profile.skills[skill.id]||0,3));
  const prepared=library?{...skill,libraryPractice:true}:skill;
  if(prepared.songId&&!options.manualTempo)Object.assign(prepared,scaleSongSkill(prepared,songSpeedForTier(selectedRule)));
  lesson={skill:prepared,initialSkill:prepared,library,options:{adaptive:true,...options},loopRound:1};
  renderLesson();$('#lesson-dialog').showModal();
}
function scaleLessonSummary(skill){
  const frets=(skill.fretboardPattern||[]).map(note=>note.fret),low=frets.length?Math.min(...frets):0,high=frets.length?Math.max(...frets):12;
  const pattern=skill.sequenceLength===1?'Scale line':`${skill.sequenceLength}-note sequences`,direction=skill.direction==='up-down'?'Ascending + descending':skill.direction;
  const target=skill.tempoTargetBpm||skill.bpm,stages=skill.tempoStages||[],active=skill.tempoStage||0;
  return `<section class="scale-lesson-summary"><div><span class="eyebrow">SCALE PRACTICE</span><h3>${esc(skill.scaleName)}</h3><p>Position ${skill.position}${skill.positionShift?' → '+(skill.position+1):''} · frets ${low}–${high} · ${direction} · ${pattern}</p><p>Practice at <strong>${Math.round(skill.bpm)} BPM</strong>${skill.tempoLadder?` · target ${target} BPM`:''}. Start slowly and keep the notes even.</p></div>${skill.tempoLadder?`<div class="scale-tempo-ladder" aria-label="Scale tempo ladder">${stages.map((stage,index)=>`<span class="${index<active?'complete':index===active?'active':''}">${Math.round(stage*100)}%<small>${Math.round(target*stage)} BPM</small></span>`).join('')}</div>`:''}</section>`;
}

function renderLesson(){
  const {skill,library}=lesson,current=profile.skills[skill.id]||0;
  const timed=skill.timed,songPractice=!!skill.songId,tiers=RULES.map((r,i)=>`<button class="tier-option ${i===selectedRule?'selected':''}" data-rule="${i}" ${library&&!songPractice&&i>1?'disabled':!library&&!lesson.options.progressionPractice&&i>current?'disabled':''}><i class="tier-dot ${r.name.toLowerCase()}"></i><strong>${r.name}</strong><small>${r.detail}<br>${r.threshold}% to pass${r.ai?' + beat Echo':''}<br>${r.mode==='wait'?'No time limit':r.bpm+' BPM'}${songPractice?' · '+Math.round(skill.originalBpm*songSpeedForTier(i))+' BPM':''}</small></button>`).join('');
  $('#lesson-content').innerHTML=renderLessonHeading({lesson,mode,esc})+`<div class="lesson-body"><div class="guide-box">${esc(skill.guide)}</div>${skill.scaleName?scaleLessonSummary(skill):songPractice?renderSongPreparation({skill,countInBars:lesson.options.countInBars??practicePrefs.songCountInBars??2,accuracyGoal:RULES[selectedRule].threshold,practiceMode:lesson.options.songMode,esc}):''}${renderSkillPreview(skill,{fretboardMap,songPreview,shapes:SHAPES,esc})}<p class="tiny muted">Required tuning: ${tuningLabel(skill.tuning||TUNINGS[0].notes)}${skill.capo?' · Capo '+skill.capo:''} · ${timed?'From the selected song track':'Built-in lessons use standard tuning'}</p>${skill.technique?'<p class="notice">Technique study: only target pitches are graded. A rank here does not certify the physical technique.</p>':''}${skill.track==='chords'?'<p class="notice">Chord recognition is experimental. Shapes are shown from low E to high e; × means mute. The detector checks chord identity, not fingering.</p>':''}<div class="tier-options">${tiers}</div><div class="lesson-foot"><p>${lesson.options.progressionPractice?'Practice earns mastery XP toward this skill.':library?'Library practice earns no mastery XP.':`Next mastery: ${TIERS[Math.min(current+1,4)]}. Earn practice XP toward connected skills.`}<br>${mode==='demo'?'Use Space for a correct note and X for a mistake.':'Play through your selected audio input.'}</p><button class="primary" id="begin">${RULES[selectedRule].mode==='battle'?'Challenge Echo':'START PRACTICE'} <span>→</span></button></div></div>`;
  $('.guide-box')?.insertAdjacentHTML('afterend',`<div class="practice-modes"><label>Scoring focus<select id="accuracy-mode"><option value="both" ${practicePrefs.accuracyMode==='both'?'selected':''}>Pitch + timing</option><option value="pitch" ${practicePrefs.accuracyMode==='pitch'?'selected':''}>Pitch only · no timer</option><option value="rhythm" ${practicePrefs.accuracyMode==='rhythm'?'selected':''}>Rhythm only · any note</option></select></label><label class="toggle-row"><input type="checkbox" id="adaptive-enabled" ${lesson.options.adaptive?'checked':''}>Adaptive repeats</label>${skill.earTraining?'<button class="outline-btn" id="play-reference">Play reference note</button>':''}<span id="beat-light" class="beat-light" aria-label="Metronome beat"></span></div>`);
  $('#accuracy-mode')?.addEventListener('change',e=>{practicePrefs.accuracyMode=e.target.value;save('irig-practice-settings',practicePrefs);});
  $('#adaptive-enabled')?.addEventListener('change',e=>{lesson.options.adaptive=e.target.checked;});
  $('#play-reference')?.addEventListener('click',playReferenceNote);
  $('#close-lesson').onclick=closeLesson;
  document.querySelectorAll('[data-rule]').forEach(button=>button.onclick=()=>{selectedRule=Number(button.dataset.rule);if(songPractice&&!lesson.options.manualTempo)lesson.skill=scaleSongSkill(lesson.skill,songSpeedForTier(selectedRule));renderLesson();});
  $('#begin').onclick=()=>{if(songPractice){lesson.options.countInBars=Number($('#song-count-in').value);lesson.options.songMode=$('#song-practice-mode').value;practicePrefs.songCountInBars=lesson.options.countInBars;save('irig-practice-settings',practicePrefs);}startSession();};
  $('#song-practice-speed')?.addEventListener('change',event=>{lesson.skill=scaleSongSkill(lesson.skill,Number(event.target.value));lesson.options.manualTempo=true;renderLesson();});
  if(!timed&&!library&&!skill.progressionChallenge){const modes=$('.practice-modes');modes?.insertAdjacentHTML('beforeend','<label class="toggle-row endless-toggle"><input type="checkbox" id="endless-enabled"> Endless practice · keep going until you finish</label>');const endless=$('#endless-enabled');if(endless){endless.checked=lesson.options.endless===true;endless.addEventListener('change',event=>{lesson.options.endless=event.target.checked;lesson.skill.endlessPractice=event.target.checked;});}}
  applyProgressionLessonPresentation();
}
function applyProgressionLessonPresentation(){

  if(!lesson?.options.progressionPractice)return;
  const id=lesson.skill.progressionNodeId||lesson.skill.progressionSkills?.[0],node=progressionNode(id),progress=masteryProgress(profile,id),tier=progress.tier;
  document.querySelectorAll('[data-rule]').forEach(button=>{button.disabled=Number(button.dataset.rule)>tier;button.classList.toggle('selected',Number(button.dataset.rule)===selectedRule);});
  if(selectedRule>tier)selectedRule=tier;
  const status=$('.lesson-foot p');if(status)status.innerHTML=`${MASTERY_NAMES[tier]} mastery · ${progress.xp.toLocaleString()} / ${progress.nextXP.toLocaleString()} skill XP<br>${tier===4?'Maximum mastery reached':`${progress.remaining.toLocaleString()} XP to ${MASTERY_NAMES[tier+1]}`} · ${node?'Practice earns XP toward '+esc(node.title):'Practice earns progression XP'}.<br>${mode==='demo'?'Use Space for a correct note and X for a mistake.':'Play through your selected audio input.'}`;
 }
function beginRecording(){
  if(!practicePrefs.record)return;if(mode!=='live'||!input.stream||!window.MediaRecorder){toast('Recording needs a connected live input and MediaRecorder support.');return;}
  try{recordingParts=[];activeRecorder=new MediaRecorder(input.stream);activeRecorder.ondataavailable=e=>{if(e.data?.size)recordingParts.push(e.data);};activeRecorder.start();}catch{activeRecorder=null;toast('This browser could not start an audio recording.');}
}
function stopRecording(keep=true){
  if(!activeRecorder)return Promise.resolve(null);const recorder=activeRecorder;activeRecorder=null;
  return new Promise(resolve=>{recorder.addEventListener('stop',()=>{if(!keep||!recordingParts.length){recordingParts=[];return resolve(null);}if(recordedAudioUrl)URL.revokeObjectURL(recordedAudioUrl);const blob=new Blob(recordingParts,{type:recorder.mimeType||'audio/webm'});recordingParts=[];recordedAudioUrl=URL.createObjectURL(blob);resolve(recordedAudioUrl);},{once:true});try{recorder.stop();}catch{resolve(null);}});
}
function startSession(){
  if(connecting)return toast('Audio input is still connecting. Try again in a moment.');
  if(mode==='live'&&!input.running){closeLesson();go('setup');return toast('Connect your guitar input before starting a live lesson.');}
  if(onboardingStep){onboardingStep=null;save('irig-onboarding-v1','complete');}
  let rule=lesson.skill.timed||lesson.skill.adaptiveTempo?{...RULES[selectedRule],bpm:lesson.skill.bpm}:RULES[selectedRule];
  if(lesson.skill.adaptiveTempo&&rule.mode==='wait')rule={...rule,mode:'flow',window:Math.max(300,rule.window)};
  if(practicePrefs.accuracyMode==='pitch')rule={...rule,mode:'wait'};else if(practicePrefs.accuracyMode==='rhythm')rule={...rule,mode:'flow'};
  if(lesson.skill.songId)rule={...rule,mode:lesson.options.songMode==='scrolling'?'flow':'wait',bpm:lesson.skill.bpm};
  const countInBars=lesson.skill.songId?(lesson.options.countInBars??practicePrefs.songCountInBars??2):practicePrefs.countInBars;
  const countInMs=(Number(countInBars)||0)*4*60000/Math.max(30,rule.bpm||60);
  session=makeSession(lesson.skill,rule,profile,performance.now(),countInMs);session.profileMode=mode;session.library=lesson.library;session.accuracyMode=practicePrefs.accuracyMode;session.practiceOptions=lesson.options||{};session.loopRound=lesson.loopRound||1;session.wallStarted=Date.now();input.chordMode=session.accuracyMode!=='rhythm'&&!!session.events[0]?.chord;input.chordCandidates=lesson.skill.candidates;input.armed=true;input.lastKey=null;
  const personalBest=profile.history.filter(h=>h.title===lesson.skill.title&&Array.isArray(h.trace)&&h.trace.length).sort((a,b)=>b.accuracy-a.accuracy)[0];session.ghostTrace=personalBest?.trace||[];session.events.forEach((event,i)=>{const delta=session.ghostTrace[i];if(Number.isFinite(delta))event.ghostDeltaMs=delta;});
  if(practicePrefs.metronome)metronome.start({bpm:rule.bpm||60,subdivision:practicePrefs.subdivision,accent:practicePrefs.accent}).catch(()=>toast('Metronome audio could not start.'));
  beginRecording();
  $('#lesson-content').innerHTML=renderLessonHeading({lesson,mode,esc})+`<div class="lesson-body"><div class="play-stats"><div>MODE<strong>${rule.mode==='wait'?'Guided':rule.mode==='battle'?'Mastery battle':'Flow'}</strong></div><div>ACCURACY<strong id="live-accuracy">—</strong></div><div>TARGET<strong>${rule.threshold}%</strong></div><div>PROGRESS<strong id="live-progress">0 / ${session.events.length}</strong></div><div>TEMPO<strong>${rule.mode==='wait'?'Your pace':Math.round(rule.bpm)+' BPM'}</strong></div></div><div class="stage ${lesson.skill.timed?'song-stage':lesson.skill.track==='chords'?'chord-stage':''}" id="stage" style="${lesson.skill.timed?'height:'+Math.max(250,80+(lesson.skill.tuning?.length||6)*30)+'px':''}"><div class="play-line"></div>${lesson.skill.timed?songStaff(lesson.skill):lesson.skill.track==='tabs'?'<div class="string-labels"><span>e</span><span>B</span><span>G</span><span>D</span><span>A</span><span>E</span></div>':''}${session.events.map((e,i)=>lesson.skill.timed?songEvent(e,i):`<div class="note-event ${e.chord?'chord':''}" id="event-${i}" ${!e.chord?`style="top:${lesson.skill.hiddenTarget?130:40+(e.string-1)*30}px"`:''}>${lesson.skill.hiddenTarget?'?':esc(e.chord||e.fret)}</div>`).join('')}</div><div class="target-card"><div><span class="eyebrow">UP NEXT</span><div><strong id="target-name"></strong></div><p id="target-detail"></p></div><div class="heard"><span id="heard-label">${mode==='demo'?'Keyboard demo':'Listening to your guitar…'}</span><div class="meter" style="width:120px"><div id="lesson-meter"></div></div></div></div><div class="feedback" id="feedback" role="status" aria-live="polite">Get ready…</div>${rule.mode==='battle'?`<div class="battle-progress"><div>You · +${session.boost}% boost<div class="meter"><div id="you-bar"></div></div></div><div>Echo · target 940<div class="meter"><div id="echo-bar"></div></div></div></div>`:''}${mode==='demo'?'<div class="demo-controls"><button class="primary" id="demo-hit">Play target <kbd>Space</kbd></button><button class="outline-btn" id="demo-miss">Wrong note <kbd>X</kbd></button><span>Demo progress only · hold/repeat is ignored</span></div>':'<p class="tiny muted" style="text-align:center;margin:15px 0 0">Pluck each note distinctly. For repeated notes, mute briefly between attacks.</p>'}<div class="lesson-foot"><button class="subtle-btn" id="restart">↺ Restart</button><span class="tiny muted">${rule.mode==='wait'?'Wrong attempts lower accuracy. Take your time.':'Notes move toward the green play line. Keep going after a miss.'}</span><button class="subtle-btn" id="exit-practice">Exit lesson</button></div></div>`;
  session.renderedEventCount=session.events.length;
  if(lesson.skill.hiddenTarget)document.querySelectorAll('#stage .fret-marker').forEach(marker=>{marker.textContent='?';marker.title='Target hidden';});
  if(lesson.skill.earTraining)document.querySelector('.target-card')?.insertAdjacentHTML('afterend','<button class="outline-btn" id="play-reference">Play current reference note</button>');
  session.events.forEach((event,i)=>{if(Number.isFinite(event.ghostDeltaMs)){const marker=document.createElement('i');marker.className='ghost-note';marker.setAttribute('aria-label','Personal best timing');$('#event-'+i)?.append(marker);}});
  $('#close-lesson').onclick=closeLesson;$('#exit-practice').onclick=closeLesson;$('#restart').onclick=()=>{cancelSession();startSession();};$('#demo-hit')?.addEventListener('click',()=>playDemo(true));$('#demo-miss')?.addEventListener('click',()=>playDemo(false));$('#play-reference')?.addEventListener('click',playReferenceNote);if(session.endless){$('#exit-practice').textContent='Finish run & see results';$('#exit-practice').onclick=finishEndless;}frame=requestAnimationFrame(tick);
}
async function playReferenceNote(){
  const target=session?.events[session.index]||lesson?.skill.sequence[0];if(!Number.isFinite(target?.midi))return toast('No reference note is available.');
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return toast('This browser does not support audio playback.');
  try{const context=new Audio({latencyHint:'interactive'});await context.resume();const oscillator=context.createOscillator(),gain=context.createGain(),at=context.currentTime;oscillator.type='sine';oscillator.frequency.value=440*Math.pow(2,(target.midi-69)/12);gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.18,at+.025);gain.gain.setValueAtTime(.18,at+.45);gain.gain.exponentialRampToValueAtTime(.0001,at+.8);oscillator.connect(gain).connect(context.destination);oscillator.start(at);oscillator.stop(at+.82);oscillator.addEventListener('ended',()=>context.close(),{once:true});}catch{toast('Reference playback could not start.');}
}
function playDemo(match){if(mode!=='demo'||!session)return;attempt(session,session.accuracyMode==='rhythm'?true:match,performance.now());}
function tick(now){
  if(!session)return;
  if(document.hidden){cancelSession();renderLesson();return toast('Lesson paused because the tab was hidden. Start again when you’re ready.');}
  advanceMisses(session,now-settings.offset*(mode==='live'?1:0));
  if(session.ended)return finishSession();
  const s=session,e=s.events[s.index],remaining=s.started+s.countInMs-now;
  while(s.renderedEventCount<s.events.length){const index=s.renderedEventCount,event=s.events[index],el=document.createElement('div');el.className=`note-event ${event.chord?'chord':''}`;el.id=`event-${index}`;if(!event.chord)el.style.top=`${s.skill.hiddenTarget?130:40+(event.string-1)*30}px`;el.textContent=s.skill.hiddenTarget?'?':event.chord||event.fret;$('#stage').append(el);s.renderedEventCount++;}
  $('#feedback').textContent=remaining>0?`COUNT IN · ${Math.ceil(remaining/(60000/Math.max(30,s.rule.bpm||60)))}`:s.feedback;$('#feedback').classList.toggle('count-in-active',remaining>0);
  input.chordMode=s.accuracyMode!=='rhythm'&&!!e.chord;
  $('#target-name').textContent=e.passive?(e.rest?'Rest':'Hold / technique'):e.label||e.chord||noteName(e.midi);$('#target-detail').textContent=s.skill.timed?`Measure ${e.measure} · ${(e.durationMs/1000).toFixed(2)}s · ${e.techniques?.join(', ')|| (e.string?'String '+e.string+' · fret '+e.fret:'Play the shown notes')}${e.suggested?' · suggested fingering':''}`:e.chord?`${SHAPES[e.chord]} · low E → high e`:`String ${e.string} · ${e.fret?'fret '+e.fret:'open'} · ${e.midi?noteName(e.midi):''}`;
  $('#live-progress').textContent=`${s.index} / ${s.events.length}`;
  const denominator=s.rule.mode==='wait'?s.attempts:s.judged;
  $('#live-accuracy').textContent=denominator?`${Math.round(s.hits/denominator*100)}%`:'—';
  const width=$('#stage').clientWidth,speed=110/(60000/s.rule.bpm),playhead=Math.max(now,s.started+s.countInMs),clock=playhead-(mode==='live'?settings.offset:0);
  s.events.forEach((ev,i)=>{const el=$('#event-'+i);const x=s.rule.mode==='wait'?width*.22+(i-s.index)*90:width*.22+(ev.at-clock)*speed;el.style.left=x+'px';el.style.visibility=x<-60||x>width+60?'hidden':'visible';el.classList.toggle('hit',ev.status==='hit');el.classList.toggle('miss',ev.status==='miss');el.classList.toggle('wrong',ev.status==='wrong');});
  s.events.forEach((event,i)=>{if(Number.isFinite(event.ghostDeltaMs)){const marker=$('#event-'+i)?.querySelector('.ghost-note');if(marker)marker.style.left=`calc(50% + ${event.ghostDeltaMs*speed}px)`;}});
  if(s.rule.mode==='battle'){$('#you-bar').style.width=Math.min(100,100*s.hits/s.events.length*(1+s.boost/100))+'%';$('#echo-bar').style.width=Math.min(94,94*Math.max(0,now-s.started-s.countInMs)/(s.events.at(-1).at-s.started-s.countInMs))+'%';}
  frame=requestAnimationFrame(tick);
}
function finishSession(){
  const s=session,previousHistory=profile.history.slice(),finishedAt=Date.now();cancelAnimationFrame(frame);session=null;input.chordMode=false;metronome.stop();const recordingPromise=stopRecording(true);
  const result=scoreResult({hits:s.hits,total:s.total,attempts:s.attempts,mode:s.rule.mode,boost:s.rule.mode==='battle'?s.boost:0,ai:s.rule.ai,threshold:s.rule.threshold});
  const priorStrongRun=previousHistory.some(item=>item.title===s.skill.title&&Math.abs((item.speed||1)-(s.skill.speed||1))<.005&&(item.accuracy||0)>=90);
  const nextSongSpeed=s.skill.timed&&priorStrongRun?suggestNextSongSpeed(s.skill.speed,result.accuracy):null;
  const xpReward=!s.library&&!s.skill.adaptiveReplay?awardPracticeXP(profile,s.skill,s,result,{history:previousHistory,at:finishedAt}):{xp:0,targets:[],activityKey:s.skill.id};
  const upgraded=!s.library&&!s.skill.adaptiveReplay&&award(profile,s.skill,s.rule,result);profile.sessions++;if(s.skill.progressionChallenge&&result.passed){profile.masteryChallenges=profile.masteryChallenges||{};profile.masteryChallenges[s.skill.progressionNodeId]=true;}
  const detailed=s.events.filter(e=>!e.passive).flatMap(e=>e.chord?[{key:`chord:${e.chord}`,label:e.chord,kind:'chord',hit:e.status==='hit',measure:e.measure},...(e.notes||[]).map(n=>({key:`position:${n.string}:${n.fret}`,label:`String ${n.string} · fret ${n.fret}`,kind:'position',hit:e.status==='hit',string:n.string,fret:n.fret,measure:e.measure}))]:[{key:`note:${e.midi}`,label:noteName(e.midi),kind:'note',hit:e.status==='hit',string:e.string,fret:e.fret,measure:e.measure}]);
  profile.history.unshift({title:s.skill.title,lessonId:s.skill.id,activityKey:xpReward.activityKey,xpAwarded:xpReward.xp,rank:s.rule.name,accuracy:result.accuracy,passed:result.passed,at:finishedAt,bpm:s.rule.bpm||0,speed:s.skill.speed||1,hits:s.hits,total:s.total,durationMs:Math.max(0,finishedAt-(s.wallStarted||finishedAt)),timingMode:s.rule.mode,targets:detailed.slice(0,256),trace:s.events.filter(e=>!e.passive).map(e=>e.deltaMs??null).slice(0,256)});profile.history=profile.history.slice(0,200);profileStore.persist(s.profileMode,profile);
  if(s.skill.checkpointKey&&!s.skill.adaptiveReplay){try{const ranks=JSON.parse(localStorage.getItem('irig-checkpoints-v1')||'{}'),rank=result.accuracy>=98?'Diamond':result.accuracy>=90?'Gold':result.accuracy>=80?'Silver':result.accuracy>=70?'Bronze':'Unranked',old=ranks[s.skill.checkpointKey];if(!old||result.accuracy>old.accuracy)ranks[s.skill.checkpointKey]={accuracy:result.accuracy,rank,at:Date.now()};localStorage.setItem('irig-checkpoints-v1',JSON.stringify(ranks));}catch{}}
  $('#lesson-content').innerHTML=renderLessonHeading({lesson,mode,esc})+`<div class="lesson-body result"><div class="result-icon">${result.passed?'✦':'↺'}</div><span class="eyebrow">${s.profileMode==='demo'?'DEMO RESULT':'SESSION COMPLETE'}</span><h2 style="margin-top:14px">${upgraded?s.rule.name+' earned.':result.passed?'That’s a good session.':'Every attempt is practice.'}</h2><div class="accuracy">${result.accuracy}%</div><p>${s.hits} of ${s.total} targets hit${s.rule.mode==='wait'?` · ${s.attempts} attempts`:''} · ${s.rule.threshold}% required</p>${s.rule.mode==='battle'?`<p>You: <strong>${result.points}</strong> points (+${s.boost}%) · Echo: <strong>${result.aiPoints}</strong><br>${result.points>result.aiPoints?'You outscored Echo.':'Beat Echo’s score to win. A tie is not a win.'}</p>`:''}<p class="xp-award-pulse">${xpReward.xp?`+${xpReward.xp} XP toward ${xpReward.targets.map(id=>progressionNode(id)?.title).filter(Boolean).join(', ')}.`:result.passed?'Mastery XP for this lesson has reached today’s limit.':'Reach 60% accuracy to earn mastery XP from this lesson.'}${upgraded?` ${s.rule.name} rank recorded.`:''}${s.profileMode==='demo'?'<br>These rewards are saved to your demo profile only.':''}</p><div class="demo-controls"><button class="outline-btn" id="result-retry">Practice again</button><button class="primary" id="result-done">Back to your journey →</button></div></div>`;
  const report=analyzeSession(s,result,previousHistory);$("#lesson-content .lesson-body.result")?.insertAdjacentHTML("beforeend",sessionCoachMarkup(report));$("#result-warmup")?.addEventListener("click",()=>{const warmup=createDrill("warmup",{profile,tuning:settings.tuning});closeLesson();openLesson(warmup,true);});if(s.skill.id==='drill-chords'){const minutes=Math.max(.01,(Date.now()-(s.wallStarted||Date.now()))/60000),rate=Math.round(s.hits/minutes);$('.result .accuracy')?.insertAdjacentHTML('afterend',`<p class="transition-rate">${rate} clean chord changes per minute</p>`);}
  if(nextSongSpeed){const tempo=Math.round((s.skill.originalBpm||s.skill.bpm/s.skill.speed)*nextSongSpeed);$('.result .accuracy')?.insertAdjacentHTML('afterend',`<p class="tempo-suggestion">${result.accuracy}% accuracy at ${Math.round(s.skill.bpm)} BPM. Ready to try ${tempo} BPM?</p><button class="outline-btn" id="try-next-song-speed">Try ${Math.round(nextSongSpeed*100)}% · ${tempo} BPM</button>`);$('#try-next-song-speed')?.addEventListener('click',()=>{lesson.skill=scaleSongSkill(s.skill,nextSongSpeed);lesson.options.manualTempo=true;renderLesson();});}
  $('#close-lesson').onclick=closeLesson;$('#result-done').onclick=closeLesson;$('#result-retry').onclick=renderLesson;render();
  if(activeRecorder||practicePrefs.record){$('.result .demo-controls')?.insertAdjacentHTML('beforebegin','<div id="recording-playback" class="recording-playback">Finalizing local recording…</div>');recordingPromise.then(url=>{const box=$('#recording-playback');if(box)box.innerHTML=url?`<span>Listen to your run</span><audio controls src="${url}"></audio><a href="${url}" download="irig-practice.webm">Save recording</a>`:'<span>No live recording was captured.</span>';});}
  const continuation=nextPractice(lesson,s,result);if(continuation){const retryLesson=lesson;$('.result .demo-controls')?.insertAdjacentHTML('beforebegin',`<p class="notice adaptive-notice">${esc(continuation)} Restarting shortly… <button class="subtle-btn" id="stop-auto-retry">Stop</button></p>`);autoRetryTimer=setTimeout(()=>{autoRetryTimer=null;if($('#lesson-dialog')?.open&&lesson===retryLesson){renderLesson();startSession();}},1600);$('#stop-auto-retry')?.addEventListener('click',()=>{clearTimeout(autoRetryTimer);autoRetryTimer=null;});}
}
function finishEndless(){if(!session?.endless)return closeLesson();session.endless=false;session.userStoppedEndless=true;session.events=session.events.slice(0,session.index);session.total=session.events.filter(event=>!event.passive).length;session.ended=true;finishSession();}
function cancelSession(){cancelAnimationFrame(frame);session=null;input.chordMode=false;input.chordCandidates=null;metronome.stop();stopRecording(false);}
function closeLesson(){clearTimeout(autoRetryTimer);autoRetryTimer=null;cancelSession();$('#lesson-dialog').close();render();lastFocused?.isConnected&&lastFocused.focus();}
function onAudio(data){
  inputDiagnostics.observe(data);if(page==='setup'&&performance.now()-lastDiagnosticRender>=100){renderInputDiagnostics(inputDiagnostics.snapshot());lastDiagnosticRender=performance.now();}
  if($('#tuner-note'))updateTuner(data);
  if($('#lesson-meter'))$('#lesson-meter').style.width=Math.min(100,data.rms*350)+'%';
  if($('#device-level'))$('#device-level').style.width=Math.min(100,data.rms*350)+'%';
  if($('#device-frequency'))$('#device-frequency').textContent=data.frequency?`${data.frequency.toFixed(1)} Hz`:'—';
  if($('#device-note'))$('#device-note').textContent=data.midi===null?'—':noteName(data.midi);
  if($('#device-quality'))$('#device-quality').textContent=data.clipping?'clipping':data.rms<input.gate*2?'below gate':data.midi!==null?`${Math.round((data.pitchConfidence||0)*100)}% pitch confidence`:'weak / noisy';
  if(latencyCalibration&&data.trigger){const beatMs=60000/latencyCalibration.bpm,phase=((performance.now()-lastMetronomePulse+beatMs/2)%beatMs)-beatMs/2;latencyCalibration.errors.push(phase);$('#calibration-status').textContent=`Captured ${latencyCalibration.errors.length}/8 attacks…`;if(latencyCalibration.errors.length>=8){const sorted=latencyCalibration.errors.slice().sort((a,b)=>a-b),median=(sorted[3]+sorted[4])/2;settings.offset=Math.round(Math.max(-300,Math.min(300,median))/5)*5;inputDiagnostics.setCalibration(settings.offset);save('irig-settings',settings);$('#offset').value=settings.offset;$('#offset-label').textContent=settings.offset+' ms';$('#calibration-status').textContent=`Estimated alignment ${settings.offset>=0?'+':''}${settings.offset} ms. This includes your response timing.`;renderInputDiagnostics(inputDiagnostics.snapshot());latencyCalibration=null;metronome.stop();}}
  if($('#heard-label'))$('#heard-label').textContent=data.clipping?'Lower input gain':input.chordMode?(data.chord?`Hearing ${data.chord.startsWith('score:')?'a voicing':data.chord}`:'Listening for a chord…'):(data.midi!==null?`Hearing ${noteName(data.midi)} · ${Math.round(data.cents)}¢`:'Listening…');
  if(!session||mode!=='live'||!data.trigger)return;
  const now=performance.now()-settings.offset;advanceMisses(session,now);if(session.ended)return;
  const target=session.events[session.index];if(target.passive)return;
  const heardNotes=input.chordCandidates?.[data.chord]||CHORDS[data.chord],expectedNotes=input.chordCandidates?.[target.chord];
  const match=session.accuracyMode==='rhythm'?true:target.chord?(data.chord===target.chord||!!(heardNotes&&expectedNotes&&pitchClasses(heardNotes)===pitchClasses(expectedNotes))):data.midi===target.midi&&Math.abs(data.cents)<=45;
  attempt(session,match,now);
}
function startLatencyCalibration(){if(!input.running){toast('Connect your guitar first.');return;}latencyCalibration={bpm:80,errors:[]};$('#calibration-status').textContent='Metronome started · play one note on each beat for eight beats.';metronome.start({bpm:80,subdivision:1,accent:true}).catch(()=>{latencyCalibration=null;toast('Calibration metronome could not start.');});}
function tunerControls(){return `<label class="form-group tuner-select"><span>Tuning preset</span><select id="tuning-preset">${TUNINGS.map(t=>`<option value="${t.id}" ${settings.tuningId===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}<option value="custom" ${settings.tuningId==='custom'?'selected':''}>Custom / imported tuning</option></select></label><div class="custom-tuning" ${settings.tuningId==='custom'?'':'hidden'}><label class="form-group"><span>Open strings, low to high (include octaves)</span><input id="custom-tuning" value="${esc(settings.tuning.slice().reverse().map(noteName).join(' '))}" placeholder="D2 A2 D3 G3 B3 E4"></label><button class="outline-btn" id="apply-tuning">Apply custom tuning</button></div><p class="tiny muted" id="tuning-help">Select a string below to lock its target, or use Auto. A4 = 440 Hz.</p>`;}
function tuningButtons(){return `<div class="tuning-strings"><button class="chip ${settings.fixedString===0?'active':''}" data-tune-string="0">Auto</button>${settings.tuning.map((n,i)=>({n,string:i+1})).reverse().map(({n,string})=>`<button class="chip ${settings.fixedString===string?'active':''}" data-tune-string="${string}" aria-label="Tune string ${string} to ${noteName(n)}"><small>${string}</small>${noteName(n)}</button>`).join('')}</div>`;}
function bindTuner(){
  $('#tuning-preset')?.addEventListener('change',e=>{settings.tuningId=e.target.value;const t=TUNINGS.find(t=>t.id===e.target.value);if(t)settings.tuning=t.notes.slice();settings.fixedString=0;save('irig-settings',settings);render();});
  $('#apply-tuning')?.addEventListener('click',()=>{try{settings.tuning=parseTuning($('#custom-tuning').value);settings.tuningId='custom';settings.fixedString=0;save('irig-settings',settings);render();toast('Custom tuning saved.');}catch(error){toast(error.message);}});
  document.querySelectorAll('[data-tune-string]').forEach(b=>b.onclick=()=>{settings.fixedString=Number(b.dataset.tuneString);document.querySelectorAll('[data-tune-string]').forEach(el=>el.classList.toggle('active',el===b));$('#tuner-cents').textContent=settings.fixedString?`Target: string ${settings.fixedString} · ${noteName(settings.tuning[settings.fixedString-1])}`:'Auto: play any open string';});
}
function updateTuner(data){
  const target=tuningTarget(data.frequency,settings.tuning,settings.fixedString);
  $('#tuner-note').textContent=data.midi===null?'—':noteName(data.midi);
  $('#tuner-cents').textContent=!target?'Play one clean, sustained open string':`String ${target.string} · target ${target.name} · ${target.cents>=0?'+':''}${Math.round(target.cents)} cents${Math.abs(target.cents)<=5?' · In tune':''}`;
  $('#tuner-needle').style.left=(50+Math.max(-50,Math.min(50,target?.cents||0)))+'%';
  $('#input-meter').style.width=Math.min(100,data.rms*350)+'%';
  $('#level-label').textContent=data.clipping?'Clipping risk · lower the input gain':data.rms<input.gate?'Below noise gate':'Signal received';
  document.querySelectorAll('[data-tune-string]').forEach(b=>b.classList.toggle('hearing',target?.string===Number(b.dataset.tuneString)));
}
$('#lesson-dialog').addEventListener('cancel',e=>{e.preventDefault();closeLesson();});
document.addEventListener('keydown',e=>{if(e.repeat||!session||mode!=='demo'||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.code==='Space'||e.code==='KeyX'){e.preventDefault();playDemo(e.code==='Space');}});
window.addEventListener('pagehide',()=>input.disconnect());
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(()=>{}));
router.start();
loadSongs().then(saved=>{songs=saved;if(page==='library')render();}).catch(()=>toast('Song storage is unavailable in this browser.')); 
