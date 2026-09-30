export function createTunerUI({
  settings,
  TUNINGS,
  parseTuning,
  tuningTarget,
  noteName,
  esc,
  save,
  render,
  toast,
}) {
  const $ = (selector) => document.querySelector(selector);

  function controls() {
    return `<label class="form-group tuner-select"><span>Tuning preset</span><select id="tuning-preset">${TUNINGS.map((t) => `<option value="${t.id}" ${settings.tuningId === t.id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}<option value="custom" ${settings.tuningId === "custom" ? "selected" : ""}>Custom / imported tuning</option></select></label><div class="custom-tuning" ${settings.tuningId === "custom" ? "" : "hidden"}><label class="form-group"><span>Open strings, low to high (include octaves)</span><input id="custom-tuning" value="${esc(settings.tuning.slice().reverse().map(noteName).join(" "))}" placeholder="D2 A2 D3 G3 B3 E4"></label><button class="outline-btn" id="apply-tuning">Apply custom tuning</button></div><p class="tiny muted" id="tuning-help">Select a string below to lock its target, or use Auto. A4 = 440 Hz.</p>`;
  }

  function buttons() {
    return `<div class="tuning-strings"><button class="chip ${settings.fixedString === 0 ? "active" : ""}" data-tune-string="0">Auto</button>${settings.tuning
      .map((n, i) => ({ n, string: i + 1 }))
      .reverse()
      .map(
        ({ n, string }) =>
          `<button class="chip ${settings.fixedString === string ? "active" : ""}" data-tune-string="${string}" aria-label="Tune string ${string} to ${noteName(n)}"><small>${string}</small>${noteName(n)}</button>`,
      )
      .join("")}</div>`;
  }

  function bind() {
    $("#tuning-preset")?.addEventListener("change", (event) => {
      settings.tuningId = event.target.value;
      const tuning = TUNINGS.find((item) => item.id === event.target.value);
      if (tuning) settings.tuning = tuning.notes.slice();
      settings.fixedString = 0;
      save("irig-settings", settings);
      render();
    });
    $("#apply-tuning")?.addEventListener("click", () => {
      try {
        settings.tuning = parseTuning($("#custom-tuning").value);
        settings.tuningId = "custom";
        settings.fixedString = 0;
        save("irig-settings", settings);
        render();
        toast("Custom tuning saved.");
      } catch (error) {
        toast(error.message);
      }
    });
    document.querySelectorAll("[data-tune-string]").forEach((button) => {
      button.onclick = () => {
        settings.fixedString = Number(button.dataset.tuneString);
        document
          .querySelectorAll("[data-tune-string]")
          .forEach((item) => item.classList.toggle("active", item === button));
        $("#tuner-cents").textContent = settings.fixedString
          ? `Target: string ${settings.fixedString} · ${noteName(settings.tuning[settings.fixedString - 1])}`
          : "Auto: play any open string";
      };
    });
  }

  function update(data) {
    const target = tuningTarget(
      data.frequency,
      settings.tuning,
      settings.fixedString,
    );
    $("#tuner-note").textContent =
      data.midi === null ? "—" : noteName(data.midi);
    $("#tuner-cents").textContent = !target
      ? "Play one clean, sustained open string"
      : `String ${target.string} · target ${target.name} · ${target.cents >= 0 ? "+" : ""}${Math.round(target.cents)} cents${Math.abs(target.cents) <= 5 ? " · In tune" : ""}`;
    $("#tuner-needle").style.left =
      50 + Math.max(-50, Math.min(50, target?.cents || 0)) + "%";
    $("#input-meter").style.width = Math.min(100, data.rms * 350) + "%";
    $("#level-label").textContent = data.clipping
      ? "Clipping risk · lower the input gain"
      : data.rms < getGate()
        ? "Below noise gate"
        : "Signal received";
    document
      .querySelectorAll("[data-tune-string]")
      .forEach((button) =>
        button.classList.toggle(
          "hearing",
          target?.string === Number(button.dataset.tuneString),
        ),
      );
  }

  return { controls, buttons, bind, update };
}
