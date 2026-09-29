# iRig Trainer contributor context

## Fast orientation

Read this file and `ARCHITECTURE.md` first. Read `CURRENT-TASK.md` for active work, and verify its status against GitHub or the local Git checkout before relying on it. Open only files relevant to the current change; use `rg` to locate code instead of scanning the whole project.

## Project map

- This is a vanilla JavaScript ES-module app served locally by Node. It is also a PWA with offline shell caching.
- `public/app.js` coordinates startup, audio input, and lesson sessions. Page rendering and profile selection are split into focused modules; see `ARCHITECTURE.md` for the map.
- `public/progression.js` owns the six-branch skill graph, prerequisites, mastery thresholds, and XP awards. `curriculum.js` defines built-in lessons; `drills.js` generates fretboard and scale practice; `lesson-patterns.js` expands built-in sessions.
- `public/engine.js` validates and migrates profile data. Demo/live profiles and per-skill XP are stored in browser localStorage. Imported scores are stored in IndexedDB and parsed by `score-worker.js` through the local `score-import.js` service.
- `public/audio.js` handles live audio capture, pitch/onset analysis, and chord recognition. Physical iRig behavior still needs real-hardware validation.

## Preserve existing behavior

Keep live guitar input, tuner and alternate tunings, calibration, note/chord detection, Guitar Pro/MusicXML imports, scoring, coaching, adaptive repeats, loops/checkpoints, history, custom lessons, demo mode, and offline use working. Do not add unlicensed commercial tabs or recordings.

## Working and testing

Make focused changes within the existing module boundaries. Run `npm test` for logic changes and `npx playwright test` for browser behavior; run both for cross-cutting changes. Node 22 or newer is required. Do not force-push or merge a pull request unless the user asks.

The canonical repository is `Darkhelmet23/irig-trainer`. Check the current branch and working tree before publishing. Some local staging copies may not contain `.git`; in that case, inspect the current GitHub branch and base new commits on its latest head without replacing unrelated files.
