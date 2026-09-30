# iRig Trainer architecture

## Browser flow

- public/app.js starts the app, wires navigation and profile state, coordinates live audio input, and connects pages to practice. public/page-bindings.js owns page-level actions and callbacks. app.js delegates session lifecycle to public/practice/session.js, tuner behavior to public/tuner-ui.js, arena rendering to public/arena-page.js, and lesson setup markup to public/lesson-session-ui.js.
- public/navigation.js owns route names and hash navigation. Skill Tree, lesson library, setup, progress, Song Studio, and import UI each have focused page modules.
- public/style.css is the readable design system and responsive UI source. public/service-worker.js precaches the app shell and all static modules for offline use.

## Progress and practice

- Demo and live profiles are separate localStorage records (irig-demo and irig-live). Profile XP, per-skill XP, ranks, history, and challenges live in the profile. public/engine.js sanitizes/migrates profiles, creates events, grades attempts, and awards capped lesson XP; public/progression.js maps skills, prerequisites, and mastery milestones.
- Built-in lessons live in public/curriculum.js and public/lesson-patterns.js. Scale, fretboard, chord, ear, technique, and warm-up drills are generated in public/drills.js.
- Audio capture and pitch/onset/chord detection live in public/audio.js. public/input-diagnostics.js, public/tunings.js, public/metronome.js, and public/session-controls.js support setup and practice.
- public/practice/session.js owns guided/flow/battle runtime, count-in, recording, scoring, results, adaptive repeats, and session coaching. app.js passes current runtime state and callbacks into its controller. Audio recognition remains coordinated in app.js and submits attempts to the controller's current session.

## Songs and creation

- Imported songs and events live in IndexedDB through public/songs.js. public/score-worker.js parses Guitar Pro and MusicXML through alphaTab; public/score-import.js handles server imports. public/song-tempo.js scales event timing and tempo-change BPM metadata and suggests—but does not apply—the next speed.
- public/song-studio.js defines local project and lesson conversion rules. public/song-studio-storage.js stores project data and recording blobs in IndexedDB; song-studio-ui.js, riff-editor.js, song-studio-capture.js, and jam-mode.js own the editing and creative UI. Send to Practice reuses session preparation and scoring but remains unranked.

## Local state

`public/profile-store.js` owns the separate demo/live profiles and exposes saved snapshots for migration detection. `public/data/local-repositories.js` owns settings, practice packs, goals, plans, checkpoints, and account migration decisions while preserving every existing localStorage key. `public/storage.js` remains the JSON adapter. `public/songs.js` and `public/song-studio-storage.js` are the IndexedDB repositories for imported scores, projects, and recording blobs. No local records are uploaded automatically.

`public/auth/auth-service.js` is the sole account controller. It normalizes Supabase sessions into a small internal account model; `public/auth/account-ui.js` owns the optional account dialog. `public/auth/supabase-client.js` loads the official SDK only when `/api/auth-config` returns a valid public URL/key. The server reads optional `.env` values. Missing configuration or network leaves the trainer in guest mode. `public/data/migration.js` detects existing local progress and records a future-sync choice without merging or deleting data. See `SUPABASE-SETUP.md` for backend and later desktop considerations.
