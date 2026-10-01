import { createCloudRepositories } from "./cloud-repositories.js";
import { sanitizeProfile } from "../engine.js";

export const CLOUD_SYNC_KEY = "irig-cloud-sync-v1";
const practiceFields = ["countInBars", "songCountInBars", "metronome", "subdivision", "accent", "accuracyMode"];
const emptyPending = () => ({ profile: 0, settings: 0, skills: {}, sessions: {}, projects: {} });
const stamp = () => new Date().toISOString();
const validId = (id) => typeof id === "string" && id.length > 0 && id.length <= 120;
const hasPending = (p) => !!(p.profile || p.settings || Object.keys(p.skills).length ||
  Object.keys(p.sessions).length || Object.keys(p.projects).length);

export function cloudPracticeSettings(value) {
  return Object.fromEntries(practiceFields.filter((key) => value?.[key] !== undefined)
    .map((key) => [key, value[key]]));
}
export function stableSessionId(item, index = 0) {
  if (validId(item.id)) return item.id;
  const source = JSON.stringify([item.at || 0, item.lessonId || "", item.title || "",
    item.rank || "", item.accuracy || 0, item.bpm || 0, item.speed || 1,
    item.hits || 0, item.total || 0, item.durationMs || 0]);
  let hash = 14695981039346656037n;
  for (const char of source) hash = BigInt.asUintN(64, (hash ^ BigInt(char.charCodeAt(0))) * 1099511628211n);
  return `legacy-${hash.toString(16)}-${Math.max(0, Number(item.at) || 0)}`.slice(0, 120);
}
export function mergeSessions(local, cloudRows) {
  const byId = new Map();
  for (const [index, item] of (local || []).entries()) {
    const id = stableSessionId(item, index);
    byId.set(id, { ...item, id });
  }
  for (const row of cloudRows || []) {
    if (!validId(row.id) || byId.has(row.id)) continue;
    const saved = row.session_json;
    byId.set(row.id, saved?.title && saved?.rank ? { ...saved, id: row.id } : {
      id: row.id, title: row.lesson_id || "Practice", lessonId: row.lesson_id || "",
      rank: "Practice", accuracy: Number(row.accuracy) || 0,
      at: Date.parse(row.created_at) || 0, bpm: Number(row.bpm) || 0,
      speed: Number(row.speed) || 1,
    });
  }
  return [...byId.values()].sort((a, b) => (b.at || 0) - (a.at || 0));
}
export function mergeLiveProfile(local, cloudProfile, cloudSkills, cloudSessions) {
  const remote = cloudProfile?.profile_json || {};
  const mergedSkills = { ...(local?.skillXP || {}) };
  for (const row of cloudSkills || [])
    if (validId(row.skill_id)) mergedSkills[row.skill_id] = Math.max(
      Number(mergedSkills[row.skill_id]) || 0, Number(row.xp) || 0);
  const history = mergeSessions(local?.history, cloudSessions);
  return sanitizeProfile({ ...local, version: 3,
    xp: Math.max(Number(local?.xp) || 0, Number(remote.xp) || 0),
    sessions: Math.max(Number(local?.sessions) || 0, Number(remote.sessions) || 0, history.length),
    skills: Object.fromEntries([...new Set([...Object.keys(local?.skills || {}), ...Object.keys(remote.skills || {})])]
      .map((id) => [id, Math.max(Number(local?.skills?.[id]) || 0, Number(remote.skills?.[id]) || 0)])),
    skillXP: mergedSkills,
    masteryChallenges: Object.fromEntries([...new Set([
      ...Object.keys(local?.masteryChallenges || {}), ...Object.keys(remote.masteryChallenges || {}),
    ])].filter((id) => local?.masteryChallenges?.[id] === true ||
      remote.masteryChallenges?.[id] === true).map((id) => [id, true])),
    history: history.slice(0, 200),
  });
}
export function projectWinner(local, cloud) {
  if (!local) return { ...cloud, recordings: [] };
  if (!cloud) return local;
  const localTime = Date.parse(local.modifiedAt || "") || 0;
  const cloudTime = Date.parse(cloud.modifiedAt || "") || 0;
  return cloudTime > localTime ? { ...cloud, recordings: local.recordings || [] } : local;
}

