# iRig Trainer architecture

## Modules

- `public/app.js` is the browser entry point and connects navigation, profile state, lesson setup, live input, session timing, and result rendering. `navigation.js`, `storage.js`, `profile-store.js`, `onboarding.js`, and the focused UI modules keep routing, persistence, setup, and page rendering separate.
- `public/style.css` is the single stylesheet and owns the design tokens, components, responsive rules, and brand treatments. `skill-tree-ui.js` owns the six-branch tree layout; its `SKILL_TREE_GEOMETRY` values also set the CSS node dimensions.
- `public/progression.js` maps practice to skills, gates nodes by prerequisite skill XP/rank, and defines mastery milestones. `public/engine.js` sanitizes/migrates profiles, builds sessions, grades attempts, and awards capped practice XP.
- `public/curriculum.js` defines built-in tab/chord lessons and authored phrases. `drills.js` builds scale, fretboard, chord, ear, technique, and warm-up lessons; `lesson-patterns.js` combines authored phrases with light variation.
- `public/audio.js` captures browser audio and detects pitch, onsets, and chords. `input-diagnostics.js`, `tunings.js`, `metronome.js`, and `session-controls.js` support device setup and practice controls.
- `public/songs.js` stores imported songs in IndexedDB and creates track/section lessons. `score-worker.js` parses Guitar Pro and MusicXML through alphaTab; `score-import.js` handles server-side imports. `song-tempo.js` scales imported tempos by mastery tier and proposes (but does not apply) faster practice speeds.
- `public/service-worker.js` caches the app shell for offline use. Brand sources are `brand-wordmark.jpg`, `brand-mark.svg`, `brand-mark-mono.svg`, and `brand-icon.svg`.

## Progress and scoring

Demo and live profiles use separate localStorage records (`irig-demo` and `irig-live`). Profile XP, per-skill XP, rank history, sessions, and challenges live in the profile; profile migration is handled by `engine.js`/`progression.js`. Mastery ranks remain Bronze/Silver/Gold/Diamond at 100/250/500/900 skill XP. Lesson XP is based on completion, accuracy, difficulty, length, and improvement, with a daily repeat cap.

`curriculum.js`, `drills.js`, and imported song lessons feed `engine.js` session events. `app.js` handles guided/flow/battle interaction, audio matching, count-in, result persistence, and coaching display. Imported songs show a preparation screen and use a default two-bar count-in; regular drills default to one bar.

First-run onboarding progress is stored under `irig-onboarding-v1`; it can be skipped and completes after the first session. The tree routes to related practice in the Lessons page and never launches a lesson itself.