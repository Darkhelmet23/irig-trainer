import { RULES, TIERS, SHAPES } from "./curriculum.js";
import { renderSongPreparation } from "./song-practice-ui.js";
export function renderLessonHeading({ lesson, mode, esc }) {
  return `<div class="lesson-head"><div><span class="eyebrow">${lesson.options?.progressionPractice ? "SKILL PRACTICE" : lesson.library ? "LIBRARY PRACTICE" : lesson.skill.track === "tabs" ? "TABS & MELODIES" : "CHORDS & RHYTHM"} · ${mode === "demo" ? "DEMO" : "LIVE GUITAR"}</span><h2 id="lesson-title">${esc(lesson.skill.title)}</h2></div><button class="close-btn" id="close-lesson" aria-label="Close lesson">×</button></div>`;
}
export function renderSkillPreview(
  skill,
  { fretboardMap, songPreview, shapes, esc },
) {
  if (skill.fretboardPattern?.length || skill.hiddenTarget)
    return fretboardMap(skill);
  if (skill.timed) return songPreview(skill);
  if (skill.sequence[0].chord)
    return `<div class="preview-tab">${esc(skill.sequence.map((event) => event.chord).join(" → "))}\n\n${esc(shapes[skill.sequence[0].chord])}\nE A D G B e</div>`;
  const lines = ["e", "B", "G", "D", "A", "E"].map(
    (label, index) =>
      `${label} |${skill.sequence
        .slice(0, 6)
        .map((event) =>
          event.string === index + 1
            ? String(event.fret).padStart(2, "-") + "-"
            : "---",
        )
        .join("")}|`,
  );
  return `<div class="preview-tab">${lines.join("\n")}</div>`;
}
export function renderScaleLessonSummary(skill, esc) {
  const frets = (skill.fretboardPattern || []).map((note) => note.fret);
  const low = frets.length ? Math.min(...frets) : 0;
  const high = frets.length ? Math.max(...frets) : 12;
  const pattern =
    skill.sequenceLength === 1
      ? "Scale line"
      : `${skill.sequenceLength}-note sequences`;
  const direction =
    skill.direction === "up-down" ? "Ascending + descending" : skill.direction;
  const target = skill.tempoTargetBpm || skill.bpm;
  const stages = skill.tempoStages || [];
  const active = skill.tempoStage || 0;

  return `<section class="scale-lesson-summary"><div><span class="eyebrow">SCALE PRACTICE</span><h3>${esc(skill.scaleName)}</h3><p>Position ${skill.position}${skill.positionShift ? " → " + (skill.position + 1) : ""} · frets ${low}–${high} · ${direction} · ${pattern}</p><p>Practice at <strong>${Math.round(skill.bpm)} BPM</strong>${skill.tempoLadder ? ` · target ${target} BPM` : ""}. Start slowly and keep the notes even.</p></div>${skill.tempoLadder ? `<div class="scale-tempo-ladder" aria-label="Scale tempo ladder">${stages.map((stage, index) => `<span class="${index < active ? "complete" : index === active ? "active" : ""}">${Math.round(stage * 100)}%<small>${Math.round(target * stage)} BPM</small></span>`).join("")}</div>` : ""}</section>`;
}

export function renderLessonSetup({
  lesson,
  profile,
  mode,
  selectedRule,
  practicePrefs,
  TUNINGS,
  tuningLabel,
  songSpeedForTier,
  songPreview,
  fretboardMap,
  esc,
}) {
  const { skill, library } = lesson;
  const current = profile.skills[skill.id] || 0;
  const timed = skill.timed;
  const songPractice = !!skill.songId;
  const tiers = RULES.map(
    (rule, index) =>
      `<button class="tier-option ${index === selectedRule ? "selected" : ""}" data-rule="${index}" ${library && !songPractice && index > 1 ? "disabled" : !library && !lesson.options.progressionPractice && index > current ? "disabled" : ""}><i class="tier-dot ${rule.name.toLowerCase()}"></i><strong>${rule.name}</strong><small>${rule.detail}<br>${rule.threshold}% to pass${rule.ai ? " + beat Echo" : ""}<br>${rule.mode === "wait" ? "No time limit" : rule.bpm + " BPM"}${songPractice ? " · " + Math.round(skill.originalBpm * songSpeedForTier(index)) + " BPM" : ""}</small></button>`,
  ).join("");
  const preparation = skill.scaleName
    ? renderScaleLessonSummary(skill, esc)
    : songPractice
      ? renderSongPreparation({
          skill,
          countInBars:
            lesson.options.countInBars ?? practicePrefs.songCountInBars ?? 2,
          accuracyGoal: RULES[selectedRule].threshold,
          practiceMode: lesson.options.songMode,
          esc,
        })
      : "";

  return (
    renderLessonHeading({ lesson, mode, esc }) +
    `<div class="lesson-body"><div class="guide-box">${esc(skill.guide)}</div><div class="practice-modes"><label>Scoring focus<select id="accuracy-mode"><option value="both" ${practicePrefs.accuracyMode === "both" ? "selected" : ""}>Pitch + timing</option><option value="pitch" ${practicePrefs.accuracyMode === "pitch" ? "selected" : ""}>Pitch only · no timer</option><option value="rhythm" ${practicePrefs.accuracyMode === "rhythm" ? "selected" : ""}>Rhythm only · any note</option></select></label><label class="toggle-row"><input type="checkbox" id="adaptive-enabled" ${lesson.options.adaptive ? "checked" : ""}>Adaptive repeats</label>${skill.earTraining ? '<button class="outline-btn" id="play-reference">Play reference note</button>' : ""}<span id="beat-light" class="beat-light" aria-label="Metronome beat"></span></div>${preparation}${renderSkillPreview(skill, { fretboardMap, songPreview, shapes: SHAPES, esc })}<p class="tiny muted">Required tuning: ${tuningLabel(skill.tuning || TUNINGS[0].notes)}${skill.capo ? " · Capo " + skill.capo : ""} · ${timed ? "From the selected song track" : "Built-in lessons use standard tuning"}</p>${skill.technique ? '<p class="notice">Technique study: only target pitches are graded. A rank here does not certify the physical technique.</p>' : ""}${skill.track === "chords" ? '<p class="notice">Chord recognition is experimental. Shapes are shown from low E to high e; × means mute. The detector checks chord identity, not fingering.</p>' : ""}<div class="tier-options">${tiers}</div><div class="lesson-foot"><p>${lesson.options.progressionPractice ? "Practice earns mastery XP toward this skill." : library ? "Library practice earns no mastery XP." : `Next mastery: ${TIERS[Math.min(current + 1, 4)]}. Earn practice XP toward connected skills.`}<br>${mode === "demo" ? "Use Space for a correct note and X for a mistake." : "Play through your selected audio input."}</p><button class="primary" id="begin">${RULES[selectedRule].mode === "battle" ? "Challenge Echo" : "START PRACTICE"} <span>→</span></button></div></div>`
  );
}
