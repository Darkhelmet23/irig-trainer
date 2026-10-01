import {
  SKILLS,
  CHORDS,
  SHAPES,
  TIERS,
  BOOSTS,
  RULES,
  noteName,
  skillById,
} from "./curriculum.js";
import {
  emptyProfile,
  sanitizeProfile,
  unlocked,
  buffs,
  boostTotal,
  advanceMisses,
  attempt,
  validatePack,
} from "./engine.js";
import {
  PROGRESSION_NODES,
  progressionNode,
  isProgressionUnlocked,
  masteryProgress,
  MASTERY_NAMES,
} from "./progression.js";
import { GuitarInput } from "./audio.js";
import {
  TUNINGS,
  validTuning,
  parseTuning,
  tuningLabel,
  tuningTarget,
} from "./tunings.js";
import {
  loadSongs,
  saveSong,
  deleteSong,
  songLesson,
  pitchClasses,
} from "./songs.js";
import { riffArcadeMarkup } from "./arcade-ui.js";
import { progressPage, bindProgressPage } from "./practice-hub.js";
import {
  createDrill,
  fretboardMap,
  scaleNames,
  chordProgressions,
} from "./drills.js";
import { Metronome } from "./metronome.js";
import {
  sessionToolsMarkup,
  bindSessionTools,
  renderInputDiagnostics,
} from "./session-controls.js";
import { scorePracticeMarkup, updateSongDifficulty } from "./score-practice.js";
import { libraryToolsMarkup, bindLibraryTools } from "./library-tools.js";
import { InputDiagnostics } from "./input-diagnostics.js";
import { dashboardCoachMarkup } from "./session-coach.js";
import { createStorage } from "./storage.js";
import { createProfileStore } from "./profile-store.js";
import {
  createSettingsRepository,
  createPracticeRepository,
  createMigrationRepository,
} from "./data/local-repositories.js";
import { createRouter, PAGE_NAMES } from "./navigation.js";
import { renderSkillTreePage } from "./skill-tree-ui.js";
import { renderLessonLibraryPage } from "./lesson-library-ui.js";
import { renderProgressionLessons } from "./progression-library-ui.js";
import { renderSetupPage } from "./setup-ui.js";
import { renderLessonSetup } from "./lesson-session-ui.js";
import { createSongImportUI } from "./song-import-ui.js";
import { songSpeedForTier, scaleSongSkill } from "./song-tempo.js";
import { onboardingStepFor, renderOnboardingPanel } from "./onboarding.js";
import { createSongStudioStorage } from "./song-studio-storage.js";
import { createSongStudioUI } from "./song-studio-ui.js";
import { createSessionController } from "./practice/session.js";
import { createPageBindings } from "./page-bindings.js";
import { renderArenaPage, renderModeBanner } from "./arena-page.js";
import { createTunerUI } from "./tuner-ui.js";
import { createAuthService } from "./auth/auth-service.js";
import { createAccountUI } from "./auth/account-ui.js";
import { createMergeService } from "./auth/merge-client.js";
import { detectLocalProgress } from "./data/migration.js";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const localStorageAdapter = createStorage({
  onWriteError: () =>
    toast("Storage is unavailable. Progress will last only for this visit."),
});
const { read, save } = localStorageAdapter;
const settingsRepository = createSettingsRepository({ storage: localStorageAdapter });
const practiceRepository = createPracticeRepository({ storage: localStorageAdapter });
const migrationRepository = createMigrationRepository({ storage: localStorageAdapter });
const profileStore = createProfileStore({ read, save, sanitizeProfile });
let mode = profileStore.mode,
  profile = profileStore.profile;
let onboardingStep = onboardingStepFor(
  settingsRepository.loadOnboarding(),
  !!(profileStore.loadSaved("demo") || profileStore.loadSaved("live")),
);
let page = "tree",
  selected = "fundamentals-strings",
  lessonFilter = "",
  lesson = null,
  selectedRule = 0,
  devices = [],
  audioLabel = "",
  connecting = false;
