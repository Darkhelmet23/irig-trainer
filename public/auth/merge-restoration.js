export const MERGE_RESTORATION_KEY = "irig-merge-restoration-v1";
const oauth = ["google", "facebook"];

export function createMergeRestorationStore(storage = globalThis.localStorage) {
  function read(userId) {
    if (!userId) return null;
    try {
      const value = JSON.parse(storage.getItem(MERGE_RESTORATION_KEY));
      if (value?.version !== 1 || value.primaryId !== userId || value.dataMerged !== true ||
          !Array.isArray(value.providers) || value.providers.some((item) => !oauth.includes(item)) ||
          typeof value.emailRequired !== "boolean" ||
          typeof value.emailConfirmationPending !== "boolean" ||
          (value.email !== null && typeof value.email !== "string")) return null;
      return value;
    } catch { return null; }
  }
  function write(primaryId, result) {
    if (!primaryId || result?.status !== "merged") return null;
    const providers = [...new Set((result.providersToLink || []).filter((item) => oauth.includes(item)))];
    const emailRequired = result.emailSetupRequired === true;
    if (!providers.length && !emailRequired) return null;
    const value = { version: 1, primaryId, providers, emailRequired,
      email: emailRequired && typeof result.secondaryEmail === "string" ? result.secondaryEmail : null,
      emailConfirmationPending: false,
      dataMerged: true, timestamp: Date.now() };
    storage.setItem(MERGE_RESTORATION_KEY, JSON.stringify(value));
    return value;
  }
  function finish(userId, method) {
    const value = read(userId);
    if (!value) return null;
    if (method === "email") value.emailRequired = false;
    else value.providers = value.providers.filter((provider) => provider !== method);
    if (!value.providers.length && !value.emailRequired) {
      storage.removeItem(MERGE_RESTORATION_KEY);
      return null;
    }
    storage.setItem(MERGE_RESTORATION_KEY, JSON.stringify(value));
    return value;
  }
  function emailConfirmation(userId, email) {
    const value = read(userId);
    if (!value?.emailRequired) return null;
    value.email = email;
    value.emailConfirmationPending = true;
    storage.setItem(MERGE_RESTORATION_KEY, JSON.stringify(value));
    return value;
  }
  return { read, write, finish, emailConfirmation };
}
