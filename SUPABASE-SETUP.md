# Optional accounts and proposed cloud schema

Accounts are optional. The trainer reads and writes practice data locally even when signed in. This version does **not** upload or download local practice data. A separate, explicit account-merge flow can merge records already present in the five Supabase application tables; it does not touch localStorage, IndexedDB, or recordings. The account dialog's local-progress migration choice records intent for a later sync release only.

## Local configuration

1. Create a Supabase project. Run `npm ci` to build the browser bundle of the official Supabase JavaScript client.
2. Copy `.env.example` to an untracked `.env`. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the project URL and **publishable/anon** browser key. Never use a service-role key. Restart `npm start`.
3. Add `http://localhost:3210/` to Supabase Auth redirect allowlist. Include every actual development/production origin and path. The app redirects back to its current origin and path, without the hash route.
4. Verify email sign-up, verification links, sign-in, password recovery, and sign-out using a test account. Configure the Auth email sender/templates and rate limits for production.

The local server exposes only the public URL/key at `/api/auth-config` and sends `Cache-Control: no-store`. If either is absent or invalid, it responds `{"configured":false}`. The app stays usable as a guest. OAuth credentials and any service-role key belong in Supabase/provider dashboards, never this browser app or Git.

## Provider dashboards

- **Google:** Configure Google's OAuth consent screen and client ID/secret; enable Google in Supabase Auth. Set the authorized callback to `https://<project-ref>.supabase.co/auth/v1/callback` and allow the app return URL in Supabase.
- **Facebook:** Configure a Meta developer app, Facebook Login callback, app domain, and client ID/secret; enable Facebook in Supabase Auth. Production login may require Meta app review.
- **Email:** Enable email/password in Supabase Auth, configure confirmation and recovery emails, and allow the app redirect URL. The app never stores passwords itself.

Apple authentication is intentionally deferred because it requires the paid Apple Developer Program. It is not offered by the current app.

Provider buttons are wired through `public/auth/auth-service.js`, but real OAuth login cannot work until those external dashboards are configured. Use HTTPS for deployed origins. Browser auth uses Supabase PKCE/session persistence; never log tokens or authorization codes. Facebook's normal sign-in uses the Supabase Auth Site URL instead of an explicit `redirectTo`; Google retains its app redirect.

### Manual sign-in-method linking

In the Supabase Dashboard, open **Authentication → Settings → General** and enable **Allow manual linking**. This is disabled by default in the generated `supabase/config.toml`; changing that local file does not enable the hosted project's dashboard setting. A signed-in player can then use **Account → Sign-in methods** to connect Google or Facebook to the current Supabase user. The app reads linked identities with `getUserIdentities()`, starts OAuth linking with `linkIdentity({ provider })`, and only allows `unlinkIdentity(identity)` when another supported sign-in method remains. Do not turn on Supabase anonymous sign-ins for guest mode.

An OAuth provider with a different email may create a separate Supabase user if used for normal sign-in instead of Connect. If an identity already belongs to another user, the app reports the conflict. **Merge another account** is the explicit way to combine its cloud application data into the currently signed-in account after proving both sessions; linking remains separate from cloud sync. Local XP, recordings, Song Studio data, and imported songs are not moved or uploaded.

### Merge deployment and security

Apply `20261001032929_merge_accounts.sql` and deploy the `merge-accounts` Edge Function to the same linked project. Keep JWT verification enabled. The function uses Supabase's server-only `SUPABASE_SERVICE_ROLE_KEY`; never put that key in `.env` for the browser app, public files, or Git. For a deployed web origin, configure `IRIG_ALLOWED_ORIGINS` as a comma-separated list of exact HTTPS origins in the Edge Function's secrets. Local `http://localhost:3210` and `http://127.0.0.1:3210` are allowed by default. If testing on another port, add its exact origin. Set the Supabase Auth **Site URL** to the app's root (for local testing, `http://localhost:3210/`) and allow that URL in **Authentication → URL Configuration → Redirect URLs**. Secondary Google/Facebook sign-in uses a popup and the Site URL without an explicit `redirectTo`; `/merge-auth.html` receives the popup callback before the primary app starts. Provider dashboards still use the normal Supabase `/auth/v1/callback` URL. Popups must be allowed for the app.

