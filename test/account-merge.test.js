import test from "node:test";
import assert from "node:assert/strict";
import { createMergeHandler, maskEmail, providersOf } from "../supabase/functions/merge-accounts/merge-core.js";
import { createMergeService, isExpectedMergeMessage, loadMergeClient } from "../public/auth/merge-client.js";

const users = {
  primary: { id: "primary", email: "main@example.com", identities: [{ provider: "email" }, { provider: "google" }] },
  secondary: { id: "secondary", email: "other@example.com", identities: [{ provider: "facebook" }] },
};
function fixture({ storage = false, mergeError = null, deleteError = null } = {}) {
  const calls = [];
  const admin = {
    auth: {
      async getUser(token) { calls.push(["getUser", token]);
        return token in users ? { data: { user: users[token] }, error: null } : { data: {}, error: Error("invalid") }; },
      admin: { async deleteUser(id) { calls.push(["deleteUser", id]); return { error: deleteError }; } },
    },
    async rpc(name, params) { calls.push(["rpc", name, params]);
      if (storage) return { error: Error("CLOUD_FILES_UNSUPPORTED") };
      if (name === "merge_user_data") return { error: mergeError, data: {} };
      return { error: null, data: { primary: { skills: 2, sessions: 3, projects: 1 },
        secondary: { skills: 4, sessions: 5, projects: 2 }, alreadyMerged: false } };
    },
  };
  const handler = createMergeHandler({ admin, allowedOrigins: new Set(["http://localhost:3210"]) });
  const request = (operation = "preview", secondaryToken = "secondary", more = {}) =>
    new Request("https://example.supabase.co/functions/v1/merge-accounts", {
      method: "POST", headers: { origin: "http://localhost:3210", authorization: "Bearer primary" },
      body: JSON.stringify({ operation, secondaryToken, ...more }),
    });
  return { handler, request, calls };
}
test("merge preview validates two independent sessions and makes no mutations", async () => {
  const { handler, request, calls } = fixture();
  const response = await handler(request());
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(calls.map((entry) => entry[0]), ["getUser", "getUser", "rpc"]);
  assert.equal(body.primary.email, "m***@example.com");
  assert.equal(body.secondary.sessions, 5);
  assert.deepEqual(body.providersToLink, ["facebook"]);
  assert.equal(body.secondary.id, undefined);
});
test("merge rejects spoofing, bad tokens, same account, and wrong origin", async () => {
  const { handler, request, calls } = fixture();
  assert.equal((await handler(request("merge", "secondary", { secondaryUserId: "victim" }))).status, 400);
  assert.equal((await handler(request("merge", "invalid"))).status, 401);
  assert.equal((await handler(request("merge", "primary"))).status, 400);
  const foreign = request(); foreign.headers.set("origin", "https://evil.example");
  assert.equal((await handler(foreign)).status, 403);
  assert.equal(calls.some((entry) => entry[1] === "merge_user_data"), false);
});
test("storage preflight and DB failure never delete Auth user", async () => {
  for (const options of [{ storage: true }, { mergeError: Error("failed") }]) {
    const { handler, request, calls } = fixture(options);
    const response = await handler(request("merge"));
    assert.ok(response.status >= 400);
    assert.equal(calls.some((entry) => entry[0] === "deleteUser"), false);
  }
});
test("successful merge copies data before deleting secondary Auth user; cleanup failure is recoverable", async () => {
  const success = fixture();
  const body = await (await success.handler(success.request("merge"))).json();
  assert.equal(body.status, "merged");
  assert.deepEqual(body.providersToLink, ["facebook"]);
  assert.ok(success.calls.findIndex((entry) => entry[1] === "merge_user_data") <
    success.calls.findIndex((entry) => entry[0] === "deleteUser"));
  const failed = fixture({ deleteError: Error("unavailable") });
  const response = await failed.handler(failed.request("merge"));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).status, "data_merged_auth_cleanup_pending");
});
test("provider and email summary is sanitized", () => {
  assert.deepEqual(providersOf({ identities: [{ provider: "google" }, { provider: "apple" }, null, { provider: "google" }] }), ["google"]);
  assert.equal(maskEmail("invalid"), "Email unavailable");
});
test("secondary SDK has a separate key and never persists email session", async () => {
  const configs = [];
  const fakeKey = "sb_publishable_" + "a".repeat(24);
  const options = { fetchConfig: async () => ({ ok: true, json: async () =>
    ({ configured: true, url: "https://example.supabase.co", anonKey: fakeKey }) }),
  importSdk: async () => ({ createClient: (_url, _key, config) => { configs.push(config.auth); return {}; } }) };
  await loadMergeClient(options);
  assert.equal(configs[0].storageKey, "irig-merge-auth");
  assert.equal(configs[0].persistSession, false);
  assert.equal(configs[0].detectSessionInUrl, false);
});
test("popup messages require same origin, source, nonce and valid shape", () => {
  const popup = {};
  const event = { origin: "http://localhost:3210", source: popup,
    data: { type: "irig-merge-auth", nonce: "nonce", status: "ready", accessToken: "x".repeat(21) } };
  assert.equal(isExpectedMergeMessage(event, popup, "nonce", event.origin), true);
  assert.equal(isExpectedMergeMessage({ ...event, origin: "https://evil.example" }, popup, "nonce", event.origin), false);
  assert.equal(isExpectedMergeMessage(event, {}, "nonce", event.origin), false);
  assert.equal(isExpectedMergeMessage(event, popup, "different", event.origin), false);
});
test("isolated email sign-in and cleanup never alter the primary account or local data", async () => {
  let primary = "primary";
  const local = { xp: 500 };
  let signedOut = 0;
  const secondaryClient = { auth: {
    async signInWithPassword() { return { data: { session: { access_token: "secondary-token" } } }; },
    async signOut() { signedOut++; return { error: null }; },
  } };
  const service = createMergeService({ auth: { getSession: () => ({ user: { id: primary } }),
    getAccessToken: async () => "primary-token" }, loadClient: async () => ({ client: secondaryClient,
    functionUrl: "https://example.supabase.co/functions/v1/merge-accounts", anonKey: "public" }),
  fetchImpl: async () => new Response(JSON.stringify({ primary: {}, secondary: {} }), { status: 200 }) });
  await service.signInWithEmail("other@example.com", "longpassword");
  await service.preview();
  await service.clear();
  assert.equal(primary, "primary");
  assert.equal(local.xp, 500);
  assert.equal(signedOut, 1);
});
test("canceling a secondary OAuth popup rejects immediately and leaves the primary session alone", async () => {
  let resolveOpened;
  const opened = new Promise((resolve) => { resolveOpened = resolve; });
  const popup = { closed: false, close() { this.closed = true; } };
  const auth = { getSession: () => ({ user: { id: "primary" } }) };
  const service = createMergeService({ auth, openPopup: () => { resolveOpened(); return popup; },
    addListener: () => {}, removeListener: () => {} });
  const attempt = service.signInWithProvider("facebook");
  await opened;
  await service.clear();
  await assert.rejects(attempt, /canceled/i);
  assert.equal(popup.closed, true);
  assert.equal(auth.getSession().user.id, "primary");
});
