# Current task

## Goal

Refactor the browser app into focused modules, then replace rank-gated linear progression with a branched XP/mastery tree, expand scale practice and lesson lengths, and improve visual contrast while preserving existing features.

## Completed before this task

- Existing app has 18 passing Node tests and 13 passing Playwright tests.
- Initial architecture map is in `ARCHITECTURE.md`.

## Phases

1. **Complete:** split page routing, storage wrappers, skill-tree/library/setup rendering, lesson headings/previews, and song-import rendering/bindings into focused modules. Preserve existing lesson/session coordination in `app.js`; a delayed adaptive retry now cancels when its lesson closes. Node 18/18 and Playwright 13/13 pass.
2. **Complete:** add six branch-based XP/mastery progression, configurable prerequisite XP and rank gates, v1 profile migration, and lesson XP based on completion, accuracy, difficulty, length, improvement, and daily repeat limits. Node 22/22 and Playwright 13/13 pass.
3. **Complete:** replace the lesson-launcher grid with a connected six-branch mastery map, prerequisite/XP detail, and filtered Lessons routing. Expand scale drills across keys, positions, directions, 2–4-note sequences, position shifts, and a real 60–100% tempo ladder. Move new arena bonuses/challenges to branch mastery while preserving migrated rank profiles. Node 28/28 and Playwright 13/13 pass.
4. **Complete:** built-in/generated lessons now target 32/48/72/96 attacks by difficulty, with phrase reversals, rotations, alternate endings, and same-pitch string changes. Add optional endless practice that appends varied blocks and returns a scored run when stopped. Node 30/30 and Playwright 14/14 passed.
5. **Complete:** set a high-contrast charcoal theme with bright progression paths and distinct mastery colors; extracted demo/live profile switching into `profile-store.js`; precached the new UI/pattern/profile/theme modules. Node 31/31 and Playwright 14/14 pass, including offline shell caching.

## Current state

- Baseline before refactor: `npm.cmd test` passed 18/18; `npx.cmd playwright test` passed 13/13.
- Working copy: `.irig-trainer-stage` is a staged project snapshot without Git metadata. The publish target is GitHub PR #1, branch `feat/session-coach`.
- Refactor modules added: `public/storage.js`, `navigation.js`, `skill-tree-ui.js`, `lesson-library-ui.js`, `setup-ui.js`, `lesson-session-ui.js`, and `song-import-ui.js`. Service-worker precache includes them.
- Refactor modules include `storage.js`, `profile-store.js`, `navigation.js`, `skill-tree-ui.js`, `progression-library-ui.js`, `lesson-library-ui.js`, `setup-ui.js`, `lesson-session-ui.js`, `song-import-ui.js`, and `lesson-patterns.js`. Session scheduling and audio/input orchestration remain in `app.js`.
- New `public/progression.js` defines six connected branches, mastery thresholds, prerequisite XP/rank gates, and lesson-to-skill mapping. Profiles use version 3 with `skillXP` and `masteryChallenges`; v1/2 profiles migrate rank XP and keep session history. Successful sessions award XP only to open nodes, weighted by length, accuracy, difficulty, and improvement, with three rewards per activity per day.
- `skill-tree-ui.js` draws the connected map and details; the tree no longer launches lessons. `progression-library-ui.js` filters related built-in lessons and configures scale practice. Scale tempo ladders now advance only after 90% accuracy. Echo unlocks at Gold mastery and records successful challenge wins.
- All requested implementation phases are complete. Final full checks: `npm.cmd test` 31/31 and `npx.cmd playwright test` 14/14. The staged workspace has no Git metadata; the GitHub target is PR #1 on `feat/session-coach`.
