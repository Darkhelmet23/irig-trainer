import {CHORDS} from './curriculum.js';
import {SongStudioCapture} from './song-studio-capture.js';
import {renderRiffEditor,bindRiffEditor} from './riff-editor.js';
import {createJamMode} from './jam-mode.js';
import {createSongProject,createSongSection,chordsInKey,nextChordSuggestion,transposeChordProgression,randomChordProgression,duplicateProgression,snapshotSongProject,restoreSongProjectVersion,duplicateSongProject,songProjectToPracticeLesson,serializeSongProject,reorderItems,transposeSongProject} from './song-studio.js';

const htmlEscape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const makeId=prefix=>prefix+'-'+(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2,12));
const keyLabel=key=>{const match=/^([A-G](?:#|b)?)(m?)$/.exec(String(key||'C'));return match?match[1]+(match[2]?' minor':' major'):key};
const selectOptions=(values,selected)=>values.map(value=>'<option value="'+htmlEscape(value)+'" '+(value===selected?'selected':'')+'>'+htmlEscape(value)+'</option>').join('');
const chordChoices=key=>[...new Set([...chordsInKey(key),...Object.keys(CHORDS)])];

export function createSongStudioUI({storage,tunings=[],onSendToPractice=()=>{},onToast=()=>{},getCaptureInput=()=>({}),renderApp=()=>{},confirmRef=globalThis.confirm}={}){
  const capture=new SongStudioCapture({onState:message=>{const status=document.querySelector('[data-studio-capture-status]');if(status)status.textContent=message;}});
  const jam=createJamMode({onUpdate:updateJamDisplay});
  let projects=[],project=null,sectionId=null,view='home',captureState=null,captureDraft=null,captureCount=4,captureMessage='Play a short phrase, then stop when ready.',captureToken=0,scratchDraft=null,saving=false,saveTimer=null,writeQueue=Promise.resolve(),root=null;
  const recordingUrls=new Map();

  function currentSection(){return project?.sections.find(section=>section.id===sectionId)||null;}
  function notifySave(message){const status=root?.querySelector('[data-save-status]');if(status)status.textContent=message;}
  async function persist(){
    if(!project)return;
    project.modifiedAt=new Date().toISOString();saving=true;notifySave('Saving on this deviceâ€¦');
    const copy=JSON.parse(serializeSongProject(project));
    writeQueue=writeQueue.catch(()=>{}).then(()=>storage.saveProject(copy));
    try{await writeQueue;projects=[project,...projects.filter(item=>item.id!==project.id)];saving=false;notifySave('Saved locally');}
    catch(error){saving=false;notifySave('Save failed');onToast(error.message||'Song Studio could not save this project.');}
  }
  function saveSoon(){
    if(!project)return;
    project.modifiedAt=new Date().toISOString();notifySave('Changes will save automatically');
    clearTimeout(saveTimer);saveTimer=setTimeout(()=>persist(),220);
  }
  async function refresh(){
    renderApp();
    if(project?.recordings?.length)attachRecordings();
  }
  async function attachRecordings(){
    for(const take of project?.recordings||[]){
      const audio=root?.querySelector('[data-take-audio="'+take.id+'"]');
      if(!audio)continue;
      if(recordingUrls.has(take.id)){audio.src=recordingUrls.get(take.id);continue;}
      try{
        const record=await storage.loadRecording(take.id);
        if(record?.blob&&audio.isConnected){
          const url=URL.createObjectURL(record.blob);recordingUrls.set(take.id,url);audio.src=url;
        }
      }catch{onToast('A local take could not be opened.');}
    }
  }
  function renderHome(){
    const cards=[
      ['blank','New blank song','Start with an empty arrangement.'],
      ['chords','Start with chords','Begin with a simple progression in E minor.'],
      ['riff','Start with a riff','Open a blank tab grid and shape the idea.'],
      ['recording','Just record an idea','Create a song and capture a local audio take.']
    ];
    const projectCards=projects.map(item=>'<article class="studio-project-card"><button class="studio-project-open" data-project-open="'+htmlEscape(item.id)+'"><span class="eyebrow">'+htmlEscape(item.key)+' Â· '+Number(item.bpm)+' BPM</span><strong>'+htmlEscape(item.title)+'</strong><small>'+item.sections.length+' sections Â· edited '+new Date(item.modifiedAt).toLocaleDateString()+'</small></button><div class="studio-project-actions"><button class="subtle-btn" data-project-duplicate="'+htmlEscape(item.id)+'" aria-label="Duplicate '+htmlEscape(item.title)+'">Duplicate</button><button class="subtle-btn danger-text" data-project-delete="'+htmlEscape(item.id)+'" aria-label="Delete '+htmlEscape(item.title)+'">Delete</button></div></article>').join('');
    return '<div class="song-studio-page"><header class="studio-hero"><div><span class="eyebrow">LEARN Â· PRACTICE Â· CREATE</span><h1>Song Studio</h1><p>A blank page for the riff in your head. Ideas stay on this device, and nothing is graded.</p></div><img src="/brand-mark.svg" width="64" height="64" alt=""></header><section class="studio-start"><div class="section-heading"><div><span class="eyebrow">START SOMEWHERE</span><h2>Make a little noise.</h2></div></div><div class="studio-start-grid">'+cards.map(card=>'<button class="studio-start-option" data-studio-new="'+card[0]+'"><strong>'+card[1]+'</strong><span>'+card[2]+'</span><i aria-hidden="true">â†’</i></button>').join('')+'</div></section><section class="studio-project-list"><div class="section-heading"><div><span class="eyebrow">ON THIS DEVICE</span><h2>Your songs</h2></div></div>'+(projectCards||'<p class="studio-empty">Your ideas will appear here. Start with a blank song, a riff, or a quick take.</p>')+'</section><p class="tiny muted studio-local-note">Projects and recordings are stored locally in this browser. No account or upload required.</p></div>';
  }
  function renderArrangement(){
    return '<div class="studio-arrangement-strip">'+project.arrangement.map((id,index)=>{
      const item=project.sections.find(section=>section.id===id);if(!item)return '';
      return '<article class="studio-arrangement-card '+(id===sectionId?'selected':'')+'"><button class="studio-arrangement-select" data-section-select="'+id+'" aria-pressed="'+(id===sectionId)+'">'+htmlEscape(item.name)+'</button><div class="studio-arrangement-controls"><button type="button" data-section-move="'+id+'" data-direction="-1" aria-label="Move '+htmlEscape(item.name)+' earlier" '+(index===0?'disabled':'')+'>â†‘</button><button type="button" data-section-move="'+id+'" data-direction="1" aria-label="Move '+htmlEscape(item.name)+' later" '+(index===project.arrangement.length-1?'disabled':'')+'>â†“</button></div></article>';
    }).join('')+'</div>';
  }
  function renderChords(section){
    const options=chordChoices(project.key);
    const rows=section.chords.map((chord,index)=>'<div class="studio-chord-item"><label><span>Chord '+(index+1)+'</span><select data-chord-name="'+chord.id+'">'+selectOptions(options,chord.name)+'</select></label><label class="studio-beats"><span>Beats</span><input type="number" min="0.25" max="32" step="0.25" value="'+Number(chord.beats||4)+'" data-chord-beats="'+chord.id+'"></label><div class="studio-item-buttons"><button type="button" data-chord-move="'+chord.id+'" data-direction="-1" aria-label="Move chord earlier" '+(index===0?'disabled':'')+'>â†‘</button><button type="button" data-chord-move="'+chord.id+'" data-direction="1" aria-label="Move chord later" '+(index===section.chords.length-1?'disabled':'')+'>â†“</button><button type="button" data-chord-duplicate="'+chord.id+'" aria-label="Duplicate chord">+</button><button type="button" data-chord-remove="'+chord.id+'" aria-label="Remove chord">Ã—</button></div></div>').join('');
    return '<section class="studio-lane chord-lane"><div class="studio-lane-heading"><div><span class="eyebrow">PROGRESSION</span><h3>Chord lane</h3></div><div class="studio-lane-actions"><button class="outline-btn" data-duplicate-progression>Duplicate progression</button></div></div><div class="studio-chord-add"><label><span>Add a chord</span><select id="studio-add-chord">'+selectOptions(options,options[0])+'</select></label><button class="primary" data-chord-add>Add chord</button></div><div class="studio-chord-items">'+(rows||'<p class="studio-empty">Add a chord to begin a progression.</p>')+'</div><div class="studio-chord-strip" aria-label="Chord progression">'+section.chords.map(item=>'<span>'+htmlEscape(item.name)+' <small>'+Number(item.beats||4)+' beats</small></span>').join('')+'</div><details class="studio-helper"><summary>Optional songwriting helpers</summary><div class="studio-helper-content"><span class="tiny muted">Common in '+htmlEscape(project.key)+':</span><div class="studio-chip-row">'+chordsInKey(project.key).map(name=>'<button type="button" data-common-chord="'+htmlEscape(name)+'">'+htmlEscape(name)+'</button>').join('')+'</div><div class="studio-helper-actions"><button class="subtle-btn" data-suggest-chord>Suggest next chord</button><button class="subtle-btn" data-random-progression>Random 4-chord progression</button><button class="subtle-btn" data-transpose="-1">Transpose âˆ’1</button><button class="subtle-btn" data-transpose="1">Transpose +1</button><button class="subtle-btn" data-project-transpose="-1">Transpose whole song âˆ’1</button><button class="subtle-btn" data-project-transpose="1">Transpose whole song +1</button></div></div></details></section>';
  }
  function renderTakes(section){
    const takes=(project.recordings||[]).filter(take=>take.sectionId===section.id);
    const saved=takes.map(take=>'<article class="studio-take"><div><strong>'+htmlEscape(take.name)+'</strong><small>'+new Date(take.createdAt).toLocaleString()+' Â· '+Math.max(1,Math.round((take.durationMs||0)/1000))+' sec</small></div><audio controls preload="none" data-take-audio="'+take.id+'" aria-label="Play '+htmlEscape(take.name)+'"></audio><button class="subtle-btn danger-text" data-take-delete="'+take.id+'">Delete</button></article>').join('');
    const draft=scratchDraft?'<div class="studio-recording-review"><label><span>Name this take</span><input type="text" maxlength="80" id="studio-take-name" value="'+htmlEscape(scratchDraft.name||section.name+' idea')+'"></label><button class="primary" data-take-save>Save take</button><button class="subtle-btn" data-take-discard>Discard</button></div>':'';
    return '<section class="studio-lane recording-lane"><div class="studio-lane-heading"><div><span class="eyebrow">LOCAL AUDIO</span><h3>Scratch recordings</h3></div><button class="outline-btn" data-record-idea>'+(capture.recording?'Stop recording':'Record idea')+'</button></div><p class="tiny muted" data-studio-capture-status>'+(capture.recording?'Recording locallyâ€¦':'Quick takes are stored on this device and stay attached to this section.')+'</p>'+draft+(saved||'<p class="studio-empty">No takes on this section yet.</p>')+'</section>';
  }
  function renderVersions(){
    return '<section class="studio-lane versions-lane"><div class="studio-lane-heading"><div><span class="eyebrow">LOCAL SNAPSHOTS</span><h3>Versions</h3></div><div class="studio-version-save"><input type="text" maxlength="80" id="studio-version-name" placeholder="e.g. Chorus rewrite" aria-label="Version name"><button class="subtle-btn" data-version-save>Save version</button></div></div>'+(project.versions?.length?'<div class="studio-version-list">'+project.versions.map(version=>'<article><span><strong>'+htmlEscape(version.name)+'</strong><small>'+new Date(version.createdAt).toLocaleString()+'</small></span><div><button class="subtle-btn" data-version-restore="'+version.id+'">Restore</button><button class="subtle-btn" data-version-duplicate="'+version.id+'">Duplicate</button></div></article>').join('')+'</div>':'<p class="studio-empty">Save a named snapshot before trying a different direction.</p>')+'</section>';
  }
  function renderRiffGrid(section){
    return renderRiffEditor(section,{tuning:project.tuning,timeSignature:project.timeSignature,esc:htmlEscape}).replace('<div class="capture-draft" data-capture-draft hidden></div>','');
  }
  function renderEditor(){
    if(!project)return renderHome();
    const section=currentSection();
    const keyChoices=['C','Cm','C#','C#m','D','Dm','D#','D#m','E','Em','F','Fm','F#','F#m','G','Gm','G#','G#m','A','Am','A#','A#m','B','Bm'];
    const tuningSelect=tunings.map(item=>'<option value="'+item.id+'" '+(item.notes.join(',')===project.tuning.join(',')?'selected':'')+'>'+htmlEscape(item.name)+'</option>').join('');
    const customTuning=project.tuning.join(',')&&!tunings.some(item=>item.notes.join(',')===project.tuning.join(','))?'<option value="custom" selected>Custom tuning</option>':'';
    const sectionOptions=['Intro','Verse','Pre-Chorus','Chorus','Bridge','Solo','Outro'];
    const practiceControls='<div class="studio-practice-controls"><label><span>Practice loops</span><select id="studio-practice-loops">'+selectOptions(['1','2','4','8'],'1')+'</select></label><button class="primary" data-send-practice="riff">Send riff to Practice</button><button class="outline-btn" data-send-practice="chords">Send chords to Practice</button></div>';
    const sectionEditor=section?'<section class="studio-section-editor"><div class="studio-section-title"><label><span>Selected section</span><input type="text" maxlength="60" data-section-name value="'+htmlEscape(section.name)+'"></label><button class="subtle-btn" data-section-duplicate>Duplicate section</button><button class="subtle-btn danger-text" data-section-delete>Delete section</button><button class="outline-btn" data-jam-open>Jam mode</button></div>'+renderChords(section)+renderRiffGrid(section)+renderCapturePanel()+renderTakes(section)+'<section class="studio-lane notes-lane"><div class="studio-notes-grid"><label><span>Lyrics / words</span><textarea data-section-lyrics rows="7" placeholder="Write a line, chorus, or fragmentâ€¦">'+htmlEscape(section.lyrics)+'</textarea></label><label><span>Riff, arrangement, or production notes</span><textarea data-section-notes rows="7" placeholder="A texture, a feeling, an idea to tryâ€¦">'+htmlEscape(section.notes)+'</textarea></label></div></section>'+practiceControls+'</section>':'<section class="studio-lane"><p class="studio-empty">Add a section to start writing.</p></section>';
    return '<div class="song-studio-page studio-workspace"><header class="studio-project-header"><div class="studio-project-heading"><button class="subtle-btn" data-studio-home>â† All songs</button><span class="save-status" data-save-status>'+(saving?'Savingâ€¦':'Saved locally')+'</span></div><div class="studio-meta"><label class="studio-title-field"><span>Song title</span><input type="text" maxlength="100" data-project-field="title" value="'+htmlEscape(project.title)+'"></label><label><span>Key</span><select data-project-field="key">'+selectOptions(keyChoices,project.key)+'</select></label><label><span>Tempo Â· BPM</span><input type="number" min="30" max="240" step="1" data-project-field="bpm" value="'+project.bpm+'"></label><label><span>Time signature</span><select data-project-field="timeSignature">'+selectOptions(['4/4','3/4','6/8','2/4'],project.timeSignature)+'</select></label><label><span>Tuning</span><select data-project-field="tuning">'+customTuning+tuningSelect+'</select></label></div><div class="studio-project-actions"><button class="subtle-btn" data-project-duplicate="'+project.id+'">Duplicate song</button><button class="subtle-btn" data-export-project>Export project JSON</button><button class="subtle-btn" data-export-sheet>Export chord/tab sheet</button><button class="subtle-btn danger-text" data-project-delete="'+project.id+'">Delete song</button></div></header><section class="studio-arrangement"><div class="studio-lane-heading"><div><span class="eyebrow">ARRANGEMENT</span><h2>Build the shape</h2></div><div class="studio-add-section"><select id="studio-section-type">'+selectOptions(sectionOptions,'Verse')+'</select><button class="outline-btn" data-section-add>Add section</button><button class="subtle-btn" data-section-custom>Custom</button></div></div>'+renderArrangement()+'</section>'+sectionEditor+renderVersions()+'</div>';
  }
  function renderCapturePanel(){
    if(!captureState&&!captureDraft)return '<div class="capture-draft" data-capture-draft hidden></div>';
    if(captureDraft)return '<div class="capture-draft capture-review" data-capture-draft><strong>Draft tab Â· experimental</strong><p>'+captureDraft.length+' detected note attacks. Review and edit the generated notes after accepting.</p><button class="primary" data-riff-accept>Accept draft</button><button class="subtle-btn" data-riff-discard>Discard</button></div>';
    return '<div class="capture-draft" data-capture-draft><strong>'+(captureState==='count-in'?'Get ready Â· '+captureCount:'Experimental riff capture')+'</strong><p data-riff-capture-note>'+htmlEscape(captureMessage)+'</p><button class="subtle-btn" data-stop-riff>'+(captureState==='count-in'?'Cancel count-in':'Stop and review take')+'</button></div>';
  }  function renderJam(){
    if(!project)return renderHome();
    const section=currentSection(),chords=section?.chords||[];
    const strip=chords.map((chord,index)=>'<span class="jam-chord" data-jam-chord="'+index+'">'+htmlEscape(chord.name)+'</span>').join('');
    const label=keyLabel(project.key),scales=[label+' pentatonic',label+' natural minor',label+' major'];
    return '<div class="song-studio-page jam-page"><header class="jam-header"><button class="subtle-btn" data-jam-back>â† Back to song</button><span class="eyebrow">NO SCORE Â· JUST PLAY</span><h1>'+htmlEscape(label)+' Â· '+project.bpm+' BPM</h1><p>'+htmlEscape(project.title)+' / '+htmlEscape(section?.name||'Section')+'</p></header><section class="jam-main"><div class="jam-progression">'+(strip||'<p>Add chords to this section to start a jam.</p>')+'</div><div class="jam-now"><span class="eyebrow">UP NEXT</span><strong data-jam-current>Ready when you are</strong><span data-jam-next class="muted">The next chord will appear here.</span></div><div class="jam-status" role="status" aria-live="polite"><span data-jam-loop>Loop â€”</span><span data-jam-beat>Beat â€”</span><span data-jam-note>No grading. Play freely.</span></div><div class="jam-controls"><button class="primary" data-jam-play '+(chords.length?'':'disabled')+'>Play</button><button class="outline-btn" data-jam-stop>Stop</button><label class="toggle-row"><input type="checkbox" id="jam-metronome"> Metronome</label><label class="toggle-row"><input type="checkbox" id="jam-loop" checked> Loop</label><label><span>Loop length</span><select id="jam-loop-bars">'+selectOptions(['1','2','4','8'],'4')+'</select></label><label><span>Scale helper</span><select id="jam-scale">'+selectOptions(scales,scales[1])+'</select></label><button class="outline-btn" data-record-idea>'+(capture.recording?'Stop recording':'Record idea')+'</button><button class="subtle-btn" data-jam-save>Save this idea</button></div><p class="tiny muted">Play your guitar over the chord loop. The optional metronome uses a light visual pulse and click; Jam mode never awards XP or accuracy scores.</p>'+(scratchDraft?'<div class="studio-recording-review"><label><span>Name this take</span><input type="text" maxlength="80" id="studio-take-name" value="'+htmlEscape(scratchDraft.name||section?.name+' jam idea')+'"></label><button class="primary" data-take-save>Save take</button><button class="subtle-btn" data-take-discard>Discard</button></div>':'')+'</section></div>';
  }
  function renderPage(){
    if(view==='jam')return renderJam();
    return view==='home'||!project?renderHome():renderEditor();
  }
  function updateJamDisplay(state){
    const loop=root?.querySelector('[data-jam-loop]'),beat=root?.querySelector('[data-jam-beat]'),current=root?.querySelector('[data-jam-current]'),next=root?.querySelector('[data-jam-next]'),note=root?.querySelector('[data-jam-note]');
    if(!loop)return;
    const section=currentSection(),chords=section?.chords||[],active=state.chordIndex;
    loop.textContent=state.playing?'Loop '+state.loopNumber:'Loop â€”';
    beat.textContent=state.playing?'Beat '+(state.beat+1):'Beat â€”';
    current.textContent=state.playing?(chords[active]?.name||'â€”'):'Ready when you are';
    next.textContent=state.playing?'Next: '+(chords[(active+1)%Math.max(1,chords.length)]?.name||'â€”'):'Play guitar over the progression.';
    if(note)note.textContent=state.playing?'No grading. Play freely.':'No grading. Play freely.';
    root?.querySelectorAll('[data-jam-chord]').forEach(node=>node.classList.toggle('active',state.playing&&Number(node.dataset.jamChord)===active));
    const button=root?.querySelector('[data-jam-play]');if(button)button.textContent=state.playing?'Playing':'Play';
  }
  function makeProject(template){
    const standard=tunings.find(item=>item.id==='standard');
    return createSongProject({title:template==='recording'?'New idea':'Untitled song',key:template==='chords'?'Em':'Em',bpm:80,timeSignature:'4/4',tuning:standard?.notes,template});
  }
  async function beginProject(template){
    project=makeProject(template);projects.unshift(project);sectionId=project.arrangement[0];view='editor';captureDraft=null;
    await persist();await refresh();
    if(template==='recording')setTimeout(()=>startRecording(),0);
  }
  async function openProject(id){
    try{project=await storage.loadProject(id);if(!project)return onToast('That local song is no longer available.');sectionId=project.arrangement[0]||null;view='editor';captureDraft=null;await refresh();}
    catch(error){onToast(error.message||'This song could not be opened.');}
  }
  async function duplicateProject(id){
    const original=project?.id===id?project:projects.find(item=>item.id===id);
    if(!original)return;
    const copy=duplicateSongProject(original);await storage.saveProject(copy);projects.unshift(copy);project=copy;sectionId=copy.arrangement[0]||null;view='editor';await refresh();onToast('A local copy is ready.');
  }
  async function deleteProject(id){
    if(!confirmRef?.('Delete this song and its local recordings? This cannot be undone.'))return;
    const item=project?.id===id?project:await storage.loadProject(id);
    if(item)for(const take of item.recordings||[]){await storage.deleteRecording(take.id);const url=recordingUrls.get(take.id);if(url)URL.revokeObjectURL(url);recordingUrls.delete(take.id);}
    await storage.deleteProject(id);projects=projects.filter(entry=>entry.id!==id);
    if(project?.id===id){project=null;sectionId=null;view='home';}
    await refresh();onToast('Song deleted from this device.');
  }
  async function deleteTake(id){
    if(!confirmRef?.('Delete this local recording? This cannot be undone.'))return;
    await storage.deleteRecording(id);project.recordings=project.recordings.filter(item=>item.id!==id);
    const url=recordingUrls.get(id);if(url)URL.revokeObjectURL(url);recordingUrls.delete(id);
    await persist();await refresh();
  }
  function exportFile(filename,content,type){
    const url=URL.createObjectURL(new Blob([content],{type})),link=document.createElement('a');
    link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportSheet(){
    const lines=[project.title,'Key: '+project.key+' | '+project.bpm+' BPM | '+project.timeSignature,'Tuning: '+project.tuning.join(' '),''];
    for(const id of project.arrangement){
      const section=project.sections.find(item=>item.id===id);if(!section)continue;
      lines.push('['+section.name+']');
      if(section.chords.length)lines.push(section.chords.map(item=>item.name+' ('+item.beats+' beats)').join(' | '));
      for(const event of section.riff){
        const label=event.rest?'Rest':event.notes.map(note=>'string '+note.string+' fret '+note.fret).join(' + ');
        lines.push('m'+event.measure+' beat '+event.beat+': '+label);
      }
      if(section.lyrics)lines.push(section.lyrics);
      if(section.notes)lines.push('Notes: '+section.notes);
      lines.push('');
    }
    exportFile(project.title.replace(/[^a-z0-9-_]+/gi,'-')+'.txt',lines.join(String.fromCharCode(10)),'text/plain');
  }
  function renderRecordingReview(){
    const panel=root?.querySelector('[data-capture-draft]');
    if(!panel)return;
    if(!captureState&&!captureDraft&&!scratchDraft){panel.hidden=true;return;}
    panel.hidden=false;
    if(scratchDraft){
      panel.innerHTML='<strong>Take is ready to save</strong><label><span>Name this take</span><input type="text" maxlength="80" id="studio-take-name" value="'+htmlEscape(scratchDraft.name||currentSection()?.name+' idea')+'"></label><button class="primary" data-take-save>Save take</button><button class="subtle-btn" data-take-discard>Discard</button>';
    }
  }
  async function startRecording(){
    if(capture.recording)return stopRecording();
    try{
      await capture.startRecording(getCaptureInput());
      scratchDraft=null;await refresh();
    }catch(error){onToast(error.message||'Recording could not start.');}
  }
  async function stopRecording(){
    try{
      const take=await capture.stopRecording();
      if(!take)return onToast('No audio was captured. Try again when ready.');
      scratchDraft={...take,name:(currentSection()?.name||'Song')+' idea'};
      await refresh();
    }catch(error){onToast(error.message||'Recording could not be saved.');}
  }
  async function saveTake(){
    if(!scratchDraft||!project||!currentSection())return;
    const name=root.querySelector('#studio-take-name')?.value.trim()||'Idea take';
    const metadata={id:makeId('take'),name:name.slice(0,80),sectionId:currentSection().id,createdAt:new Date().toISOString(),durationMs:scratchDraft.durationMs||0,mimeType:scratchDraft.mimeType||scratchDraft.blob.type};
    try{
      await storage.saveRecording({...metadata,blob:scratchDraft.blob});
      project.recordings.push(metadata);scratchDraft=null;await persist();await refresh();onToast('Take saved on this device.');
    }catch(error){onToast(error.message||'This take could not be saved locally.');}
  }
  async function discardTake(){
    if(capture.recording)await capture.stopRecording({discard:true});
    scratchDraft=null;await refresh();
  }
  async function beginRiffCapture(){
    if(captureState==='count-in'){captureToken++;captureState=null;await refresh();return;}
    if(captureState==='recording'){await stopRiffCapture();return;}
    captureDraft=null;captureState='count-in';captureCount=4;captureMessage='Listen for the count-in, then play a short phrase.';
    const token=++captureToken;await refresh();
    const beatMs=60000/project.bpm;
    for(let beat=4;beat>=1;beat--){
      if(token!==captureToken)return;
      captureCount=beat;
      const counter=root?.querySelector('.capture-draft strong');
      if(counter)counter.textContent='Get ready Â· '+beat;
      await new Promise(resolve=>setTimeout(resolve,beatMs));
    }
    if(token!==captureToken)return;
    try{
      const options=getCaptureInput();
      await capture.startRiffCapture({deviceId:options.deviceId,channel:options.channel,gate:options.gate,tuning:project.tuning,bpm:project.bpm,timeSignature:project.timeSignature});
      captureState='recording';captureMessage='No notes yet. Play a short phrase, then stop when ready.';
      await refresh();
    }catch(error){captureState=null;await refresh();onToast(error.message||'Riff capture could not start.');}
  }
  async function stopRiffCapture(){
    if(captureState==='count-in'){captureToken++;captureState=null;await refresh();return;}
    try{
      const draft=await capture.stopRiffCapture();captureState=null;
      if(!draft.length){captureDraft=null;await refresh();onToast('No clear note attacks were detected. Try one note at a time.');return;}
      captureDraft=draft;await refresh();
    }catch(error){captureState=null;await refresh();onToast(error.message||'Capture could not be completed.');}
  }
  async function acceptRiffDraft(){
    const section=currentSection();if(!section||!captureDraft?.length)return;
    const offset=section.riff.length?Math.max(Number(section.measureCount)||2,...section.riff.map(event=>event.measure)):0;
    section.riff.push(...captureDraft.map(event=>({...event,measure:event.measure+offset,id:makeId('riff'),notes:event.notes.map(note=>({...note}))})).filter(event=>event.measure<=16));
    section.measureCount=Math.min(16,Math.max(Number(section.measureCount)||2,...section.riff.map(event=>event.measure)));
    captureDraft=null;await persist();await refresh();onToast('Draft tab added. Check the string and fret suggestions.');
  }
  async function enterJam(){
    if(!currentSection()?.chords.length)return onToast('Add a chord progression before opening Jam mode.');
    view='jam';await refresh();
  }
  async function sendToPractice(source){
    try{
      const section=currentSection(),loops=Number(root.querySelector('#studio-practice-loops')?.value)||1;
      const skill=songProjectToPracticeLesson(project,section,{source,loops});
      onSendToPractice(skill,{countInBars:2,songMode:'scrolling'});
    }catch(error){onToast(error.message||'This idea is not ready to practice yet.');}
  }
  function addSection(name){
    const section=createSongSection(name);
    project.sections.push(section);project.arrangement.push(section.id);sectionId=section.id;
  }
  function duplicateSection(){
    const section=currentSection();if(!section)return;
    const copy=JSON.parse(JSON.stringify(section));copy.id=makeId('section');copy.name=section.name+' copy';
    copy.chords=copy.chords.map(chord=>({...chord,id:makeId('chord')}));
    copy.riff=copy.riff.map(event=>({...event,id:makeId('riff'),notes:event.notes.map(note=>({...note}))}));
    project.sections.push(copy);project.arrangement.splice(project.arrangement.indexOf(section.id)+1,0,copy.id);sectionId=copy.id;
  }
  async function deleteSection(){
    const section=currentSection();if(!section)return;
    if(!confirmRef?.('Delete the '+section.name+' section and its arrangement data?'))return;
    for(const take of project.recordings.filter(item=>item.sectionId===section.id)){await storage.deleteRecording(take.id);const url=recordingUrls.get(take.id);if(url)URL.revokeObjectURL(url);recordingUrls.delete(take.id);}
    project.recordings=project.recordings.filter(item=>item.sectionId!==section.id);
    project.sections=project.sections.filter(item=>item.id!==section.id);project.arrangement=project.arrangement.filter(id=>id!==section.id);
    sectionId=project.arrangement[0]||null;await persist();await refresh();
  }
  function updateProjectField(field,value){
    if(field==='bpm')project.bpm=Math.max(30,Math.min(240,Math.round(Number(value)||80)));
    else if(field==='key')project.key=value;
    else if(field==='timeSignature')project.timeSignature=value;
    else if(field==='tuning'){
      const preset=tunings.find(item=>item.id===value);if(!preset)return;
      project.tuning=preset.notes.slice();
      for(const section of project.sections)for(const event of section.riff)for(const note of event.notes)note.midi=project.tuning[note.string-1]+note.fret;
    }else project.title=String(value||'Untitled song').slice(0,100);
  }
  function bind(){
    root=document.querySelector('#main');
    if(!root?.querySelector('.song-studio-page'))return;
    root.querySelectorAll('[data-studio-new]').forEach(button=>button.addEventListener('click',()=>beginProject(button.dataset.studioNew)));
    root.querySelectorAll('[data-project-open]').forEach(button=>button.addEventListener('click',()=>openProject(button.dataset.projectOpen)));
    root.querySelectorAll('[data-project-duplicate]').forEach(button=>button.addEventListener('click',()=>duplicateProject(button.dataset.projectDuplicate)));
    root.querySelectorAll('[data-project-delete]').forEach(button=>button.addEventListener('click',()=>deleteProject(button.dataset.projectDelete)));
    root.querySelector('[data-studio-home]')?.addEventListener('click',async()=>{await persist();view='home';await refresh();});
    if(!project)return;
    root.querySelectorAll('[data-project-field]').forEach(field=>{
      const event=field.dataset.projectField==='title'?'input':'change';
      field.addEventListener(event,()=>{
        updateProjectField(field.dataset.projectField,field.value);saveSoon();
        if(field.dataset.projectField!=='title')refresh();
      });
    });
    root.querySelector('[data-section-add]')?.addEventListener('click',async()=>{
      addSection(root.querySelector('#studio-section-type')?.value||'Verse');await persist();await refresh();
    });
    root.querySelector('[data-section-custom]')?.addEventListener('click',async()=>{
      const name=globalThis.prompt?.('Name this section','Custom section');if(!name?.trim())return;
      addSection(name.trim().slice(0,60));await persist();await refresh();
    });
    root.querySelectorAll('[data-section-select]').forEach(button=>button.addEventListener('click',async()=>{sectionId=button.dataset.sectionSelect;await refresh();}));
    root.querySelectorAll('[data-section-move]').forEach(button=>button.addEventListener('click',async()=>{
      const index=project.arrangement.indexOf(button.dataset.sectionMove),target=index+Number(button.dataset.direction);
      project.arrangement=reorderItems(project.arrangement,index,target);await persist();await refresh();
    }));
    root.querySelector('[data-section-name]')?.addEventListener('input',event=>{const value=event.target.value.slice(0,60)||'Custom section';if(currentSection())currentSection().name=value;const button=Array.from(root.querySelectorAll('[data-section-select]')).find(item=>item.dataset.sectionSelect===sectionId);if(button)button.textContent=value;saveSoon();});
    root.querySelector('[data-section-duplicate]')?.addEventListener('click',async()=>{duplicateSection();await persist();await refresh();});
    root.querySelector('[data-section-delete]')?.addEventListener('click',deleteSection);
    root.querySelector('[data-chord-add]')?.addEventListener('click',async()=>{
      const name=root.querySelector('#studio-add-chord')?.value||chordsInKey(project.key)[0];currentSection()?.chords.push({id:makeId('chord'),name,beats:4});await persist();await refresh();
    });
    root.querySelectorAll('[data-chord-name]').forEach(field=>field.addEventListener('change',async()=>{
      const chord=currentSection()?.chords.find(item=>item.id===field.dataset.chordName);if(chord)chord.name=field.value;await persist();await refresh();
    }));
    root.querySelectorAll('[data-chord-beats]').forEach(field=>field.addEventListener('change',async()=>{
      const chord=currentSection()?.chords.find(item=>item.id===field.dataset.chordBeats);if(chord)chord.beats=Math.max(.25,Math.min(32,Number(field.value)||4));await persist();await refresh();
    }));
    root.querySelectorAll('[data-chord-move]').forEach(button=>button.addEventListener('click',async()=>{
      const chords=currentSection()?.chords||[],index=chords.findIndex(item=>item.id===button.dataset.chordMove);currentSection().chords=reorderItems(chords,index,index+Number(button.dataset.direction));await persist();await refresh();
    }));
    root.querySelectorAll('[data-chord-duplicate]').forEach(button=>button.addEventListener('click',async()=>{
      const chords=currentSection()?.chords||[],index=chords.findIndex(item=>item.id===button.dataset.chordDuplicate),chord=chords[index];if(chord)chords.splice(index+1,0,{...chord,id:makeId('chord')});await persist();await refresh();
    }));
    root.querySelectorAll('[data-chord-remove]').forEach(button=>button.addEventListener('click',async()=>{
      currentSection().chords=currentSection().chords.filter(item=>item.id!==button.dataset.chordRemove);await persist();await refresh();
    }));
    root.querySelectorAll('[data-common-chord]').forEach(button=>button.addEventListener('click',async()=>{
      currentSection().chords.push({id:makeId('chord'),name:button.dataset.commonChord,beats:4});await persist();await refresh();
    }));
    root.querySelector('[data-suggest-chord]')?.addEventListener('click',async()=>{
      const chord=nextChordSuggestion(currentSection().chords,project.key);currentSection().chords.push({id:makeId('chord'),name:chord,beats:4});await persist();await refresh();
    });
    root.querySelector('[data-random-progression]')?.addEventListener('click',async()=>{
      currentSection().chords=randomChordProgression(project.key);await persist();await refresh();
    });
    root.querySelector('[data-duplicate-progression]')?.addEventListener('click',async()=>{
      currentSection().chords=duplicateProgression(currentSection().chords);await persist();await refresh();
    });
    root.querySelectorAll('[data-transpose]').forEach(button=>button.addEventListener('click',async()=>{
      currentSection().chords=transposeChordProgression(currentSection().chords,Number(button.dataset.transpose));await persist();await refresh();
    }));
    root.querySelectorAll('[data-project-transpose]').forEach(button=>button.addEventListener('click',async()=>{
      project=transposeSongProject(project,Number(button.dataset.projectTranspose));await persist();await refresh();onToast('Song transposed by '+button.dataset.projectTranspose+' semitone.');
    }));
    root.querySelector('[data-jam-open]')?.addEventListener('click',enterJam);
    bindRiffEditor(root,currentSection(),{tuning:project.tuning,onChange:reason=>{saveSoon();if(reason!=='note')refresh();},onCapture:beginRiffCapture});
    root.querySelectorAll('[data-send-practice]').forEach(button=>button.addEventListener('click',()=>sendToPractice(button.dataset.sendPractice)));
    root.querySelectorAll('[data-section-lyrics]').forEach(field=>field.addEventListener('input',event=>{currentSection().lyrics=event.target.value;saveSoon();}));
    root.querySelectorAll('[data-section-notes]').forEach(field=>field.addEventListener('input',event=>{currentSection().notes=event.target.value;saveSoon();}));
    root.querySelectorAll('[data-take-save]').forEach(button=>button.addEventListener('click',saveTake));
    root.querySelectorAll('[data-take-discard]').forEach(button=>button.addEventListener('click',discardTake));
    root.querySelectorAll('[data-take-delete]').forEach(button=>button.addEventListener('click',()=>deleteTake(button.dataset.takeDelete)));
    root.querySelectorAll('[data-record-idea]').forEach(button=>button.addEventListener('click',startRecording));
    root.querySelectorAll('[data-version-save]').forEach(button=>button.addEventListener('click',async()=>{
      const name=root.querySelector('#studio-version-name')?.value.trim()||'Version '+((project.versions||[]).length+1);project=snapshotSongProject(project,name);await persist();await refresh();onToast('Version saved locally.');
    }));
    root.querySelectorAll('[data-version-restore]').forEach(button=>button.addEventListener('click',async()=>{
      if(!confirmRef?.('Restore this snapshot? Your current edits will be replaced.'))return;
      project=restoreSongProjectVersion(project,button.dataset.versionRestore);await persist();await refresh();
    }));
    root.querySelectorAll('[data-version-duplicate]').forEach(button=>button.addEventListener('click',async()=>{
      const version=project.versions.find(item=>item.id===button.dataset.versionDuplicate);if(!version)return;
      project=snapshotSongProject({...project,...version.snapshot,versions:project.versions},version.name+' copy');await persist();await refresh();
    }));
    root.querySelector('[data-export-project]')?.addEventListener('click',()=>exportFile(project.title.replace(/[^a-z0-9-_]+/gi,'-')+'.irig-song.json',serializeSongProject(project),'application/json'));
    root.querySelector('[data-export-sheet]')?.addEventListener('click',exportSheet);
    root.querySelector('[data-jam-back]')?.addEventListener('click',async()=>{jam.stop();view='editor';await refresh();});
    root.querySelector('[data-jam-play]')?.addEventListener('click',async()=>{
      try{await jam.start({bpm:project.bpm,chords:currentSection().chords,timeSignature:project.timeSignature,loop:root.querySelector('#jam-loop').checked,metronome:root.querySelector('#jam-metronome').checked,loopBars:Number(root.querySelector('#jam-loop-bars').value)});}
      catch(error){onToast(error.message);}
    });
    root.querySelector('[data-jam-stop]')?.addEventListener('click',()=>jam.stop());
    root.querySelector('#jam-loop')?.addEventListener('change',event=>jam.setLoop(event.target.checked));
    root.querySelector('#jam-metronome')?.addEventListener('change',event=>jam.setMetronome(event.target.checked));
    root.querySelector('[data-jam-save]')?.addEventListener('click',async()=>{
      project=snapshotSongProject(project,'Jam idea Â· '+new Date().toLocaleDateString());await persist();onToast('Jam idea saved as a local version.');
    });
    attachRecordings();
  }
  async function flush(){
    clearTimeout(saveTimer);saveTimer=null;
    if(project)await persist();
    await writeQueue.catch(()=>{});
  }
  function onPageExit(){
    void flush();
    if(view==='jam')jam.stop();
    if(capture.recording)stopRecording();
    if(captureState==='recording')stopRiffCapture();
    else if(captureState==='count-in'){captureToken++;captureState=null;}
  }
  async function initialize(){
    try{
      const stored=await storage.listProjects();
      const current=[...projects,...(project?[project]:[])],currentIds=new Set(current.map(item=>item.id));
      projects=[...current,...stored.filter(item=>!currentIds.has(item.id))];
    }catch(error){onToast(error.message||'Song Studio storage could not be opened.');}
  }
  return {renderPage,bind,initialize,onPageExit,flush,dispose:()=>{jam.dispose();capture.stopAll();void flush();}};
}