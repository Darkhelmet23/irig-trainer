export function renderLessonHeading({lesson,mode,esc}){
  return `<div class="lesson-head"><div><span class="eyebrow">${lesson.options?.progressionPractice?'SKILL PRACTICE':lesson.library?'LIBRARY PRACTICE':lesson.skill.track==='tabs'?'TABS & MELODIES':'CHORDS & RHYTHM'} · ${mode==='demo'?'DEMO':'LIVE GUITAR'}</span><h2 id="lesson-title">${esc(lesson.skill.title)}</h2></div><button class="close-btn" id="close-lesson" aria-label="Close lesson">×</button></div>`;
}
export function renderSkillPreview(skill,{fretboardMap,songPreview,shapes,esc}){
  if(skill.fretboardPattern?.length||skill.hiddenTarget)return fretboardMap(skill);
  if(skill.timed)return songPreview(skill);
  if(skill.sequence[0].chord)return `<div class="preview-tab">${esc(skill.sequence.map(event=>event.chord).join(' → '))}\n\n${esc(shapes[skill.sequence[0].chord])}\nE A D G B e</div>`;
  const lines=['e','B','G','D','A','E'].map((label,index)=>`${label} |${skill.sequence.slice(0,6).map(event=>event.string===index+1?String(event.fret).padStart(2,'-')+'-':'---').join('')}|`);
  return `<div class="preview-tab">${lines.join('\n')}</div>`;
}