let packs = [];
for (const pack of practiceRepository.loadPacks().slice?.(0, 30) || []) {
  try {
    packs.push(validatePack(pack));
  } catch {}
}
const settings = {
  gate: 0.008,
  offset: 0,
  channel: 0,
  ...settingsRepository.loadDevice(),
};
const inputDiagnostics = new InputDiagnostics(settings.offset);
const practicePrefs = {
  countInBars: 1,
  songCountInBars: 2,
  metronome: false,
  subdivision: 1,
  accent: true,
  record: false,
  accuracyMode: "both",
  ...settingsRepository.loadPractice(),
};
let latencyCalibration = null,
  lastMetronomePulse = 0,
  lastDiagnosticRender = 0;
const metronome = new Metronome((pulse) => {
  lastMetronomePulse = pulse.at;
  const light = $("#beat-light");
  if (light) {
    light.classList.add("on");
    setTimeout(() => light.classList.remove("on"), 100);
  }
});

let songs = [],
  selectedSong = null,
  selectedPart = null,
  selectedCheckpoint = null,
  importingScore = false;
const songImportUI = createSongImportUI({
  $,
  esc,
  noteName,
  tuningLabel,
  getState: () => ({
    songs,
    selectedSong,
    selectedPart,
    selectedCheckpoint,
    importingScore,
    settings,
    page,
  }),
  setState: (updates) => {
    if ("songs" in updates) songs = updates.songs;
    if ("selectedSong" in updates) selectedSong = updates.selectedSong;
    if ("selectedPart" in updates) selectedPart = updates.selectedPart;
    if ("selectedCheckpoint" in updates)
      selectedCheckpoint = updates.selectedCheckpoint;
    if ("importingScore" in updates) importingScore = updates.importingScore;
  },
  updateSongDifficulty,
  deleteSong,
  saveSong,
  songLesson,
  pitchClasses,
  TUNINGS,
  validTuning,
  saveDevice: settingsRepository.saveDevice,
  go: (next) => go(next),
  toast,
  render: () => render(),
  openLesson: (...args) => openLesson(...args),
});
const { songPreview, songStaff, songEvent } = songImportUI;
if (!validTuning(settings.tuning)) settings.tuning = TUNINGS[0].notes.slice();
settings.tuningId = TUNINGS.some((t) => t.id === settings.tuningId)
  ? settings.tuningId
  : "custom";
settings.fixedString = 0;
settings.gate = Math.max(0.001, Math.min(0.05, Number(settings.gate) || 0.008));
settings.offset = Math.max(-300, Math.min(300, Number(settings.offset) || 0));
settings.channel = settings.channel === 1 ? 1 : 0;
let lastFocused = null;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 4500);
}
const input = new GuitarInput(onAudio, (label) => {
  audioLabel = label;
  updateTop();
  if (!input.running && sessions.getSession() && mode === "live") {
    sessions.cancelSession();
    renderLesson();
    toast(label);
  }
});
input.gate = settings.gate;
const tunerUI = createTunerUI({
  settings,
  TUNINGS,
  parseTuning,
  tuningTarget,
  noteName,
  esc,
  saveDevice: settingsRepository.saveDevice,
  getGate: () => input.gate,
  render: () => render(),
  toast,
});

