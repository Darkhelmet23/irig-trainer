import {progressionTargetsForLesson} from './progression.js';
import {scaleNames} from './drills.js';

const ROOTS=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const DRILLS={
  'drill-fretboard':['fretboard','Fretboard note finding','Find named notes on a selected guitar string.'],
  'drill-ear':['ear','Ear training','Listen to a reference note, then find its pitch.'],
  'drill-chords':['chords','Chord transitions','Practice steady changes through a familiar progression.'],
  'drill-scale':['scale','Scale practice','Choose a key and shape, then add sequences or a position shift.'],
  'drill-technique':['technique','Technique practice','Generate a fresh exercise for the selected technique.'],
};

function scaleBuilder(node,esc){
  if(!node.activityIds.includes('drill-scale'))return '';
  const defaultName=node.id==='scales-blues'?'Blues':'Minor pentatonic';
  const sequenceDefault=node.id==='scales-sequences'?'3':'1';
  return `<div class="scale-builder"><label>Root<select id="scale-root">${ROOTS.map(root=>`<option ${root==='E'?'selected':''}>${root}</option>`).join('')}</select></label><label>Scale<select id="scale-name">${scaleNames.map(name=>`<option ${name===defaultName?'selected':''}>${esc(name)}</option>`).join('')}</select></label><label>Position<select id="scale-position">${[1,2,3,4,5].map(position=>`<option value="${position}">${position}</option>`).join('')}</select></label><label>Sequence<select id="scale-sequence">${[1,2,3,4].map(length=>`<option value="${length}" ${String(length)===sequenceDefault?'selected':''}>${length===1?'Scale line':`${length} notes`}</option>`).join('')}</select></label><label>Direction<select id="scale-direction"><option value="up-down">Ascending + descending</option><option value="ascending">Ascending</option><option value="descending">Descending</option></select></label><label class="scale-toggle"><input type="checkbox" id="scale-shift" ${node.id==='scales-shifts'?'checked':''}> Shift to next position</label><label class="scale-toggle"><input type="checkbox" id="scale-ladder" ${node.id==='scales-tempo'?'checked':''}> Tempo ladder · 60–100%</label></div>`;
}

export function renderProgressionLessons(node,lessons,esc){
  if(!node)return '';
  const related=lessons.filter(lesson=>node.activityIds.includes(lesson.id)||progressionTargetsForLesson(lesson).includes(node.id));
  const cards=related.map(lesson=>`<article class="practice-lesson-card"><span class="practice-kind">${lesson.track==='chords'?'CHORDS & RHYTHM':'TABS & MELODIES'}</span><h3>${esc(lesson.title)}</h3><p>${esc(lesson.subtitle||lesson.guide)}</p><button class="outline-btn" data-progression-lesson="${esc(lesson.id)}">Practice lesson →</button></article>`);
  const drills=node.activityIds.filter(id=>DRILLS[id]).map(id=>{const [kind,title,description]=DRILLS[id];return `<article class="practice-lesson-card drill-card"><span class="practice-kind">GENERATED DRILL</span><h3>${title}</h3><p>${description}</p><button class="outline-btn" data-progression-drill="${kind}">Build this drill →</button></article>`;});
  return `<section class="filtered-practice"><div class="filtered-practice-heading"><div><span class="eyebrow">PRACTICE FOR THIS SKILL</span><h2>${esc(node.title)}</h2><p>Choose an exercise. Successful practice earns XP toward this skill.</p></div><button class="subtle-btn" id="clear-lessons-filter">Browse all lessons</button></div>${scaleBuilder(node,esc)}<div class="practice-lesson-grid">${[...cards,...drills].join('')||'<p class="empty">No built-in activity is linked to this skill yet. Explore the lesson collection below.</p>'}</div></section>`;
}
