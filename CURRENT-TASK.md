# Current task: Google/Facebook identity linking

Checkout: `C:\Users\nrobe\irig-trainer`, branch `main`. The verified Facebook redirect fix is its own commit, `04c36d4f6ef483896f919cd2ff37808e7e2de55f`.

## Changes in this pass

- Current sign-in methods: email/password, Google, Facebook, and local guest mode. Apple is intentionally deferred.
- `public/auth/auth-service.js` owns OAuth sign-in, linked-identity reads, link/unlink safety, and safe identity-conflict errors. `public/auth/account-ui.js` shows connection status and controls.
- Identity linking does not sync, merge, or move local progress. The existing Facebook-only test user must remain untouched.

## Validation

- Validation: `npm test` passed 62/62; `npx playwright test test/browser/account.spec.js` passed 6/6; `git diff --check` passed.

## Remaining

- Manual linking requires **Authentication → Settings → General → Allow manual linking** in the hosted Supabase Dashboard. `supabase/config.toml` still has manual linking disabled locally; no production configuration was changed here.
- A provider identity already owned by another Supabase user cannot be linked automatically. Duplicate-account/data merging remains deferred.
- Physical Windows/iRig and representative score-file validation remain open from `HARDWARE-VALIDATION.md`.
- Future work: secure opt-in cloud sync with conflict handling, optional recording backup, and Tauri deep-link handling.