The Edge Function verifies the primary Bearer token and a separate secondary token through Supabase Auth on both preview and merge. The browser cannot supply account IDs. The restricted SQL RPC aborts before moving data if the secondary user owns Supabase Storage objects. In one transaction it keeps the highest XP per skill (never sums XP), preserves both histories and both project sets with deterministic IDs on differing collisions, fills only blank primary display names, and prefers primary settings. An operation marker makes retries idempotent. Only after the transaction commits does the function use the supported Admin API to delete the secondary Auth user. If deletion fails, the copied data remains and the function returns `data_merged_auth_cleanup_pending`; sign into the secondary account again and retry. Do not delete that Auth user manually until the data status has been checked. OAuth identities are not transferred: after success, use **Sign-in methods → Connect** for a missing Google or Facebook identity. A second email/password credential and a duplicate identity from the same provider cannot be retained; the primary account's method wins. No real account is merged by deploying the migration or function.

## Repository schema for a later sync phase

The root `supabase/` directory is the CLI project. For the Supabase GitHub integration, enter `.` as the working directory when this repository is selected. The initial migration in `supabase/migrations/` defines five private tables and their ownership policies. It does not make the browser app upload data; local progress and recordings remain on the device. Review the GitHub integration's deployment settings before pushing migrations, because an enabled deployment can apply them to the linked database.

The migration uses `auth.users(id)` as the owner; Auth stores passwords. Practice-session and Song Studio project IDs are scoped by `(user_id, id)`, so existing local IDs can later be reused safely for each account. `revision` and `updated_at` are present for future conflict handling; no sync protocol is implemented yet.

| Table | Suggested columns |
| --- | --- |
| `profiles` | `user_id` primary key, `display_name`, `created_at`, `updated_at` |
| `skill_progress` | `(user_id, skill_id)` primary key, `xp`, `revision`, `updated_at` |
| `practice_sessions` | `(user_id, id)` primary key, `lesson_id`, `accuracy`, `bpm`, `speed`, `created_at` |
| `user_settings` | `user_id` primary key, `settings_json`, `updated_at` |
| `song_projects` | `(user_id, id)` primary key, `project_json`, `revision`, `updated_at` |

The migration enables Row Level Security on **each** private table and creates separate SELECT, INSERT, UPDATE, and DELETE policies scoped to `auth.uid() = user_id`, with `WITH CHECK (auth.uid() = user_id)` for INSERT and UPDATE. For example:

```sql
alter table public.song_projects enable row level security;
create policy "read own songs" on public.song_projects
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own songs" on public.song_projects
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own songs" on public.song_projects
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "delete own songs" on public.song_projects
  for delete to authenticated using ((select auth.uid()) = user_id);
```

The migration applies that ownership rule to all five tables, grants access only to authenticated users, and adds indexes for owner-scoped history/project queries. Test cross-user reads/writes before shipping sync. The public client key does **not** replace RLS. A future sync layer should require an explicit migration decision, upload only after a verified authenticated session, support conflicts and offline retries, and keep the local copy until confirmed. `pending-sync` currently means only that the player asked to be considered for that future flow.

Do not store audio blobs in Postgres. Optional recording backup can later use Supabase Storage with private buckets, ownership policies, quotas, and an explicit opt-in. This release keeps recordings local only.

## Future desktop packaging

`auth-service.js` is independent of the UI redirect mechanism except for an injected `redirectUrl` function. A future Windows/macOS Tauri build must choose and allowlist a secure app/deep-link redirect, handle the callback in the desktop shell, and use appropriate protected session storage. Do not reuse localhost browser redirect assumptions or add Tauri before that work is designed and tested.