export function createCloudSync({ auth, profileStore, settingsRepository, songStorage,
  migrationRepository, storage = globalThis.localStorage, onAccountChange = () => {},
  switchProjectScope = async (id) => songStorage.setAccount?.(id),
  onStatus = () => {}, isOnline = () => globalThis.navigator?.onLine !== false,
  repositories = createCloudRepositories, setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout } = {}) {
  let userId = null, generation = 0, timer = null, running = null, status = "local", needsRefresh = true, retryDelay = 1000;
  let scopeSwitch = Promise.resolve();
  const readAll = () => { try { return JSON.parse(storage.getItem(CLOUD_SYNC_KEY)) || {}; } catch { return {}; } };
  const readMeta = (id) => ({ initialComplete: false, adopted: false, settingsAt: "1970-01-01T00:00:00.000Z",
    sequence: 0, pending: emptyPending(), ...(readAll()[id] || {}) });
  const saveMeta = (id, value) => {
    try { storage.setItem(CLOUD_SYNC_KEY, JSON.stringify({ ...readAll(), [id]: value })); }
    catch { setStatus("attention"); }
  };
  const archiveKey = (id) => `irig-cloud-sessions-v1:${id}`;
  const readArchive = (id) => { try { return JSON.parse(storage.getItem(archiveKey(id))) || []; } catch { return []; } };
  const saveArchive = (id, value) => {
    try { storage.setItem(archiveKey(id), JSON.stringify(value)); }
    catch { setStatus("attention"); }
  };
  const current = (id, token = generation) => id && id === userId && token === generation &&
    auth.getSession().user?.id === id;
  function setStatus(value) { if (status !== value) { status = value; onStatus(value); } }
  function queue(type, id, recordId) {
    if (!current(id)) return;
    const meta = readMeta(id), seq = ++meta.sequence;
    if (type === "profile" || type === "settings") meta.pending[type] = seq;
    else if (validId(recordId)) meta.pending[type][recordId] = seq;
    if (type === "settings") meta.settingsAt = stamp();
    saveMeta(id, meta);
    setStatus(isOnline() ? "syncing" : "offline");
    schedule();
  }
  function queueProfile(id, value) {
    if (!current(id)) return;
    queue("profile", id);
    for (const [skillId, xp] of Object.entries(value.skillXP || {}))
      if (Number(xp) > 0) queue("skills", id, skillId);
    const archive = new Map(readArchive(id).map((item) => [item.id, item]));
    for (const [index, item] of (value.history || []).entries()) {
      const id = stableSessionId(item, index);
      archive.set(id, { ...item, id });
    }
    saveArchive(id, [...archive.values()]);
    for (const [index, item] of (value.history || []).entries())
      queue("sessions", id, stableSessionId(item, index));
  }
  function schedule(delay = 500) {
    if (!userId || timer) return;
    timer = setTimer(() => { timer = null; void sync(); }, delay);
  }
  function clearPending(id, type, recordId, sequence) {
    const meta = readMeta(id);
    if (recordId) {
      if (meta.pending[type][recordId] === sequence) delete meta.pending[type][recordId];
    } else if (meta.pending[type] === sequence) meta.pending[type] = 0;
    saveMeta(id, meta);
  }
  async function reconcile(id, repo, token) {
    const cloud = await repo.read();
    if (!current(id, token)) return false;
    const local = profileStore.loadSaved("live") || sanitizeProfile(null);
    const merged = mergeLiveProfile(local, cloud.profile, cloud.skills, cloud.sessions);
    const latest = profileStore.loadSaved("live") || sanitizeProfile(null);
    const safeMerged = mergeLiveProfile(latest, { profile_json: merged },
      Object.entries(merged.skillXP || {}).map(([skill_id, xp]) => ({ skill_id, xp })),
      merged.history.map((item) => ({ id: item.id, session_json: item })));
    profileStore.replaceLive(safeMerged);
    onAccountChange(id);
    queueProfile(id, safeMerged);
    const localSettings = settingsRepository.loadPractice();
    const cloudSettings = cloud.settings?.settings_json?.practice || {};
    const localAt = Date.parse(readMeta(id).settingsAt) || 0;
    const cloudAt = Date.parse(cloud.settings?.updated_at || "") || 0;
    const prefs = localAt > cloudAt ? localSettings : { ...localSettings, ...cloudSettings };
    settingsRepository.replacePractice(prefs);
    onAccountChange(id);
    if (Object.keys(cloudPracticeSettings(prefs)).length) queue("settings", id);
    const localProjects = await songStorage.listProjects();
    if (!current(id, token)) return false;
    const projects = new Map(localProjects.map((item) => [item.id, item]));
    for (const row of cloud.projects) {
      const currentProject = await songStorage.loadProject(row.id);
      if (!current(id, token)) return false;
      const winner = projectWinner(currentProject, row.project_json);
      if (winner && winner !== currentProject) await songStorage.saveProject(winner);
      if (winner) projects.set(row.id, winner);
    }
    for (const item of projects.values()) queue("projects", id, item.id);
    return true;
  }
  async function flush(id, repo, token) {
    const pending = readMeta(id).pending;
    const live = profileStore.loadSaved("live") || sanitizeProfile(null);
    const sessions = new Map(readArchive(id).map((item, index) => [stableSessionId(item, index), item]));
    if (pending.profile && current(id, token)) {
      const remote = await repo.profile({ xp: live.xp, sessions: live.sessions,
        skills: live.skills, masteryChallenges: live.masteryChallenges });
      if (!current(id, token)) return;
      profileStore.replaceLive(mergeLiveProfile(profileStore.loadSaved("live") || live,
        { profile_json: remote }, [], []));
      clearPending(id, "profile", null, pending.profile);
    }
    for (const [skillId, seq] of Object.entries(pending.skills)) {
      if (!current(id, token)) return;
      const before = profileStore.loadSaved("live") || live;
      const value = await repo.skill(skillId, Math.max(0, Number(before.skillXP[skillId]) || 0));
      if (!current(id, token)) return;
      const latest = profileStore.loadSaved("live") || live;
      if (Number(value) > (Number(latest.skillXP[skillId]) || 0)) {
        latest.skillXP[skillId] = Number(value);
        profileStore.replaceLive(sanitizeProfile(latest)); onAccountChange(id);
      }
      clearPending(id, "skills", skillId, seq);
    }
    for (const [sessionId, seq] of Object.entries(pending.sessions)) {
      if (!current(id, token)) return;
      const item = sessions.get(sessionId);
      if (item) await repo.session({ ...item, id: sessionId });
      if (!current(id, token)) return;
      clearPending(id, "sessions", sessionId, seq);
      saveArchive(id, readArchive(id).filter((entry) => entry.id !== sessionId));
    }
    if (pending.settings && current(id, token)) {
      const remote = await repo.settings(cloudPracticeSettings(settingsRepository.loadPractice()), readMeta(id).settingsAt);
      if (!current(id, token)) return;
      if (remote?.practice && readMeta(id).pending.settings === pending.settings)
        settingsRepository.replacePractice({ ...settingsRepository.loadPractice(), ...remote.practice });
      clearPending(id, "settings", null, pending.settings);
      onAccountChange(id);
    }
    for (const [projectId, seq] of Object.entries(pending.projects)) {
      if (!current(id, token)) return;
      const item = await songStorage.loadProject(projectId);
      if (item) {
        const remote = await repo.project(item);
        if (!current(id, token)) return;
        const latest = await songStorage.loadProject(projectId);
        const winner = projectWinner(latest, remote);
        if (winner !== latest) await songStorage.saveProject(winner);
      }
      if (!current(id, token)) return;
      clearPending(id, "projects", projectId, seq);
    }
  }
  async function sync() {
    if (running) return running;
    const id = userId, token = generation;
    if (!current(id, token)) return;
    if (!isOnline()) { setStatus("offline"); return; }
    setStatus("syncing");
    running = (async () => {
      try {
        const client = await auth.getClient();
        if (!current(id, token)) return;
        const repo = repositories(client, id);
        const meta = readMeta(id);
        if (!meta.initialComplete || needsRefresh) {
          if (!await reconcile(id, repo, token)) return;
          needsRefresh = false;
        }
        await flush(id, repo, token);
        if (!current(id, token)) return;
        const next = readMeta(id);
        if (!next.initialComplete) { next.initialComplete = true; saveMeta(id, next); }
        retryDelay = 1000;
        setStatus(hasPending(next.pending) ? "syncing" : "saved");
      } catch {
        retryDelay = Math.min(retryDelay * 2, 60000);
        if (current(id, token)) setStatus(isOnline() ? "attention" : "offline");
      } finally {
        running = null;
        if (!current(id, token)) {
          if (current(userId)) schedule(0);
        } else if (isOnline() && (needsRefresh || hasPending(readMeta(id).pending))) schedule(retryDelay);
      }
    })();
    return running;
  }
  async function setUser(id) {
    if (id === userId) return;
    const token = ++generation;
    if (timer) { clearTimer(timer); timer = null; }
    userId = id || null;
    needsRefresh = true;
    profileStore.setAccount(userId);
    settingsRepository.setAccount(userId);
    const targetId = userId;
    scopeSwitch = scopeSwitch.catch(() => {}).then(() => switchProjectScope(targetId));
    await scopeSwitch;
    if (generation !== token) return;
    onAccountChange(userId);
    setStatus(userId ? (isOnline() ? "syncing" : "offline") : "local");
    if (userId) {
      await adoptGuest();
      schedule(0);
    }
  }
  async function adoptGuest() {
    const id = userId;
    const token = generation;
    if (!current(id, token) || migrationRepository.get(id)?.choice !== "pending-sync") return;
    const meta = readMeta(id);
    if (meta.adopted) return;
    const guest = profileStore.loadGuest() || sanitizeProfile(null);
    const merged = mergeLiveProfile(profileStore.loadSaved("live") || sanitizeProfile(null),
      { profile_json: guest }, Object.entries(guest.skillXP || {})
        .map(([skill_id, xp]) => ({ skill_id, xp })),
      (guest.history || []).map((item, index) => ({
        id: stableSessionId(item, index), session_json: item,
      })));
    profileStore.replaceLive(merged);
    settingsRepository.replacePractice({ ...settingsRepository.loadPractice(),
      ...settingsRepository.loadGuestPractice() });
    await songStorage.adoptGuestProjects?.();
    if (!current(id, token)) return;
    meta.adopted = true;
    saveMeta(id, meta);
    onAccountChange(id);
    queueProfile(id, merged);
    queue("settings", id);
    for (const item of await songStorage.listProjects()) queue("projects", id, item.id);
    schedule(0);
  }
  function refresh() { needsRefresh = true; schedule(0); }
  return { get status() { return status; }, setUser, sync, refresh, adoptGuest,
    queueProfile, queueSettings: (id) => queue("settings", id),
    queueProject: (id, item) => queue("projects", id, item.id),
    dispose() { if (timer) clearTimer(timer); generation++; } };
}
