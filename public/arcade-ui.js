import {REPERTOIRE,REPERTOIRE_SETS} from './repertoire.js';

const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function riffArcadeMarkup(){
  return `<section class="riff-arcade"><div class="section-heading"><div><span class="eyebrow">ORIGINAL RIFFS · PLAY THE CHART</span><h2>Riff arcade</h2><p>24 original note charts across four sets. Start guided, then hit the scrolling lane for an accuracy score.</p></div><span class="chip">${REPERTOIRE.length} tracks</span></div><div class="riff-sets">${REPERTOIRE_SETS.map(set=>{
    const charts=REPERTOIRE.filter(chart=>chart.setId===set.id);
    return `<section class="riff-set"><div class="riff-set-heading"><div><h3>${esc(set.title)}</h3><p>${esc(set.caption)}</p></div><span class="chip">${esc(set.level)}</span></div><div class="riff-grid">${charts.map(chart=>`<article class="library-card riff-card"><span class="node-icon" style="margin:0">${chart.track==='chords'?'♬':'♪'}</span><div class="riff-card-copy"><h4>${esc(chart.title)}</h4><p>${esc(chart.genre)} · ${chart.track==='chords'?'chord chart':'lead chart'}</p><div class="riff-meta"><span>${chart.bpm} BPM</span><span>${chart.sequence.filter(event=>!event.passive).length} hits</span></div></div><button class="outline-btn" data-repertoire="${esc(chart.id)}" aria-label="Play ${esc(chart.title)}">Play chart →</button></article>`).join('')}</div></section>`;
  }).join('')}</div><p class="tiny muted riff-note">These are original practice charts, not licensed game songs. They use the scrolling note highway and score your timing; backing recordings are not included.</p></section>`;
}
