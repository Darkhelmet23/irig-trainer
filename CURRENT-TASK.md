# Current task: RiffTree public rebrand

Branch: `main`. Public name: **RiffTree**. GitHub repository: `Darkhelmet23/irig-trainer` (unchanged). Apple authentication remains deferred; supported methods are email/password, Google, Facebook, and local guest mode.

Account merge now has a post-deletion restoration stage: missing Google/Facebook providers use manual linking, and an OAuth primary can set a new password for its primary email. `irig-merge-restoration-v1` resumes unfinished steps for the surviving user after refresh; explicit skip clears each step. Cloud XP uses MAX per skill, practice sessions and Song Studio projects are preserved, and local-only data is untouched. The secondary email and old password are not transferred automatically.

## Changed

- Transparent `ChatGPT Image Sep 30, 2026, 10_36_33 PM.png` from Downloads copied to `assets/rifftree-original.png` without modifying the original. `scripts/build-rifftree-assets.ps1` creates a full logo, wordmark, emblem, favicon, touch icon, and 192/512/maskable PWA icons.
- `public/index.html`, `manifest.webmanifest`, `service-worker.js`, `style.css`, and relevant UI modules use RiffTree branding. Palette: cream sidebar, neutral charcoal practice surfaces, forest-green actions and progression paths, warm-gold XP/mastery accents.
- `public/icons/` contains local Google, Facebook, and email marks used by sign-in, sign-in methods, and merge controls. Tests and documentation cover the new brand and PWA assets.

## Compatibility and remaining work

- Existing `irig-*` localStorage/IndexedDB/auth keys, practice-bundle format, Supabase migration/function names, and service-worker cache namespace remain unchanged to preserve profiles, projects, and deployed integrations. Only the cache version advances. The repo name remains `irig-trainer`.
- Account merging still applies only to cloud table data; local progress and recordings stay local. Physical iRig hardware validation and cloud sync remain future work. Do not claim Apple login is supported.
- `npm ci`, all 78 Node tests, and all 32 Playwright tests passed. The new PNG icon path is served as `image/png`; offline precache passed. Desktop/mobile screenshots show a fitted wordmark and emblem-only mobile header. The startup-splash browser test now waits deterministically for app startup. Run `git diff --check`, then commit and push `main`.
