import { REPERTOIRE } from "./repertoire.js";

export function createPageBindings({
  $,
  getState,
  setSelected,
  setLessonFilter,
  setPacks,
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
}) {
  return function bindPage() {
    const state = getState();
    const { page, mode, profile, settings, practicePrefs } = state;
    let { selected, lessonFilter, packs } = state;
    songImportUI.bind();
    tunerUI.bind();
    bindOnboarding();
    bindScaleBuilder();
    songStudio.bind();
    if (page === "library")
      bindLibraryTools({
        packs,
        settings,
        practice: practicePrefs,
        onPack: (pack) => {
          if (packs.length >= 30)
            return toast("This library holds up to 30 imported packs.");
          packs.push(pack);
          practiceRepository.savePacks(packs);
          render();
          toast("Custom lesson added to your library.");
        },
        onBundle: (bundle) => {
          if (packs.length + bundle.packs.length > 30)
            return toast(
              "Remove some imported packs first; the library holds up to 30.",
            );
          packs = [...packs, ...bundle.packs];
          setPacks(packs);
          if (validTuning(bundle.tuner?.tuning)) {
            settings.tuning = bundle.tuner.tuning.slice();
            settings.tuningId =
              TUNINGS.find(
                (t) => t.notes.join(",") === settings.tuning.join(","),
              )?.id || "custom";
            settings.gate = Math.max(
              0.001,
              Math.min(0.05, Number(bundle.tuner.gate) || settings.gate),
            );
            settings.offset = Math.max(
              -300,
              Math.min(300, Number(bundle.tuner.offset) || 0),
            );
            settingsRepository.saveDevice(settings);
          }
          const p = bundle.practice || {};
          practicePrefs.countInBars = [0, 1, 2].includes(Number(p.countInBars))
            ? Number(p.countInBars)
            : practicePrefs.countInBars;
          practicePrefs.subdivision = [1, 2, 4].includes(Number(p.subdivision))
            ? Number(p.subdivision)
            : practicePrefs.subdivision;
          practicePrefs.metronome = !!p.metronome;
          practicePrefs.accent = p.accent !== false;
          practicePrefs.accuracyMode = ["both", "pitch", "rhythm"].includes(
            p.accuracyMode,
          )
            ? p.accuracyMode
            : practicePrefs.accuracyMode;
          practiceRepository.savePacks(packs);
          settingsRepository.savePractice(practicePrefs);
          render();
          toast("Bundle imported. Lessons and practice settings are ready.");
        },
      });
    if (page === "progress")
      bindProgressPage((type, options) => {
        try {
          openLesson(
            createDrill(type, { ...options, profile, tuning: settings.tuning }),
            true,
          );
        } catch (error) {
          toast(error.message);
        }
      });
    if (page === "setup")
      bindSessionTools(
        practicePrefs,
        (prefs) => settingsRepository.savePractice(prefs),
        startLatencyCalibration,
        inputDiagnostics,
      );
    $("#switch-mode")?.addEventListener("click", () => {
      const nextMode = mode === "demo" ? "live" : "demo";
      setMode(nextMode);
      if (nextMode === "live" && !input.running) go("setup");
    });
    $("#view-arena")?.addEventListener("click", () => go("arena"));
    $("#buff-info")?.addEventListener("click", () => go("arena"));
    $("#practice-related")?.addEventListener("click", (e) => {
      lessonFilter = e.currentTarget.dataset.node;
      setLessonFilter(lessonFilter);
      go("library");
    });
    $("#clear-lessons-filter")?.addEventListener("click", () => {
      lessonFilter = "";
      setLessonFilter(lessonFilter);
      render();
    });
    document.querySelectorAll("[data-progression-node]").forEach((button) =>
      button.addEventListener("click", () => {
        selected = button.dataset.progressionNode;
        setSelected(selected);
        render();
        document
          .querySelector(".progression-detail")
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }),
    );
    document.querySelectorAll("[data-progression-lesson]").forEach((button) =>
      button.addEventListener("click", () => {
        const base = skillById(button.dataset.progressionLesson),
          node = progressionNode(lessonFilter);
        if (!base || !node) return;
        openLesson(
          {
            ...base,
            requires: null,
            progressionSkills: [node.id],
            progressionNodeId: node.id,
          },
          false,
          0,
          { progressionPractice: true },
        );
      }),
    );
    document.querySelectorAll("[data-progression-drill]").forEach((button) =>
      button.addEventListener("click", () => {
        const node = progressionNode(lessonFilter);
        if (!node) return;
        try {
          const type = button.dataset.progressionDrill,
            drillOptions = { profile, tuning: settings.tuning };
          if (type === "scale") {
            drillOptions.root = $("#scale-root")?.value || "E";
            drillOptions.scale = $("#scale-name")?.value || "Minor pentatonic";
            drillOptions.position = Number($("#scale-position")?.value) || 1;
            drillOptions.sequenceLength =
              Number($("#scale-sequence")?.value) || 1;
            drillOptions.direction = $("#scale-direction")?.value || "up-down";
            drillOptions.positionShift = $("#scale-shift")?.checked || false;
            drillOptions.tempoLadder = $("#scale-ladder")?.checked || false;
          }
          const activity = createDrill(type, drillOptions);
          openLesson(
            {
              ...activity,
              requires: null,
              progressionSkills: [node.id],
              progressionNodeId: node.id,
            },
            false,
            0,
            { progressionPractice: true },
          );
        } catch (error) {
          toast(error.message);
        }
      }),
    );
    $("#battle")?.addEventListener("click", () => {
      const node = progressionNode($("#arena-skill").value);
      if (!node) return;
      try {
        const base = node.activityIds.map((id) => skillById(id)).find(Boolean),
          drillId = node.activityIds.find((id) => id.startsWith("drill-"));
        const activity =
          base ||
          createDrill((drillId || "drill-scale").slice(6), {
            tuning: settings.tuning,
            root: "E",
            scale: "Minor pentatonic",
            position: node.id === "scales-positions" ? 2 : 1,
            sequenceLength: node.id === "scales-sequences" ? 3 : 1,
            positionShift: node.id === "scales-shifts",
          });
        openLesson(
          {
            ...activity,
            requires: null,
            progressionSkills: [node.id],
            progressionNodeId: node.id,
            progressionChallenge: true,
          },
          false,
          3,
          { progressionPractice: true },
        );
      } catch (error) {
        toast(error.message);
      }
    });
    document.querySelectorAll("[data-repertoire]").forEach(
      (b) =>
        (b.onclick = () => {
          const chart = REPERTOIRE.find(
            (item) => item.id === b.dataset.repertoire,
          );
          if (chart) openLesson(chart, true);
        }),
    );
    document.querySelectorAll("[data-library]").forEach(
      (b) =>
        (b.onclick = () => {
          const key = b.dataset.library;
          let s;
          if (key.startsWith("pack-")) {
            const p = packs[Number(key.slice(5))];
            s = {
              ...p,
              id: "library",
              track: p.sequence[0].chord ? "chords" : "tabs",
              guide: `Practice “${p.title}” by ${p.author}. Start slowly and focus on clean changes.`,
              requires: null,
            };
          } else {
            s = {
              ...skillById(key),
              title:
                key === "tabs-4"
                  ? "First light · E minor pentatonic"
                  : "Open road · Four-chord loop",
            };
          }
          openLesson(s, true);
        }),
    );
    $("#import-pack")?.addEventListener("click", () => $("#pack-file").click());
    $("#pack-file")?.addEventListener("change", importPack);
    $("#download-pack")?.addEventListener("click", downloadPack);
    $("#connect")?.addEventListener("click", connect);
    $("#disconnect")?.addEventListener("click", async () => {
      await input.disconnect();
      audioLabel = "Disconnected";
      render();
    });
    $("#channel")?.addEventListener("change", (e) => {
      settings.channel = Number(e.target.value);
      settingsRepository.saveDevice(settings);
      toast("Channel saved. Reconnect input to apply.");
    });
    $("#gate")?.addEventListener("input", (e) => {
      settings.gate = Number(e.target.value);
      input.gate = settings.gate;
      $("#gate-label").textContent = settings.gate.toFixed(3);
      settingsRepository.saveDevice(settings);
    });
    $("#offset")?.addEventListener("input", (e) => {
      settings.offset = Number(e.target.value);
      inputDiagnostics.setCalibration(settings.offset);
      $("#offset-label").textContent = settings.offset + " ms";
      renderInputDiagnostics(inputDiagnostics.snapshot());
      settingsRepository.saveDevice(settings);
    });
    $("#live-mode")?.addEventListener("change", (e) =>
      setMode(e.target.checked ? "live" : "demo"),
    );
  };
}
