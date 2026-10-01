# Optional accounts and cloud sync

The public app name is **RiffTree**; its GitHub repo and some internal `irig-*` storage/auth identifiers remain unchanged for compatibility. Existing Supabase project, tables, migrations, and the deployed `merge-accounts` function do not need renaming. Apple authentication is still deferred.

Accounts are optional. Guest and demo practice remain local-only. Signed-in live practice saves locally first, then syncs structured progress to Supabase; another device restores it on sign-in. Offline changes are queued locally and retried on reconnect or focus. Existing guest progress stays separate until **Sync local progress to my account** is chosen. That choice combines guest progress with the account's existing cloud copy; **Keep local progress separate** leaves guest data alone. Account merging remains a separate flow between two verified cloud accounts.

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

An OAuth provider with a different email may create a separate Supabase user if used for normal sign-in instead of Connect. If an identity already belongs to another user, the app reports the conflict. **Merge another account** is the explicit way to combine two cloud accounts after proving both sessions; linking remains separate from data merging. After a merge, normal sync downloads the surviving account's combined cloud data. Guest progress, recordings, and imported songs are not moved by account merging.

### Merge deployment and security

Apply `20261001032929_merge_accounts.sql` and deploy the `merge-accounts` Edge Function to the same linked project. Keep JWT verification enabled. The function uses Supabase's server-only `SUPABASE_SERVICE_ROLE_KEY`; never put that key in `.env` for the browser app, public files, or Git. For a deployed web origin, configure `IRIG_ALLOWED_ORIGINS` as a comma-separated list of exact HTTPS origins in the Edge Function's secrets. Local `http://localhost:3210` and `http://127.0.0.1:3210` are allowed by default. If testing on another port, add its exact origin. Set the Supabase Auth **Site URL** to the app's root (for local testing, `http://localhost:3210/`) and allow that URL in **Authentication → URL Configuration → Redirect URLs**. Secondary Google/Facebook sign-in uses a popup and the Site URL without an explicit `redirectTo`; `/merge-auth.html` receives the popup callback before the primary app starts. Provider dashboards still use the normal Supabase `/auth/v1/callback` URL. Popups must be allowed for the app.

The Edge Function verifies the primary Bearer token and a separate secondary token through Supabase Auth on both preview and merge. The browser cannot supply account IDs. The restricted SQL RPC aborts before moving data if the secondary user owns Supabase Storage objects. In one transaction it keeps the highest XP per skill (never sums XP), preserves both histories and both project sets with deterministic IDs on differing collisions, fills only blank primary display names, and prefers primary settings. The sync migration also preserves detailed practice-session JSON in that transaction. An operation marker makes retries idempotent. Only after the transaction commits does the function use the supported Admin API to delete the secondary Auth user. If deletion fails, the copied data remains and the function returns `data_merged_auth_cleanup_pending`; sign into the secondary account again and retry. Do not delete that Auth user manually until the data status has been checked. The function captures both users' provider lists before deletion and returns missing OAuth methods plus whether email setup is needed. After deletion, Account requires each missing Google/Facebook method to be linked with `linkIdentity()` and confirmed with `getUserIdentities()`, or explicitly skipped. Pending steps resume after refresh for the primary user through `irig-merge-restoration-v1`; it contains no tokens or passwords. If the primary account lacks email/password, Account offers `updateUser({ password })` to set a **new** password for the surviving primary email. If the primary has no email, Account requests `updateUser({ email })` and waits for email confirmation before offering password setup. The secondary password never transfers. If the emails differ, the primary email stays and the other email cannot be retained automatically. A duplicate identity from the same provider is not transferred. No real account is merged by deploying the migration or function.

## Cloud sync schema and rules

The root `supabase/` directory is the CLI project. For the Supabase GitHub integration, enter `.` as the working directory. The initial migration defines five private tables and ownership policies. `20261001164217_cloud_sync_schema.sql` adds `profiles.profile_json`, `practice_sessions.session_json`, and authenticated invoker-rights sync RPCs. The preceding `20261001164148_cloud_sync.sql` is a no-op history entry matching the linked project's migration history. No duplicate tables were added. Review the GitHub integration's deployment settings before pushing migrations, because enabled deployment can apply them to the linked database.

The schema uses `auth.users(id)` as owner; Auth stores passwords. Practice-session and Song Studio project IDs are scoped by `(user_id, id)`. Browser writes use the signed-in publishable-key client and current RLS policies. The sync RPCs verify the JWT owner against the requested user ID. `sync_skill_xp` applies `greatest(existing, incoming)` atomically; duplicate skill XP is never summed. Practice sessions use stable IDs and idempotent inserts. Project JSON uses the newer `modifiedAt`/`updated_at` version; differing IDs are retained. Portable practice settings use the newer timestamp and increment the existing revision. Live profile rank/challenge fields and total XP merge by maxima or boolean union. Detailed session history is stored in `session_json`; the on-screen profile retains its latest 200 entries.

| Table | Synced data |
| --- | --- |
| `profiles` | Live total XP, legacy ranks, challenge wins in `profile_json`; display name remains account-owned |
| `skill_progress` | `(user_id, skill_id)` primary key, `xp`, `revision`, `updated_at` |
| `practice_sessions` | Completed session summary and detailed `session_json`, keyed by `(user_id, id)` |
| `user_settings` | Portable practice preferences in `settings_json.practice`; revision and `updated_at` |
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

The migration applies that ownership rule to all five tables, grants access only to authenticated users, and adds indexes for owner-scoped history/project queries. The public client key does **not** replace RLS. First sync reads both local and cloud copies before writing; skill XP uses MAX, sessions and projects use union, and no empty cloud response deletes local data. `irig-cloud-sync-v1` stores per-user completion, pending entity IDs, and timestamps; `irig-cloud-sessions-v1:<user-id>` temporarily retains session details awaiting upload. Neither stores credentials. Account-scoped live profiles use `irig-cloud-live-v1:<user-id>` and portable preferences use `irig-cloud-practice-settings-v1:<user-id>`; guest `irig-live` remains separate. Song Studio project JSON is account-scoped in IndexedDB. Network failures retain the local data and retry later.

Do not store audio blobs in Postgres. Song Studio project JSON is uploaded with its `recordings` list removed; scratch audio and practice recordings remain local. Imported Guitar Pro/MusicXML files, audio device IDs, microphone selection, latency calibration, and permissions also remain local. Optional recording backup can later use Supabase Storage with private buckets, ownership policies, quotas, and an explicit opt-in.

## Future desktop packaging

`auth-service.js` is independent of the UI redirect mechanism except for an injected `redirectUrl` function. A future Windows/macOS Tauri build must choose and allowlist a secure app/deep-link redirect, handle the callback in the desktop shell, and use appropriate protected session storage. Do not reuse localhost browser redirect assumptions or add Tauri before that work is designed and tested.