const songStudioStorage = createSongStudioStorage();
const auth = createAuthService();
const accountUI = createAccountUI({
  auth,
  mergeService: createMergeService({ auth }),
  migrationRepository,
  detectProgress: () => detectLocalProgress({
    profileStore,
    songProjects: songStudioStorage,
    loadImportedSongs: loadSongs,
  }),
});
const songStudio = createSongStudioUI({
  storage: songStudioStorage,
  tunings: TUNINGS,
  onToast: toast,
  renderApp: () => render(),
  getCaptureInput: () => {
    const track = input.stream?.getAudioTracks?.()[0];
    return {
      deviceId: track?.getSettings?.().deviceId,
      channel: settings.channel,
      gate: settings.gate,
    };
  },
  onSendToPractice: (skill, options) => openLesson(skill, true, 0, options),
});
function updateTop() {
  $("footer span").textContent = `TUNER · ${tuningLabel(settings.tuning)}`;
  $("#xp-label").textContent = `✦ ${profile.xp.toLocaleString()} XP`;
  $("#profile-label").textContent =
    mode === "demo" ? "Demo explorer" : "Guitar player";
  $("#input-status").classList.toggle(
    "connected",
    input.running && !connecting,
  );
  $("#input-status").innerHTML =
    `<span class="status-dot"></span> ${connecting ? "Connecting…" : input.running ? "Guitar connected" : "Connect guitar"} <span>↗</span>`;
}
function setMode(next) {
  if (sessions.getSession() || connecting) return;
  profile = profileStore.switchTo(next);
  mode = profileStore.mode;
  render();
}
function saveOnboardingStep(step) {
  onboardingStep = step;
  settingsRepository.saveOnboarding(step);
}
function bindOnboarding() {
  if (page !== "tree" || !onboardingStep) return;
  $("#onboarding-skip")?.addEventListener("click", () => {
    saveOnboardingStep("dismissed");
    render();
  });
  $("#onboarding-live")?.addEventListener("click", () => {
    saveOnboardingStep("tuning");
    setMode("live");
  });
  $("#onboarding-demo")?.addEventListener("click", () => {
    saveOnboardingStep("tuning");
    setMode("demo");
  });
  $("#onboarding-tuning-next")?.addEventListener("click", () => {
    const tuning = TUNINGS.find(
      (item) => item.id === $("#onboarding-tuning")?.value,
    );
    if (tuning) {
      settings.tuningId = tuning.id;
      settings.tuning = tuning.notes.slice();
      settings.fixedString = 0;
      settingsRepository.saveDevice(settings);
    }
    saveOnboardingStep("input");
    render();
  });
  $("#onboarding-open-setup")?.addEventListener("click", () => go("setup"));
  $("#onboarding-fundamentals")?.addEventListener("click", () => {
    const first = skillById("tabs-0");
    if (first)
      openLesson(
        {
          ...first,
          requires: null,
          progressionSkills: ["fundamentals-strings"],
          progressionNodeId: "fundamentals-strings",
        },
        false,
        0,
        { progressionPractice: true, onboarding: true },
      );
  });
}
function updateScaleBuilderPreview() {
  const target = $("#scale-preview");
  if (!target) return;
  try {
    const drill = createDrill("scale", {
      tuning: settings.tuning,
      root: $("#scale-root")?.value || "E",
      scale: $("#scale-name")?.value || "Minor pentatonic",
      position: Number($("#scale-position")?.value) || 1,
      sequenceLength: Number($("#scale-sequence")?.value) || 1,
      direction: $("#scale-direction")?.value || "up-down",
      positionShift: $("#scale-shift")?.checked || false,
      tempoLadder: $("#scale-ladder")?.checked || false,
    });
    const frets = drill.fretboardPattern.map((note) => note.fret),
      low = Math.min(...frets),
      high = Math.max(...frets),
      stages = drill.tempoStages || [];
    target.innerHTML = `<div class="scale-preview-heading"><strong>${esc(drill.scaleName)}</strong><span>Position ${drill.position}${drill.positionShift ? " to " + (drill.position + 1) : ""} · frets ${low}–${high}</span></div>${fretboardMap(drill)}<p class="tiny muted">${drill.direction === "up-down" ? "Ascending + descending" : drill.direction} · ${drill.sequenceLength === 1 ? "Scale line" : drill.sequenceLength + "-note sequence"} · ${drill.tempoLadder ? "Tempo ladder starts at " + Math.round(stages[0] * 100) + "%" : "Target " + drill.bpm + " BPM"} · gold dots mark roots</p>`;
  } catch {
    target.textContent = "Choose scale settings to preview the pattern.";
  }
}
function bindScaleBuilder() {
  if (!$("#scale-preview")) return;
  [
    "#scale-root",
    "#scale-name",
    "#scale-position",
    "#scale-sequence",
    "#scale-direction",
    "#scale-shift",
    "#scale-ladder",
  ].forEach((selector) =>
    $(selector)?.addEventListener("change", updateScaleBuilderPreview),
  );
  updateScaleBuilderPreview();
}
function centerSelectedProgressionNode() {
  const map = document.querySelector(".progression-map-scroll"),
    node = map?.querySelector(".progression-node.selected");
  if (!map || !node) return;
  const left = node.offsetLeft + (node.offsetWidth - map.clientWidth) / 2;
  map.scrollLeft = Math.max(
    0,
    Math.min(map.scrollWidth - map.clientWidth, left),
  );
}
function render() {
  if (page !== "studio") songStudio.onPageExit();
  updateTop();
  document
    .querySelectorAll("[data-page]")
    .forEach((b) => b.classList.toggle("active", b.dataset.page === page));
  const title = PAGE_NAMES[page];
  $("#breadcrumb").innerHTML = `Your journey <span>/</span> ${title}`;
  const views = {
    tree: () =>
      `${onboardingStep ? renderOnboardingPanel({ step: onboardingStep, mode, tunings: TUNINGS, tuningId: settings.tuningId, esc }) : ""}${renderSkillTreePage({ profile, selected, esc, boostTotal, modeBanner })}`,
    arena: arenaPage,
    library: () =>
      renderLessonLibraryPage({
        modeBanner,
        songLibrary: songImportUI.songLibrary,
        packs,
        esc,
      }),
    progress: () => progressPage(profile),
    studio: () => songStudio.renderPage(),
    setup: () =>
      renderSetupPage({
        modeBanner,
        devices,
        connecting,
        inputRunning: input.running,
        audioLabel,
        settings,
        mode,
        tunerControls: () => tunerUI.controls(),
        tuningButtons: () => tunerUI.buttons(),
        esc,
      }),
  };
  $("#main").innerHTML = views[page]();
  if (page === "library" && lessonFilter) {
    const node = progressionNode(lessonFilter);
    if (node)
      document
        .querySelector(".mode-banner")
        ?.insertAdjacentHTML(
          "afterend",
          renderProgressionLessons(node, SKILLS, esc),
        );
  }
  if (page === "progress")
    document
      .querySelector("#main .title-row")
      ?.insertAdjacentHTML("afterend", dashboardCoachMarkup(profile));
  if (page === "library") {
    document
      .querySelector(".song-import")
      ?.insertAdjacentHTML("afterend", riffArcadeMarkup());
    const song = songs.find((s) => s.id === selectedSong),
      part = song?.tracks.find((t) => t.id === selectedPart);
    if (song && part) {
      document.querySelector("#song-editor .song-options")?.insertAdjacentHTML(
        "afterend",
        scorePracticeMarkup(song, part, {
          from: 1,
          to: Math.min(
            16,
            Math.max(1, ...part.events.map((e) => e.measure || 1)),
          ),
        }),
      );
      if ($("#song-from"))
        $("#song-from").closest("label").querySelector("span").textContent =
          "A - Start measure";
      if ($("#song-to"))
        $("#song-to").closest("label").querySelector("span").textContent =
          "B - End measure";
      for (const speed of [0.6, 0.7, 0.8, 0.9]) {
        const select = $("#song-speed");
        if (select && !select.querySelector(`option[value="${speed}"]`)) {
          const option = document.createElement("option");
          option.value = String(speed);
          option.textContent = Math.round(speed * 100) + "% · ladder";
          select.insertBefore(
            option,
            select.querySelector('option[value="1"]'),
          );
        }
      }
    }
  }
  if (page === "library")
    document
      .querySelector(".riff-arcade")
      ?.insertAdjacentHTML("afterend", libraryToolsMarkup());
  if (page === "setup")
    document
      .querySelector("#main .two-col")
      ?.insertAdjacentHTML(
        "afterend",
        sessionToolsMarkup(practicePrefs, input, inputDiagnostics.snapshot()),
      );
  bindPage();
  if (page === "tree") requestAnimationFrame(centerSelectedProgressionNode);
}
const router = createRouter({
  getPage: () => page,
  setPage: (next) => (page = next),
  render,
  onInputStatus: () => go("setup"),
});
function go(next) {
  return router.navigate(next);
}
function modeBanner() {
  return renderModeBanner({ mode });
}
function arenaPage() {
  return renderArenaPage({
    profile,
    modeBanner,
    esc,
    buffs,
    nodes: PROGRESSION_NODES,
    masteryProgress,
    progressionNode,
    skillById,
    tiers: TIERS,
    boostTotal,
  });
}
const bindPageActions = createPageBindings({
  $,
  getState: () => ({
    page,
    mode,
    profile,
    selected,
    lessonFilter,
    packs,
    settings,
    practicePrefs,
  }),
  setSelected: (value) => (selected = value),
  setLessonFilter: (value) => (lessonFilter = value),
  setPacks: (value) => (packs = value),
  songImportUI,
  tunerUI,
  bindOnboarding,
  bindScaleBuilder,
  songStudio,
  bindLibraryTools,
  bindProgressPage,
  bindSessionTools,
  settingsRepository,
  practiceRepository,
  toast,
  render,
  startLatencyCalibration,
  inputDiagnostics,
  input,
  setMode,
  go,
  openLesson,
  createDrill,
  validTuning,
  TUNINGS,
  skillById,
  progressionNode,
  importPack,
  downloadPack,
  connect,
  renderInputDiagnostics,
});
function bindPage() {
  bindPageActions();
}

