# Current task: Supabase repository foundation

Checkout: `C:\Users\nrobe\irig-trainer`, branch `main`. Check Git status and GitHub before publishing. The Supabase CLI project is now at repository-root `supabase/`; the GitHub integration working directory is `.`.

## Changes in this pass

- Scaffolded `supabase/config.toml` and an initial migration for owner-scoped profile, skill, session, settings, and Song Studio project data. All five tables have RLS. The schema is not yet applied to the live Supabase project.
- Updated Supabase setup and architecture docs. No browser sync code or recording upload was added.
- Added optional Supabase account service, browser client loader, and account dialog for Apple/Google/Facebook OAuth, email/password, reset, sign-out, and guest use.
- Added local settings/practice/migration repositories. Existing profile keys and IndexedDB schemas stay intact; imported songs and Song Studio recordings remain local.
- Added migration detection and explicit future-sync choice. No cloud upload, merge, or deletion exists.
- Added `.env.example`, public-config endpoint, SDK build step, PWA cache update, tests, and `SUPABASE-SETUP.md`.

## Validation

- Repository scaffold: Supabase CLI 2.119.0. Docker/Postgres are not installed here, so the migration has not been executed against a local database.
- `npm test` after adding the scaffold: 58 passed. `git diff --check`: passed.
- `npm ci`: passed and generated the ignored official Supabase browser bundle.
- `npm test`: 58 passed (49 existing + 9 new).
- `npx playwright test`: 28 passed (24 existing + 4 new); the account file passed again after adding refresh restoration coverage.
- `git diff --check`: passed.

## Remaining

- `Darkhelmet23/irig-trainer` is the confirmed repository for root `supabase/`. Verify the Supabase GitHub integration's **Deploy to production** setting before pushing the migration to `main`; a push may otherwise apply it automatically. Do not manually apply the migration yet. Test RLS with two accounts against a local or staging database before enabling sync.
- Real provider login requires a Supabase project, provider dashboards, and redirect configuration.
- Physical Windows/iRig and representative score-file validation remain open from `HARDWARE-VALIDATION.md`.
- Future work: secure opt-in cloud sync with conflict handling, optional recording backup, and Tauri deep-link handling.
