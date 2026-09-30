import {estimateSongDifficulty} from './song-difficulty.js';
import {createPracticeRepository} from './data/local-repositories.js';
const practiceData=createPracticeRepository();

const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function scorePracticeMarkup(song,part,{from=1,to=16,speed=.75,focus='full'}={}){
  const max=Math.max(1,...part.events.map(e=>e.measure||1)),checkpointRanks=practiceData.loadCheckpoints(),chapters=[];
  const rating=estimateSongDifficulty(part,{from,to,speed,focus,tempo:song.tempo});
  for(let from=1,index=1;from<=max;from+=4,index++){const to=Math.min(max,from+3),name=`Checkpoint ${index}`;chapters.push(`<button class="checkpoint-chip" data-checkpoint="${esc(name)}" data-from="${from}" data-to="${to}">${name} · m.${from}–${to}<small>${checkpointRanks[`${song.title}:${part.name}:${name}`]?.rank||'Not ranked'}</small></button>`);}
  return `<section class="page-panel difficulty-card" id="song-difficulty" aria-live="polite"><div class="section-heading"><div><span class="eyebrow">IMPORT ANALYSIS</span><h3>Estimated section difficulty</h3></div><span class="chip difficulty-level" id="difficulty-level">${rating.level}</span></div><div class="difficulty-score"><strong id="difficulty-score">${rating.score}/10</strong><span id="difficulty-summary">${esc(rating.summary)}</span></div><p class="tiny muted">Heuristic estimate from tempo, attack density, fret movement, voicings, fret range, and techniques. Use it as a guide; it is not an official score rating.</p></section><section class="score-practice-options"><div class="section-heading"><div><span class="eyebrow">SECTION PRACTICE</span><h3>Checkpoints & loops</h3></div></div><p>Pick A and B with the measure controls above, or choose a four-measure checkpoint.</p><div class="checkpoint-list">${chapters.join('')}</div><div class="practice-options-grid"><label class="toggle-row"><input type="checkbox" id="loop-ab">Loop A–B continuously</label><label class="toggle-row"><input type="checkbox" id="adaptive-coach" checked>Adaptive coach · focus missed measures</label><label class="toggle-row"><input type="checkbox" id="speed-ladder">Speed ladder · +10% after 90%</label></div><p class="tiny muted">With a loop, three clean rounds can raise speed automatically. Checkpoint ranks are saved per imported track.</p></section>`;
}
export function updateSongDifficulty(song,part,{from=1,to=16,speed=.75,focus='full'}={}){
  const card=document.querySelector('#song-difficulty');if(!card)return;
  const rating=estimateSongDifficulty(part,{from,to,speed,focus,tempo:song.tempo});
  const level=card.querySelector('#difficulty-level'),score=card.querySelector('#difficulty-score'),summary=card.querySelector('#difficulty-summary');
  if(level)level.textContent=rating.level;if(score)score.textContent=`${rating.score}/10`;if(summary)summary.textContent=rating.summary;
}
