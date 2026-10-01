import test from "node:test";
import assert from "node:assert/strict";
import { createStorage } from "../public/storage.js";
import { createProfileStore } from "../public/profile-store.js";
import { createSettingsRepository, createMigrationRepository } from "../public/data/local-repositories.js";
import { sanitizeProfile } from "../public/engine.js";
import { createCloudSync, cloudPracticeSettings, mergeSessions, stableSessionId,
  mergeLiveProfile, projectWinner, CLOUD_SYNC_KEY } from "../public/data/cloud-sync.js";
import { createCloudRepositories } from "../public/data/cloud-repositories.js";

const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";
const clone = (value) => structuredClone(value);
function fixture() {
  const values = new Map([["irig-mode", JSON.stringify("live")]]);
  const raw = { getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const local = createStorage({ storage: raw });
  let service, currentUser = null, online = true, fail = false;
  const profileStore = createProfileStore({ ...local, sanitizeProfile,
    onPersist: (id, profile) => service?.queueProfile(id, profile) });
  const settingsRepository = createSettingsRepository({ storage: local,
    onPracticeSave: (id) => service?.queueSettings(id) });
  const migrationRepository = createMigrationRepository({ storage: local });
  const scopes = new Map([["guest", new Map()]]);
  let scope = "guest";
  const projects = () => { if (!scopes.has(scope)) scopes.set(scope, new Map()); return scopes.get(scope); };
  const songStorage = {
    setAccount: (id) => { scope = id || "guest"; },
    async listProjects() { return [...projects().values()].map(clone); },
    async loadProject(id) { return clone(projects().get(id) || null); },
    async saveProject(item) { projects().set(item.id, clone(item)); service?.queueProject(scope === "guest" ? null : scope, item); },
    async adoptGuestProjects() { for (const item of scopes.get("guest").values())
      if (!projects().has(item.id)) await this.saveProject(item); },
  };
  const remote = new Map();
  const calls = [];
  function cloud(id) {
    if (!remote.has(id)) remote.set(id, { profile: null, skills: [], sessions: [], settings: null, projects: [] });
    return remote.get(id);
  }
  const repositories = (_client, id) => {
    const state = cloud(id);
    const call = (type, value) => { calls.push({ id, type, value }); if (fail) throw Error("network"); };
    return {
      async read() { call("read"); return clone(state); },
      async profile(value) { call("profile", value);
        state.profile = { profile_json: { ...value, xp: Math.max(value.xp, state.profile?.profile_json?.xp || 0) } };
        return clone(state.profile.profile_json); },
      async skill(skillId, xp) { call("skill", [skillId, xp]);
        const row = state.skills.find((item) => item.skill_id === skillId);
        if (row) row.xp = Math.max(row.xp, xp); else state.skills.push({ skill_id: skillId, xp });
        return row?.xp ?? xp; },
      async session(item) { call("session", item.id);
        if (!state.sessions.some((row) => row.id === item.id)) state.sessions.push({
          id: item.id, session_json: clone(item), lesson_id: item.lessonId,
          accuracy: item.accuracy, created_at: new Date(item.at).toISOString() }); },
      async settings(value, updatedAt) { call("settings", value);
        state.settings = { settings_json: { practice: clone(value) }, updated_at: updatedAt };
        return clone(state.settings.settings_json); },
      async project(item) { call("project", item.id);
        const copy = { ...clone(item), recordings: [] };
        const index = state.projects.findIndex((row) => row.id === item.id);
        if (index < 0) state.projects.push({ id: item.id, project_json: copy });
        else if (Date.parse(copy.modifiedAt) > Date.parse(state.projects[index].project_json.modifiedAt))
          state.projects[index] = { id: item.id, project_json: copy };
        return clone(state.projects.find((row) => row.id === item.id).project_json); },
    };
  };
  const auth = { getSession: () => ({ user: currentUser ? { id: currentUser } : null }),
    getClient: async () => ({}) };
  function makeService(extra = {}) {
    service = createCloudSync({ auth, profileStore, settingsRepository, songStorage,
      migrationRepository, storage: raw, repositories, isOnline: () => online,
      setTimer: () => 1, clearTimer: () => {}, ...extra });
    return service;
  }
  makeService();
  return { raw, values, local, profileStore, settingsRepository, migrationRepository,
    songStorage, remote, cloud, calls, repositories, get service() { return service; }, makeService,
    setUser: async (id) => { currentUser = id; await service.setUser(id); },
    setOnline: (value) => { online = value; }, setFail: (value) => { fail = value; } };
}

test("signed-in live progress syncs while guest and demo writes stay local", async () => {
  const f = fixture();
  const guest = f.profileStore.profile;
  guest.skillXP["fundamentals-strings"] = 60;
  f.profileStore.persist("live", guest);
  assert.equal(f.calls.length, 0);
  await f.setUser(userA);
  await f.service.sync();
  assert.equal(f.cloud(userA).skills.length, 0);
  const account = f.profileStore.profile;
  account.skillXP["fundamentals-strings"] = 80;
  account.history.unshift({ id: "run-one", title: "Strings", rank: "Bronze",
    lessonId: "fundamentals-strings", accuracy: 90, at: Date.now() });
  f.profileStore.persist("live", account);
  await f.service.sync();
  await f.service.sync();
  assert.equal(f.cloud(userA).skills[0].xp, 80);
  assert.equal(f.cloud(userA).sessions.length, 1);
  assert.equal(f.cloud(userA).sessions[0].session_json.accuracy, 90);
  assert.equal(f.cloud(userA).sessions[0].lesson_id, "fundamentals-strings");
  f.profileStore.persist("demo", { ...account, skillXP: { "fundamentals-strings": 900 } });
  await f.service.sync();
  assert.equal(f.cloud(userA).skills[0].xp, 80);
});

test("reconciliation uses MAX skill XP and unions sessions without duplication", async () => {
  const f = fixture();
  f.cloud(userA).skills = [{ skill_id: "fundamentals-strings", xp: 500 }];
  f.cloud(userA).sessions = [{ id: "cloud-run", session_json: { id: "cloud-run", title: "Cloud",
    rank: "Gold", accuracy: 95, at: Date.now() }, lesson_id: "cloud", accuracy: 95,
    created_at: new Date().toISOString() }];
  await f.setUser(userA);
  await f.service.sync();
  assert.equal(f.profileStore.profile.skillXP["fundamentals-strings"], 500);
  const local = f.profileStore.profile;
  local.skillXP["fundamentals-strings"] = 250;
  local.history.unshift({ id: "local-run", title: "Local", rank: "Bronze",
    accuracy: 70, at: Date.now() });
  f.profileStore.persist("live", local);
  await f.service.sync();
  assert.equal(f.cloud(userA).skills[0].xp, 500);
  assert.equal(f.profileStore.profile.skillXP["fundamentals-strings"], 500);
  assert.deepEqual(new Set(f.cloud(userA).sessions.map((item) => item.id)), new Set(["cloud-run", "local-run"]));
  assert.equal(mergeSessions(f.profileStore.profile.history, f.cloud(userA).sessions).length, 2);
});

test("legacy session IDs remain stable when history order changes", () => {
  const item = { title: "Scale", rank: "Gold", accuracy: 94, at: 1760000000000 };
  assert.equal(stableSessionId(item, 0), stableSessionId(item, 25));
});

test("network loss and reload keep pending work, then reconnect retries", async () => {
  const f = fixture();
  await f.setUser(userA); await f.service.sync();
  f.setFail(true); f.setOnline(false);
  const profile = f.profileStore.profile;
  profile.skillXP["fundamentals-strings"] = 75;
  f.profileStore.persist("live", profile);
  await f.service.sync();
  assert.equal(f.service.status, "offline");
  assert.ok(JSON.parse(f.values.get(CLOUD_SYNC_KEY))[userA].pending.skills["fundamentals-strings"]);
  assert.doesNotMatch(f.values.get(CLOUD_SYNC_KEY), /access_token|refresh_token|password|service_role/i);
  f.makeService();
  await f.setUser(userA);
  f.setFail(false); f.setOnline(true);
  await f.service.sync();
  assert.equal(f.cloud(userA).skills[0].xp, 75);
  assert.equal(f.service.status, "saved");
});

test("account switching isolates cloud-associated progress and sign-out stops writes", async () => {
  const f = fixture();
  await f.setUser(userA); await f.service.sync();
  const first = f.profileStore.profile;
  first.skillXP["fundamentals-strings"] = 200;
  f.profileStore.persist("live", first);
  await f.service.sync();
  await f.setUser(userB); await f.service.sync();
  assert.equal(f.profileStore.profile.skillXP["fundamentals-strings"] || 0, 0);
  const second = f.profileStore.profile;
  second.skillXP["fundamentals-strings"] = 30;
  f.profileStore.persist("live", second);
  await f.service.sync();
  assert.equal(f.cloud(userA).skills[0].xp, 200);
  assert.equal(f.cloud(userB).skills[0].xp, 30);
  await f.setUser(null);
  const before = f.calls.length;
  f.profileStore.persist("live", f.profileStore.profile);
  await f.service.sync();
  assert.equal(f.calls.length, before);
});

test("rapid account switches leave the project cache on the latest user", async () => {
  const f = fixture();
  let releaseA;
  const gate = new Promise((resolve) => { releaseA = resolve; });
  const scopes = [];
  f.makeService({ switchProjectScope: async (id) => {
    if (id === userA) await gate;
    f.songStorage.setAccount(id);
    scopes.push(id);
  } });
  const first = f.setUser(userA);
  const second = f.setUser(userB);
  releaseA();
  await Promise.all([first, second]);
  assert.deepEqual(scopes, [userA, userB]);
  await f.songStorage.saveProject({ id: "b-only", modifiedAt: "2026-10-01T00:00:00Z" });
  await f.service.sync();
  assert.equal(f.cloud(userA).projects.length, 0);
  assert.equal(f.cloud(userB).projects.length, 1);
});

test("a practice award during an in-flight profile write is not rolled back", async () => {
  const f = fixture();
  await f.setUser(userA); await f.service.sync();
  let releaseWrite, started, hold = false;
  const gate = new Promise((resolve) => { releaseWrite = resolve; });
  const writing = new Promise((resolve) => { started = resolve; });
  f.makeService({ repositories: (client, id) => {
    const repo = f.repositories(client, id);
    return { ...repo, async profile(value) { if (hold) { started(); await gate; } return repo.profile(value); } };
  } });
  await f.setUser(userA); await f.service.sync();
  hold = true;
  const profile = f.profileStore.profile;
  profile.xp = 50;
  f.profileStore.persist("live", profile);
  const first = f.service.sync();
  await writing;
  const later = f.profileStore.profile;
  later.xp = 75;
  f.profileStore.persist("live", later);
  releaseWrite();
  await first;
  assert.equal(f.profileStore.profile.xp, 75);
  await f.service.sync();
  assert.equal(f.cloud(userA).profile.profile_json.xp, 75);
});

test("explicit first-account adoption merges guest data without erasing cloud data", async () => {
  const f = fixture();
  const guest = f.profileStore.profile;
  guest.skillXP["fundamentals-strings"] = 120;
  guest.history = [{ id: "guest-run", title: "Guest", rank: "Bronze", accuracy: 80, at: Date.now() }];
  f.profileStore.persist("live", guest);
  await f.songStorage.saveProject({ id: "guest-song", modifiedAt: "2026-10-01T00:00:00Z",
    sections: [], arrangement: [], recordings: [] });
  f.cloud(userA).skills = [{ skill_id: "fundamentals-strings", xp: 500 }];
  await f.setUser(userA); await f.service.sync();
  f.migrationRepository.set(userA, "pending-sync");
  await f.service.adoptGuest(); await f.service.sync();
  assert.equal(f.profileStore.profile.skillXP["fundamentals-strings"], 500);
  assert.equal(f.cloud(userA).skills[0].xp, 500);
  assert.equal(f.cloud(userA).sessions[0].id, "guest-run");
  assert.equal(f.cloud(userA).projects[0].id, "guest-song");
  assert.equal(f.profileStore.loadGuest().skillXP["fundamentals-strings"], 120);
});

test("a saved guest-adoption choice resumes after sign-in or reload", async () => {
  const f = fixture();
  const guest = f.profileStore.profile;
  guest.skillXP["fundamentals-strings"] = 120;
  f.profileStore.persist("live", guest);
  f.migrationRepository.set(userA, "pending-sync");
  await f.setUser(userA);
  await f.service.sync();
  assert.equal(f.cloud(userA).skills[0].xp, 120);
  assert.equal(JSON.parse(f.values.get(CLOUD_SYNC_KEY))[userA].adopted, true);
});

test("projects use newest edit, retain different IDs, and exclude recording blobs", async () => {
  const f = fixture();
  const older = "2026-09-30T00:00:00.000Z", newer = "2026-10-01T00:00:00.000Z";
  assert.equal(projectWinner({ id: "same", modifiedAt: newer }, { id: "same", modifiedAt: older }).modifiedAt, newer);
  assert.deepEqual(projectWinner({ id: "same", modifiedAt: older, recordings: [{ id: "take" }] },
    { id: "same", modifiedAt: newer }).recordings, [{ id: "take" }]);
  await f.setUser(userA); await f.service.sync();
  await f.songStorage.saveProject({ id: "song-a", modifiedAt: newer,
    sections: [], arrangement: [], recordings: [{ id: "take", blob: "LOCAL" }] });
  await f.songStorage.saveProject({ id: "song-b", modifiedAt: newer,
    sections: [], arrangement: [], recordings: [] });
  await f.service.sync();
  assert.equal(f.cloud(userA).projects.length, 2);
  assert.deepEqual(f.cloud(userA).projects[0].project_json.recordings, []);
  assert.equal((await f.songStorage.loadProject("song-a")).recordings[0].blob, "LOCAL");
});

test("initial project reconciliation keeps newer cloud JSON and local audio references", async () => {
  const f = fixture();
  const old = "2026-09-30T00:00:00.000Z", newer = "2026-10-01T00:00:00.000Z";
  await f.songStorage.saveProject({ id: "same", title: "Older", modifiedAt: old,
    sections: [], arrangement: [], recordings: [{ id: "local-take" }] });
  f.cloud(userA).projects = [
    { id: "same", project_json: { id: "same", title: "Newer", modifiedAt: newer,
      sections: [], arrangement: [], recordings: [] } },
    { id: "different", project_json: { id: "different", title: "Other", modifiedAt: newer,
      sections: [], arrangement: [], recordings: [] } },
  ];
  f.migrationRepository.set(userA, "pending-sync");
  await f.setUser(userA);
  await f.service.adoptGuest();
  await f.service.sync();
  assert.equal((await f.songStorage.loadProject("same")).title, "Newer");
  assert.deepEqual((await f.songStorage.loadProject("same")).recordings, [{ id: "local-take" }]);
  assert.equal((await f.songStorage.loadProject("different")).title, "Other");
});

test("only portable practice settings are sent online; imported scores are untouched", () => {
  assert.deepEqual(cloudPracticeSettings({ countInBars: 2, record: true,
    deviceId: "mic", offset: 90, gate: 0.3, accuracyMode: "notes" }),
  { countInBars: 2, accuracyMode: "notes" });
  const local = sanitizeProfile({ version: 3, xp: 20, sessions: 1, skillXP: {},
    history: [{ id: "run", title: "Song", rank: "Gold", accuracy: 90 }] });
  assert.equal(mergeLiveProfile(local, { profile_json: { xp: 10 } }, [], []).xp, 20);
});

test("cloud project payload excludes current and saved-version recording references", async () => {
  let submitted;
  const repo = createCloudRepositories({ async rpc(_name, args) {
    submitted = args.p_project;
    return { data: submitted, error: null };
  } }, userA);
  await repo.project({ id: "song", modifiedAt: "2026-10-01T00:00:00Z",
    recordings: [{ id: "take" }], versions: [{ snapshot: { recordings: [{ id: "old-take" }] } }] });
  assert.deepEqual(submitted.recordings, []);
  assert.deepEqual(submitted.versions[0].snapshot.recordings, []);
});
