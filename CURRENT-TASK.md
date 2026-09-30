# Current task: optional accounts and future cloud-sync foundation

Checkout: `C:\Users\nrobe\irig-trainer`, branch `main`. The account foundation follows the previously committed refactor and CI work. Check Git status and GitHub for the current publication state.

## Changes in this pass

- Added optional Supabase account service, browser client loader, and account dialog for Apple/Google/Facebook OAuth, email/password, reset, sign-out, and guest use.
- Added local settings/practice/migration repositories. Existing profile keys and IndexedDB schemas stay intact; imported songs and Song Studio recordings remain local.
- Added migration detection and explicit future-sync choice. No cloud upload, merge, or deletion exists.
- Added `.env.example`, public-config endpoint, SDK build step, PWA cache update, tests, and `SUPABASE-SETUP.md`.

## Validation

- `npm ci`: passed and generated the ignored official Supabase browser bundle.
- `npm test`: 58 passed (49 existing + 9 new).
- `npx playwright test`: 28 passed (24 existing + 4 new); the account file passed again after adding refresh restoration coverage.
- `git diff --check`: passed.

## Remaining

- Real provider login requires a Supabase project, provider dashboards, and redirect configuration.
- Physical Windows/iRig and representative score-file validation remain open from `HARDWARE-VALIDATION.md`.
- Future work: secure opt-in cloud sync with conflict handling, optional recording backup, and Tauri deep-link handling.
