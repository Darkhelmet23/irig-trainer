import {
  makeSession,
  advanceMisses,
  attempt,
  scoreResult,
  award,
  awardPracticeXP,
} from "../engine.js";
import { RULES, SHAPES, noteName } from "../curriculum.js";
import { progressionNode } from "../progression.js";
import {
  analyzeSession,
  sessionCoachMarkup,
  nextPractice,
} from "../session-coach.js";
import { createDrill } from "../drills.js";
import { scaleSongSkill, suggestNextSongSpeed } from "../song-tempo.js";
import { renderLessonHeading } from "../lesson-session-ui.js";

export function createSessionController({
  $,
  getRuntime,
  input,
  metronome,
  toast,
  profileStore,
  render,
  renderLesson,
  openLesson,
  closeLesson,
  go,
  completeOnboarding,
  playReferenceNote,
  songStaff,
  songEvent,
  esc,
}) {
  let session = null;
  let frame = 0;
  let activeRecorder = null;
  let recordingParts = [];
  let recordedAudioUrl = null;
  let autoRetryTimer = null;
  function beginRecording() {
    const { mode, practicePrefs } = getRuntime();
    if (!practicePrefs.record) return;
    if (mode !== "live" || !input.stream || !window.MediaRecorder) {
      toast(
        "Recording needs a connected live input and MediaRecorder support.",
      );
      return;
    }
    try {
      recordingParts = [];
      activeRecorder = new MediaRecorder(input.stream);
      activeRecorder.ondataavailable = (e) => {
        if (e.data?.size) recordingParts.push(e.data);
      };
      activeRecorder.start();
    } catch {
      activeRecorder = null;
      toast("This browser could not start an audio recording.");
    }
  }
  function stopRecording(keep = true) {
    if (!activeRecorder) return Promise.resolve(null);
    const recorder = activeRecorder;
    activeRecorder = null;
    return new Promise((resolve) => {
      recorder.addEventListener(
        "stop",
        () => {
          if (!keep || !recordingParts.length) {
            recordingParts = [];
            return resolve(null);
          }
          if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
          const blob = new Blob(recordingParts, {
            type: recorder.mimeType || "audio/webm",
          });
          recordingParts = [];
          recordedAudioUrl = URL.createObjectURL(blob);
          resolve(recordedAudioUrl);
        },
        { once: true },
      );
      try {
        recorder.stop();
      } catch {
        resolve(null);
      }
    });
  }
  function startSession() {
    const {
      mode,
      lesson,
      selectedRule,
      profile,
      practicePrefs,
      settings,
      connecting,
    } = getRuntime();
    if (connecting)
      return toast("Audio input is still connecting. Try again in a moment.");
    if (mode === "live" && !input.running) {
      closeLesson();
      go("setup");
      return toast("Connect your guitar input before starting a live lesson.");
    }
    if (getRuntime().onboardingStep) completeOnboarding();
    let rule =
      lesson.skill.timed || lesson.skill.adaptiveTempo
        ? { ...RULES[selectedRule], bpm: lesson.skill.bpm }
        : RULES[selectedRule];
    if (lesson.skill.adaptiveTempo && rule.mode === "wait")
      rule = { ...rule, mode: "flow", window: Math.max(300, rule.window) };
    if (practicePrefs.accuracyMode === "pitch")
      rule = { ...rule, mode: "wait" };
    else if (practicePrefs.accuracyMode === "rhythm")
      rule = { ...rule, mode: "flow" };
    if (lesson.skill.songId)
      rule = {
        ...rule,
        mode: lesson.options.songMode === "scrolling" ? "flow" : "wait",
        bpm: lesson.skill.bpm,
      };
    const countInBars = lesson.skill.songId
      ? (lesson.options.countInBars ?? practicePrefs.songCountInBars ?? 2)
      : practicePrefs.countInBars;
    const countInMs =
      ((Number(countInBars) || 0) * 4 * 60000) / Math.max(30, rule.bpm || 60);
    session = makeSession(
      lesson.skill,
      rule,
      profile,
      performance.now(),
      countInMs,
    );
    session.profileMode = mode;
    session.library = lesson.library;
    session.accuracyMode = practicePrefs.accuracyMode;
    session.practiceOptions = lesson.options || {};
    session.loopRound = lesson.loopRound || 1;
    session.wallStarted = Date.now();
    input.chordMode =
      session.accuracyMode !== "rhythm" && !!session.events[0]?.chord;
    input.chordCandidates = lesson.skill.candidates;
    input.armed = true;
    input.lastKey = null;
    const personalBest = profile.history
      .filter(
        (h) =>
          h.title === lesson.skill.title &&
          Array.isArray(h.trace) &&
          h.trace.length,
      )
      .sort((a, b) => b.accuracy - a.accuracy)[0];
    session.ghostTrace = personalBest?.trace || [];
    session.events.forEach((event, i) => {
      const delta = session.ghostTrace[i];
      if (Number.isFinite(delta)) event.ghostDeltaMs = delta;
    });
    if (practicePrefs.metronome)
      metronome
        .start({
          bpm: rule.bpm || 60,
          subdivision: practicePrefs.subdivision,
          accent: practicePrefs.accent,
        })
        .catch(() => toast("Metronome audio could not start."));
    beginRecording();
    $("#lesson-content").innerHTML =
      renderLessonHeading({ lesson, mode, esc }) +
      `<div class="lesson-body"><div class="play-stats"><div>MODE<strong>${rule.mode === "wait" ? "Guided" : rule.mode === "battle" ? "Mastery battle" : "Flow"}</strong></div><div>ACCURACY<strong id="live-accuracy">—</strong></div><div>TARGET<strong>${rule.threshold}%</strong></div><div>PROGRESS<strong id="live-progress">0 / ${session.events.length}</strong></div><div>TEMPO<strong>${rule.mode === "wait" ? "Your pace" : Math.round(rule.bpm) + " BPM"}</strong></div></div><div class="stage ${lesson.skill.timed ? "song-stage" : lesson.skill.track === "chords" ? "chord-stage" : ""}" id="stage" style="${lesson.skill.timed ? "height:" + Math.max(250, 80 + (lesson.skill.tuning?.length || 6) * 30) + "px" : ""}"><div class="play-line"></div>${lesson.skill.timed ? songStaff(lesson.skill) : lesson.skill.track === "tabs" ? '<div class="string-labels"><span>e</span><span>B</span><span>G</span><span>D</span><span>A</span><span>E</span></div>' : ""}${session.events.map((e, i) => (lesson.skill.timed ? songEvent(e, i) : `<div class="note-event ${e.chord ? "chord" : ""}" id="event-${i}" ${!e.chord ? `style="top:${lesson.skill.hiddenTarget ? 130 : 40 + (e.string - 1) * 30}px"` : ""}>${lesson.skill.hiddenTarget ? "?" : esc(e.chord || e.fret)}</div>`)).join("")}</div><div class="target-card"><div><span class="eyebrow">UP NEXT</span><div><strong id="target-name"></strong></div><p id="target-detail"></p></div><div class="heard"><span id="heard-label">${mode === "demo" ? "Keyboard demo" : "Listening to your guitar…"}</span><div class="meter" style="width:120px"><div id="lesson-meter"></div></div></div></div><div class="feedback" id="feedback" role="status" aria-live="polite">Get ready…</div>${rule.mode === "battle" ? `<div class="battle-progress"><div>You · +${session.boost}% boost<div class="meter"><div id="you-bar"></div></div></div><div>Echo · target 940<div class="meter"><div id="echo-bar"></div></div></div></div>` : ""}${mode === "demo" ? '<div class="demo-controls"><button class="primary" id="demo-hit">Play target <kbd>Space</kbd></button><button class="outline-btn" id="demo-miss">Wrong note <kbd>X</kbd></button><span>Demo progress only · hold/repeat is ignored</span></div>' : '<p class="tiny muted" style="text-align:center;margin:15px 0 0">Pluck each note distinctly. For repeated notes, mute briefly between attacks.</p>'}<div class="lesson-foot"><button class="subtle-btn" id="restart">↺ Restart</button><span class="tiny muted">${rule.mode === "wait" ? "Wrong attempts lower accuracy. Take your time." : "Notes move toward the green play line. Keep going after a miss."}</span><button class="subtle-btn" id="exit-practice">Exit lesson</button></div></div>`;
    session.renderedEventCount = session.events.length;
    if (lesson.skill.hiddenTarget)
      document.querySelectorAll("#stage .fret-marker").forEach((marker) => {
        marker.textContent = "?";
        marker.title = "Target hidden";
      });
    if (lesson.skill.earTraining)
      document
        .querySelector(".target-card")
        ?.insertAdjacentHTML(
          "afterend",
          '<button class="outline-btn" id="play-reference">Play current reference note</button>',
        );
    session.events.forEach((event, i) => {
      if (Number.isFinite(event.ghostDeltaMs)) {
        const marker = document.createElement("i");
        marker.className = "ghost-note";
        marker.setAttribute("aria-label", "Personal best timing");
        $("#event-" + i)?.append(marker);
      }
    });
    $("#close-lesson").onclick = closeLesson;
    $("#exit-practice").onclick = closeLesson;
    $("#restart").onclick = () => {
      cancelSession();
      startSession();
    };
    $("#demo-hit")?.addEventListener("click", () => playDemo(true));
    $("#demo-miss")?.addEventListener("click", () => playDemo(false));
    $("#play-reference")?.addEventListener("click", playReferenceNote);
    if (session.endless) {
      $("#exit-practice").textContent = "Finish run & see results";
      $("#exit-practice").onclick = finishEndless;
    }
    frame = requestAnimationFrame(tick);
  }
  function playDemo(match) {
    const { mode } = getRuntime();
    if (mode !== "demo" || !session) return;
    attempt(
      session,
      session.accuracyMode === "rhythm" ? true : match,
      performance.now(),
    );
  }
  function tick(now) {
    const { mode, settings } = getRuntime();
    if (!session) return;
    if (document.hidden) {
      cancelSession();
      renderLesson();
      return toast(
        "Lesson paused because the tab was hidden. Start again when you’re ready.",
      );
    }
    advanceMisses(session, now - settings.offset * (mode === "live" ? 1 : 0));
    if (session.ended) return finishSession();
    const s = session,
      e = s.events[s.index],
      remaining = s.started + s.countInMs - now;
    while (s.renderedEventCount < s.events.length) {
      const index = s.renderedEventCount,
        event = s.events[index],
        el = document.createElement("div");
      el.className = `note-event ${event.chord ? "chord" : ""}`;
      el.id = `event-${index}`;
      if (!event.chord)
        el.style.top = `${s.skill.hiddenTarget ? 130 : 40 + (event.string - 1) * 30}px`;
      el.textContent = s.skill.hiddenTarget ? "?" : event.chord || event.fret;
      $("#stage").append(el);
      s.renderedEventCount++;
    }
    $("#feedback").textContent =
      remaining > 0
        ? `COUNT IN · ${Math.ceil(remaining / (60000 / Math.max(30, s.rule.bpm || 60)))}`
        : s.feedback;
    $("#feedback").classList.toggle("count-in-active", remaining > 0);
    input.chordMode = s.accuracyMode !== "rhythm" && !!e.chord;
    $("#target-name").textContent = e.passive
      ? e.rest
        ? "Rest"
        : "Hold / technique"
      : e.label || e.chord || noteName(e.midi);
    $("#target-detail").textContent = s.skill.timed
      ? `Measure ${e.measure} · ${(e.durationMs / 1000).toFixed(2)}s · ${e.techniques?.join(", ") || (e.string ? "String " + e.string + " · fret " + e.fret : "Play the shown notes")}${e.suggested ? " · suggested fingering" : ""}`
      : e.chord
        ? `${SHAPES[e.chord]} · low E → high e`
        : `String ${e.string} · ${e.fret ? "fret " + e.fret : "open"} · ${e.midi ? noteName(e.midi) : ""}`;
    $("#live-progress").textContent = `${s.index} / ${s.events.length}`;
    const denominator = s.rule.mode === "wait" ? s.attempts : s.judged;
    $("#live-accuracy").textContent = denominator
      ? `${Math.round((s.hits / denominator) * 100)}%`
      : "—";
    const width = $("#stage").clientWidth,
      speed = 110 / (60000 / s.rule.bpm),
      playhead = Math.max(now, s.started + s.countInMs),
      clock = playhead - (mode === "live" ? settings.offset : 0);
    s.events.forEach((ev, i) => {
      const el = $("#event-" + i);
      const x =
        s.rule.mode === "wait"
          ? width * 0.22 + (i - s.index) * 90
          : width * 0.22 + (ev.at - clock) * speed;
      el.style.left = x + "px";
      el.style.visibility = x < -60 || x > width + 60 ? "hidden" : "visible";
      el.classList.toggle("hit", ev.status === "hit");
      el.classList.toggle("miss", ev.status === "miss");
      el.classList.toggle("wrong", ev.status === "wrong");
    });
    s.events.forEach((event, i) => {
      if (Number.isFinite(event.ghostDeltaMs)) {
        const marker = $("#event-" + i)?.querySelector(".ghost-note");
        if (marker)
          marker.style.left = `calc(50% + ${event.ghostDeltaMs * speed}px)`;
      }
    });
    if (s.rule.mode === "battle") {
      $("#you-bar").style.width =
        Math.min(
          100,
          ((100 * s.hits) / s.events.length) * (1 + s.boost / 100),
        ) + "%";
      $("#echo-bar").style.width =
        Math.min(
          94,
          (94 * Math.max(0, now - s.started - s.countInMs)) /
            (s.events.at(-1).at - s.started - s.countInMs),
        ) + "%";
    }
    frame = requestAnimationFrame(tick);
  }
  function finishSession() {
    const { mode, profile, lesson, practicePrefs, settings } = getRuntime();
    const s = session,
      previousHistory = profile.history.slice(),
      finishedAt = Date.now();
    cancelAnimationFrame(frame);
    session = null;
    input.chordMode = false;
    metronome.stop();
    const recordingPromise = stopRecording(true);
    const result = scoreResult({
      hits: s.hits,
      total: s.total,
      attempts: s.attempts,
      mode: s.rule.mode,
      boost: s.rule.mode === "battle" ? s.boost : 0,
      ai: s.rule.ai,
      threshold: s.rule.threshold,
    });
    const priorStrongRun = previousHistory.some(
      (item) =>
        item.title === s.skill.title &&
        Math.abs((item.speed || 1) - (s.skill.speed || 1)) < 0.005 &&
        (item.accuracy || 0) >= 90,
    );
    const nextSongSpeed =
      s.skill.timed && priorStrongRun
        ? suggestNextSongSpeed(s.skill.speed, result.accuracy)
        : null;
    const xpReward =
      !s.library && !s.skill.adaptiveReplay
        ? awardPracticeXP(profile, s.skill, s, result, {
            history: previousHistory,
            at: finishedAt,
          })
        : { xp: 0, targets: [], activityKey: s.skill.id };
    const upgraded =
      !s.library &&
      !s.skill.adaptiveReplay &&
      award(profile, s.skill, s.rule, result);
    profile.sessions++;
    if (s.skill.progressionChallenge && result.passed) {
      profile.masteryChallenges = profile.masteryChallenges || {};
      profile.masteryChallenges[s.skill.progressionNodeId] = true;
    }
    const detailed = s.events
      .filter((e) => !e.passive)
      .flatMap((e) =>
        e.chord
          ? [
              {
                key: `chord:${e.chord}`,
                label: e.chord,
                kind: "chord",
                hit: e.status === "hit",
                measure: e.measure,
              },
              ...(e.notes || []).map((n) => ({
                key: `position:${n.string}:${n.fret}`,
                label: `String ${n.string} · fret ${n.fret}`,
                kind: "position",
                hit: e.status === "hit",
                string: n.string,
                fret: n.fret,
                measure: e.measure,
              })),
            ]
          : [
              {
                key: `note:${e.midi}`,
                label: noteName(e.midi),
                kind: "note",
                hit: e.status === "hit",
                string: e.string,
                fret: e.fret,
                measure: e.measure,
              },
            ],
      );
    profile.history.unshift({
      title: s.skill.title,
      lessonId: s.skill.id,
      activityKey: xpReward.activityKey,
      xpAwarded: xpReward.xp,
      rank: s.rule.name,
      accuracy: result.accuracy,
      passed: result.passed,
      at: finishedAt,
      bpm: s.rule.bpm || 0,
      speed: s.skill.speed || 1,
      hits: s.hits,
      total: s.total,
      durationMs: Math.max(0, finishedAt - (s.wallStarted || finishedAt)),
      timingMode: s.rule.mode,
      targets: detailed.slice(0, 256),
      trace: s.events
        .filter((e) => !e.passive)
        .map((e) => e.deltaMs ?? null)
        .slice(0, 256),
    });
    profile.history = profile.history.slice(0, 200);
    profileStore.persist(s.profileMode, profile);
    if (s.skill.checkpointKey && !s.skill.adaptiveReplay) {
      try {
        const ranks = JSON.parse(
            localStorage.getItem("irig-checkpoints-v1") || "{}",
          ),
          rank =
            result.accuracy >= 98
              ? "Diamond"
              : result.accuracy >= 90
                ? "Gold"
                : result.accuracy >= 80
                  ? "Silver"
                  : result.accuracy >= 70
                    ? "Bronze"
                    : "Unranked",
          old = ranks[s.skill.checkpointKey];
        if (!old || result.accuracy > old.accuracy)
          ranks[s.skill.checkpointKey] = {
            accuracy: result.accuracy,
            rank,
            at: Date.now(),
          };
        localStorage.setItem("irig-checkpoints-v1", JSON.stringify(ranks));
      } catch {}
    }
    $("#lesson-content").innerHTML =
      renderLessonHeading({ lesson, mode, esc }) +
      `<div class="lesson-body result"><div class="result-icon">${result.passed ? "✦" : "↺"}</div><span class="eyebrow">${s.profileMode === "demo" ? "DEMO RESULT" : "SESSION COMPLETE"}</span><h2 style="margin-top:14px">${upgraded ? s.rule.name + " earned." : result.passed ? "That’s a good session." : "Every attempt is practice."}</h2><div class="accuracy">${result.accuracy}%</div><p>${s.hits} of ${s.total} targets hit${s.rule.mode === "wait" ? ` · ${s.attempts} attempts` : ""} · ${s.rule.threshold}% required</p>${s.rule.mode === "battle" ? `<p>You: <strong>${result.points}</strong> points (+${s.boost}%) · Echo: <strong>${result.aiPoints}</strong><br>${result.points > result.aiPoints ? "You outscored Echo." : "Beat Echo’s score to win. A tie is not a win."}</p>` : ""}<p class="xp-award-pulse">${
        xpReward.xp
          ? `+${xpReward.xp} XP toward ${xpReward.targets
              .map((id) => progressionNode(id)?.title)
              .filter(Boolean)
              .join(", ")}.`
          : result.passed
            ? "Mastery XP for this lesson has reached today’s limit."
            : "Reach 60% accuracy to earn mastery XP from this lesson."
      }${upgraded ? ` ${s.rule.name} rank recorded.` : ""}${s.profileMode === "demo" ? "<br>These rewards are saved to your demo profile only." : ""}</p><div class="demo-controls"><button class="outline-btn" id="result-retry">Practice again</button><button class="primary" id="result-done">Back to your journey →</button></div></div>`;
    const report = analyzeSession(s, result, previousHistory);
    $("#lesson-content .lesson-body.result")?.insertAdjacentHTML(
      "beforeend",
      sessionCoachMarkup(report),
    );
    $("#result-warmup")?.addEventListener("click", () => {
      const warmup = createDrill("warmup", {
        profile,
        tuning: settings.tuning,
      });
      closeLesson();
      openLesson(warmup, true);
    });
    if (s.skill.id === "drill-chords") {
      const minutes = Math.max(
          0.01,
          (Date.now() - (s.wallStarted || Date.now())) / 60000,
        ),
        rate = Math.round(s.hits / minutes);
      $(".result .accuracy")?.insertAdjacentHTML(
        "afterend",
        `<p class="transition-rate">${rate} clean chord changes per minute</p>`,
      );
    }
    if (nextSongSpeed) {
      const tempo = Math.round(
        (s.skill.originalBpm || s.skill.bpm / s.skill.speed) * nextSongSpeed,
      );
      $(".result .accuracy")?.insertAdjacentHTML(
        "afterend",
        `<p class="tempo-suggestion">${result.accuracy}% accuracy at ${Math.round(s.skill.bpm)} BPM. Ready to try ${tempo} BPM?</p><button class="outline-btn" id="try-next-song-speed">Try ${Math.round(nextSongSpeed * 100)}% · ${tempo} BPM</button>`,
      );
      $("#try-next-song-speed")?.addEventListener("click", () => {
        lesson.skill = scaleSongSkill(s.skill, nextSongSpeed);
        lesson.options.manualTempo = true;
        renderLesson();
      });
    }
    $("#close-lesson").onclick = closeLesson;
    $("#result-done").onclick = closeLesson;
    $("#result-retry").onclick = renderLesson;
    render();
    if (activeRecorder || practicePrefs.record) {
      $(".result .demo-controls")?.insertAdjacentHTML(
        "beforebegin",
        '<div id="recording-playback" class="recording-playback">Finalizing local recording…</div>',
      );
      recordingPromise.then((url) => {
        const box = $("#recording-playback");
        if (box)
          box.innerHTML = url
            ? `<span>Listen to your run</span><audio controls src="${url}"></audio><a href="${url}" download="irig-practice.webm">Save recording</a>`
            : "<span>No live recording was captured.</span>";
      });
    }
    const continuation = nextPractice(lesson, s, result);
    if (continuation) {
      const retryLesson = lesson;
      $(".result .demo-controls")?.insertAdjacentHTML(
        "beforebegin",
        `<p class="notice adaptive-notice">${esc(continuation)} Restarting shortly… <button class="subtle-btn" id="stop-auto-retry">Stop</button></p>`,
      );
      autoRetryTimer = setTimeout(() => {
        autoRetryTimer = null;
        if ($("#lesson-dialog")?.open && lesson === retryLesson) {
          renderLesson();
          startSession();
        }
      }, 1600);
      $("#stop-auto-retry")?.addEventListener("click", () => {
        clearTimeout(autoRetryTimer);
        autoRetryTimer = null;
      });
    }
  }
  function finishEndless() {
    if (!session?.endless) return closeLesson();
    session.endless = false;
    session.userStoppedEndless = true;
    session.events = session.events.slice(0, session.index);
    session.total = session.events.filter((event) => !event.passive).length;
    session.ended = true;
    finishSession();
  }
  function cancelSession() {
    cancelAnimationFrame(frame);
    session = null;
    input.chordMode = false;
    input.chordCandidates = null;
    metronome.stop();
    stopRecording(false);
  }
  return {
    startSession,
    finishEndless,
    cancelSession,
    playDemo,
    getSession: () => session,
    clearAutoRetry() {
      clearTimeout(autoRetryTimer);
      autoRetryTimer = null;
    },
  };
}
