# Current task: Song Studio / Create

## What changed

- Added a low-pressure Song Studio landing page and local projects with immediate blank/chord/riff/recording starts, metadata, autosave, arrangement sections, and selection/reordering.
- Added chord progression editing and optional helpers, a six-string beat-grid tab editor with rests and simultaneous notes, per-section lyrics/notes, local scratch recordings, experimental pitch-to-tab capture, Jam mode, snapshots, and JSON/plain-text exports.
- Added an unranked Send to Practice bridge using the existing timed-song preparation, tempo, count-in, and session flow. Studio practice does not award Skill Tree XP.
- Kept structured projects and version snapshots in IndexedDB; audio blobs use a separate object store. Wired the Song Studio navigation and offline precache.
- Fixed startup on the empty home view and prevented section/fret edits from rerendering away active input.

## Modules

`public/song-studio.js`, `song-studio-ui.js`, `song-studio-storage.js`, `song-studio-capture.js`, `riff-editor.js`, and `jam-mode.js`. Startup/navigation/style/service-worker wiring stays in existing modules. See `ARCHITECTURE.md` for ownership and storage details.

## Validation

- `npm test`: 49 passed.
- `npx playwright test`: 23 passed, 1 failed. The existing synthesized live Web Audio test in `test/browser/app.spec.js` timed out after 120 seconds waiting for the detector to advance; the full run took 30.6 minutes.
- `npx playwright test test/browser/song-studio.spec.js`: 4 passed, including create/edit/reload, Jam, mocked local recording, and Send to Practice.

## Known limits / follow-up

- Pitch-to-tab capture is experimental and the resulting tab needs manual correction.
- Projects and audio takes stay in this browser profile; cloud sync and cross-device sharing are not included.
- Exports are iRig Trainer JSON and readable chord/tab text; Guitar Pro, MusicXML, and MIDI export are future work.
- Physical Windows/iRig latency/noise testing and importing representative real Guitar Pro/MusicXML files remain real-world validation.
