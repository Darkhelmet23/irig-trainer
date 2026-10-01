# Current task: RiffTree cloud sync

Branch: `main`. Public name: **RiffTree**. GitHub repository: `Darkhelmet23/irig-trainer` (unchanged). Apple authentication remains deferred; supported methods are email/password, Google, Facebook, and local guest mode.

Account merge now has a post-deletion restoration stage: missing Google/Facebook providers use manual linking, and an OAuth primary can set a new password for its primary email. `irig-merge-restoration-v1` resumes unfinished steps for the surviving user after refresh; explicit skip clears each step. Cloud XP uses MAX per skill, practice sessions and Song Studio projects are preserved, and local-only data is untouched. The secondary email and old password are not transferred automatically.

Signed-in live practice now saves locally first and syncs skill XP, structured practice history, portable practice preferences, and Song Studio project JSON through the existing owner-protected Supabase tables. Offline writes remain pending and retry on reconnect. Guest and demo progress remain local-only; the Account migration choice explicitly adopts guest data. Recordings, imported scores, and hardware settings remain local.

## Changed

- Transparent `ChatGPT Image Sep 30, 2026, 10_36_33 PM.png` from Downloads copied to `assets/rifftree-original.png` without modifying the original. `scripts/build-rifftree-assets.ps1` creates a full logo, wordmark, emblem, favicon, touch icon, and 192/512/maskable PWA icons.
- `public/index.html`, `manifest.webmanifest`, `service-worker.js`, `style.css`, and relevant UI modules use RiffTree branding. Palette: cream sidebar, neutral charcoal practice surfaces, forest-green actions and progression paths, warm-gold XP/mastery accents.
- `public/icons/` contains local Google, Facebook, and email marks used by sign-in, sign-in methods, and merge controls. Tests and documentation cover the new brand and PWA assets.

## Compatibility and remaining work

- Existing `irig-*` localStorage/IndexedDB/auth keys, practice-bundle format, Supabase migration/function names, and service-worker cache namespace remain unchanged to preserve profiles, projects, and deployed integrations. Only the cache version advances. The repo name remains `irig-trainer`.
- Account merging still applies only to cloud table data; guest progress and recordings stay local unless guest progress is explicitly adopted into a signed-in account. Physical iRig hardware validation remains future work. Do not claim Apple login is supported.
- The sync migration is applied to the linked Supabase project. Owner-only RLS, Node tests, Playwright tests, offline precache, and post-migration Supabase advisors were checked before publishing.