async function connect() {
  const id = $("#device-select").value;
  connecting = true;
  render();
  try {
    devices = await input.connect(id, settings.channel);
    profile = profileStore.switchTo("live");
    mode = profileStore.mode;
    toast("Audio connected. Play a note to check the tuner.");
  } catch (e) {
    audioLabel =
      e.name === "NotAllowedError"
        ? "Permission denied. Allow microphone access in your browser and try again."
        : e.name === "NotFoundError"
          ? "No audio input found. Connect your iRig and try again."
          : e.message;
    toast(audioLabel);
  } finally {
    connecting = false;
    render();
  }
}
async function importPack(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 200000) throw new Error("Keep lesson packs under 200 KB.");
    if (packs.length >= 30)
      throw new Error("This library holds up to 30 imported packs.");
    const pack = validatePack(JSON.parse(await file.text()));
    packs.push(pack);
    practiceRepository.savePacks(packs);
    render();
    toast("Lesson pack added to your library.");
  } catch (error) {
    toast(error.message);
    e.target.value = "";
  }
}
function downloadPack() {
  const pack = {
    version: 1,
    title: "First light · E minor pentatonic",
    author: "iRig Trainer",
    source: "https://github.com/Darkhelmet23/irig-trainer",
    license: "CC0-1.0",
    sequence: skillById("tabs-4").sequence.map(({ string, fret }) => ({
      string,
      fret,
    })),
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "irig-lesson-example.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function openLesson(skill, library = false, tierIndex, options = {}) {
  sessions.clearAutoRetry();
  const progressionPractice = options.progressionPractice === true,
    focusId = skill.progressionNodeId || skill.progressionSkills?.[0];
  if (progressionPractice && !isProgressionUnlocked(focusId, profile))
    return toast("Unlock this progression path before practicing it.");
  if (!library && !progressionPractice && !unlocked(skill, profile))
    return toast("Earn Bronze in the previous skill first.");
  lastFocused = document.activeElement;
  selectedRule =
    tierIndex ??
    (library || progressionPractice
      ? 0
      : Math.min(profile.skills[skill.id] || 0, 3));
  const prepared = library ? { ...skill, libraryPractice: true } : skill;
  if (prepared.songId && !options.manualTempo)
    Object.assign(
      prepared,
      scaleSongSkill(prepared, songSpeedForTier(selectedRule)),
    );
  lesson = {
    skill: prepared,
    initialSkill: prepared,
    library,
    options: { adaptive: true, ...options },
    loopRound: 1,
  };
  renderLesson();
  $("#lesson-dialog").showModal();
}
function renderLesson() {
  const { skill, library } = lesson;
  const timed = skill.timed,
    songPractice = !!skill.songId;
  $("#lesson-content").innerHTML = renderLessonSetup({
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
  });
  $("#accuracy-mode")?.addEventListener("change", (e) => {
    practicePrefs.accuracyMode = e.target.value;
    settingsRepository.savePractice(practicePrefs);
  });
  $("#adaptive-enabled")?.addEventListener("change", (e) => {
    lesson.options.adaptive = e.target.checked;
  });
  $("#play-reference")?.addEventListener("click", playReferenceNote);
  $("#close-lesson").onclick = closeLesson;
  document.querySelectorAll("[data-rule]").forEach(
    (button) =>
      (button.onclick = () => {
        selectedRule = Number(button.dataset.rule);
        if (songPractice && !lesson.options.manualTempo)
          lesson.skill = scaleSongSkill(
            lesson.skill,
            songSpeedForTier(selectedRule),
          );
        renderLesson();
      }),
  );
  $("#begin").onclick = () => {
    if (songPractice) {
      lesson.options.countInBars = Number($("#song-count-in").value);
      lesson.options.songMode = $("#song-practice-mode").value;
      practicePrefs.songCountInBars = lesson.options.countInBars;
      settingsRepository.savePractice(practicePrefs);
    }
    sessions.startSession();
  };
  $("#song-practice-speed")?.addEventListener("change", (event) => {
    lesson.skill = scaleSongSkill(lesson.skill, Number(event.target.value));
    lesson.options.manualTempo = true;
    renderLesson();
  });
  if (!timed && !library && !skill.progressionChallenge) {
    const modes = $(".practice-modes");
    modes?.insertAdjacentHTML(
      "beforeend",
      '<label class="toggle-row endless-toggle"><input type="checkbox" id="endless-enabled"> Endless practice · keep going until you finish</label>',
    );
    const endless = $("#endless-enabled");
    if (endless) {
      endless.checked = lesson.options.endless === true;
      endless.addEventListener("change", (event) => {
        lesson.options.endless = event.target.checked;
        lesson.skill.endlessPractice = event.target.checked;
      });
    }
  }
  applyProgressionLessonPresentation();
}
function applyProgressionLessonPresentation() {
  if (!lesson?.options.progressionPractice) return;
  const id =
      lesson.skill.progressionNodeId || lesson.skill.progressionSkills?.[0],
    node = progressionNode(id),
    progress = masteryProgress(profile, id),
    tier = progress.tier;
  document.querySelectorAll("[data-rule]").forEach((button) => {
    button.disabled = Number(button.dataset.rule) > tier;
    button.classList.toggle(
      "selected",
      Number(button.dataset.rule) === selectedRule,
    );
  });
  if (selectedRule > tier) selectedRule = tier;
  const status = $(".lesson-foot p");
  if (status)
    status.innerHTML = `${MASTERY_NAMES[tier]} mastery · ${progress.xp.toLocaleString()} / ${progress.nextXP.toLocaleString()} skill XP<br>${tier === 4 ? "Maximum mastery reached" : `${progress.remaining.toLocaleString()} XP to ${MASTERY_NAMES[tier + 1]}`} · ${node ? "Practice earns XP toward " + esc(node.title) : "Practice earns progression XP"}.<br>${mode === "demo" ? "Use Space for a correct note and X for a mistake." : "Play through your selected audio input."}`;
}
async function playReferenceNote() {
  const target =
    sessions.getSession()?.events[sessions.getSession().index] ||
    lesson?.skill.sequence[0];
  if (!Number.isFinite(target?.midi))
    return toast("No reference note is available.");
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return toast("This browser does not support audio playback.");
  try {
    const context = new Audio({ latencyHint: "interactive" });
    await context.resume();
    const oscillator = context.createOscillator(),
      gain = context.createGain(),
      at = context.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.value = 440 * Math.pow(2, (target.midi - 69) / 12);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.18, at + 0.025);
    gain.gain.setValueAtTime(0.18, at + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.8);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.82);
    oscillator.addEventListener("ended", () => context.close(), { once: true });
  } catch {
    toast("Reference playback could not start.");
  }
}
function closeLesson() {
  sessions.clearAutoRetry();
  sessions.cancelSession();
  $("#lesson-dialog").close();
  render();
  lastFocused?.isConnected && lastFocused.focus();
}
function onAudio(data) {
  const session = sessions.getSession();
  inputDiagnostics.observe(data);
  if (page === "setup" && performance.now() - lastDiagnosticRender >= 100) {
    renderInputDiagnostics(inputDiagnostics.snapshot());
    lastDiagnosticRender = performance.now();
  }
  if ($("#tuner-note")) tunerUI.update(data);
  if ($("#lesson-meter"))
    $("#lesson-meter").style.width = Math.min(100, data.rms * 350) + "%";
  if ($("#device-level"))
    $("#device-level").style.width = Math.min(100, data.rms * 350) + "%";
  if ($("#device-frequency"))
    $("#device-frequency").textContent = data.frequency
      ? `${data.frequency.toFixed(1)} Hz`
      : "—";
  if ($("#device-note"))
    $("#device-note").textContent =
      data.midi === null ? "—" : noteName(data.midi);
  if ($("#device-quality"))
    $("#device-quality").textContent = data.clipping
      ? "clipping"
      : data.rms < input.gate * 2
        ? "below gate"
        : data.midi !== null
          ? `${Math.round((data.pitchConfidence || 0) * 100)}% pitch confidence`
          : "weak / noisy";
  if (latencyCalibration && data.trigger) {
    const beatMs = 60000 / latencyCalibration.bpm,
      phase =
        ((performance.now() - lastMetronomePulse + beatMs / 2) % beatMs) -
        beatMs / 2;
    latencyCalibration.errors.push(phase);
    $("#calibration-status").textContent =
      `Captured ${latencyCalibration.errors.length}/8 attacks…`;
    if (latencyCalibration.errors.length >= 8) {
      const sorted = latencyCalibration.errors.slice().sort((a, b) => a - b),
        median = (sorted[3] + sorted[4]) / 2;
      settings.offset =
        Math.round(Math.max(-300, Math.min(300, median)) / 5) * 5;
      inputDiagnostics.setCalibration(settings.offset);
      settingsRepository.saveDevice(settings);
      $("#offset").value = settings.offset;
      $("#offset-label").textContent = settings.offset + " ms";
      $("#calibration-status").textContent =
        `Estimated alignment ${settings.offset >= 0 ? "+" : ""}${settings.offset} ms. This includes your response timing.`;
      renderInputDiagnostics(inputDiagnostics.snapshot());
      latencyCalibration = null;
      metronome.stop();
    }
  }
  if ($("#heard-label"))
    $("#heard-label").textContent = data.clipping
      ? "Lower input gain"
      : input.chordMode
        ? data.chord
          ? `Hearing ${data.chord.startsWith("score:") ? "a voicing" : data.chord}`
          : "Listening for a chord…"
        : data.midi !== null
          ? `Hearing ${noteName(data.midi)} · ${Math.round(data.cents)}¢`
          : "Listening…";
  if (!sessions.getSession() || mode !== "live" || !data.trigger) return;
  const now = performance.now() - settings.offset;
  advanceMisses(session, now);
  if (session.ended) return;
  const target = session.events[session.index];
  if (target.passive) return;
  const heardNotes = input.chordCandidates?.[data.chord] || CHORDS[data.chord],
    expectedNotes = input.chordCandidates?.[target.chord];
  const match =
    session.accuracyMode === "rhythm"
      ? true
      : target.chord
        ? data.chord === target.chord ||
          !!(
            heardNotes &&
            expectedNotes &&
            pitchClasses(heardNotes) === pitchClasses(expectedNotes)
          )
        : data.midi === target.midi && Math.abs(data.cents) <= 45;
  attempt(session, match, now);
}
function startLatencyCalibration() {
  if (!input.running) {
    toast("Connect your guitar first.");
    return;
  }
  latencyCalibration = { bpm: 80, errors: [] };
  $("#calibration-status").textContent =
    "Metronome started · play one note on each beat for eight beats.";
  metronome.start({ bpm: 80, subdivision: 1, accent: true }).catch(() => {
    latencyCalibration = null;
    toast("Calibration metronome could not start.");
  });
}
const sessions = createSessionController({
  $,
  getRuntime: () => ({
    mode,
    profile,
    lesson,
    selectedRule,
    practicePrefs,
    settings,
    connecting,
    onboardingStep,
  }),
  input,
  metronome,
  toast,
  profileStore,
  practiceRepository,
  render,
  renderLesson,
  openLesson,
  closeLesson,
  go,
  completeOnboarding: () => saveOnboardingStep("complete"),
  playReferenceNote,
  songStaff,
  songEvent,
  esc,
});

$("#lesson-dialog").addEventListener("cancel", (e) => {
  e.preventDefault();
  closeLesson();
});
document.addEventListener("keydown", (e) => {
  if (
    e.repeat ||
    !sessions.getSession() ||
    mode !== "demo" ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)
  )
    return;
  if (e.code === "Space" || e.code === "KeyX") {
    e.preventDefault();
    sessions.playDemo(e.code === "Space");
  }
});
window.addEventListener("pagehide", () => {
  input.disconnect();
  songStudio.dispose();
  auth.dispose();
});
if ("serviceWorker" in navigator)
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/service-worker.js").catch(() => {}),
  );
accountUI.bind();
router.start();
songStudio.initialize().then(() => {
  if (page === "studio") render();
});
loadSongs()
  .then((saved) => {
    songs = saved;
    if (page === "library") render();
  })
  .catch(() => toast("Song storage is unavailable in this browser."));
