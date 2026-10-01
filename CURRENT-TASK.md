# Current task: cloud account merge

Branch: `main`. Supported sign-in methods: email/password, Google, Facebook, and local guest mode. Apple is deferred. Normal Facebook sign-in still omits `redirectTo`.

## Changed

- `supabase/migrations/20261001032929_merge_accounts.sql`: restricted preview and transactional merge RPCs, Storage preflight, idempotency marker. XP uses `MAX` per skill; history and projects use deterministic collision IDs; primary profile/settings win.
- `supabase/functions/merge-accounts/`: verifies both Auth sessions, returns a sanitized preview, moves cloud app data, then deletes the secondary Auth user. Auth cleanup failure is recoverable.
- `public/auth/merge-client.js`, `merge-popup.js`, `public/merge-auth.html`: isolated secondary email or popup OAuth sign-in. Account UI requires preview and explicit confirmation, then offers missing OAuth methods for relinking.
- `public/index.html`, `app.js`, `service-worker.js`, `style.css`, auth service and account UI: route popup callbacks before primary startup and include merge assets offline. Local progress and Song Studio storage are untouched.

## Validation and remaining

- `npm ci`, 74 Node tests, and 32 Playwright tests passed; the account subset passed again after UI cleanup. The SQL migration was first checked inside `BEGIN`/`ROLLBACK`, then applied to linked project `xqgkjxacbvppusrmpmmb`. Function `merge-accounts` is active with JWT verification. `anon` and `authenticated` cannot execute the merge RPC; `service_role` can. A token-free POST returned 401, and the localhost CORS preflight returned 204.
- No real account merge was invoked. Commit/push, then manually test the main email/Google and secondary Facebook test accounts. Physical iRig validation and cloud sync remain future work.
