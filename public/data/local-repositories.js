import { createStorage } from "../storage.js";

// These methods keep the existing keys and record formats. Cloud sync can later
// read snapshots through the repositories without changing local ownership.
export function createSettingsRepository({ storage = createStorage() } = {}) {
  return {
    loadDevice: () => storage.read("irig-settings", {}),
    saveDevice: (value) => storage.save("irig-settings", value),
    loadPractice: () => storage.read("irig-practice-settings", {}),
    savePractice: (value) => storage.save("irig-practice-settings", value),
    loadOnboarding: () => storage.read("irig-onboarding-v1", null),
    saveOnboarding: (value) => storage.save("irig-onboarding-v1", value),
  };
}

export function createPracticeRepository({ storage = createStorage() } = {}) {
  return {
    loadPacks: () => storage.read("irig-packs", []),
    savePacks: (value) => storage.save("irig-packs", value),
    loadGoals: () => storage.read("irig-goals-v1", []),
    saveGoals: (value) => storage.save("irig-goals-v1", value),
    loadDailyPlan: () => storage.read("irig-daily-plan-v1", null),
    saveDailyPlan: (value) => storage.save("irig-daily-plan-v1", value),
    loadCheckpoints: () => storage.read("irig-checkpoints-v1", {}),
    saveCheckpoints: (value) => storage.save("irig-checkpoints-v1", value),
  };
}

const MIGRATION_KEY = "irig-account-migration-v1";
const MIGRATION_CHOICES = new Set(["pending-sync", "keep-local", "later"]);

export function createMigrationRepository({ storage = createStorage() } = {}) {
  return {
    get(userId) {
      if (typeof userId !== "string" || !userId) return null;
      const value = storage.read(MIGRATION_KEY, {});
      return MIGRATION_CHOICES.has(value?.[userId]?.choice)
        ? value[userId]
        : null;
    },
    set(userId, choice) {
      if (typeof userId !== "string" || !userId || !MIGRATION_CHOICES.has(choice))
        throw new Error("Choose a valid local progress option.");
      const all = storage.read(MIGRATION_KEY, {});
      const entry = { choice, updatedAt: new Date().toISOString() };
      storage.save(MIGRATION_KEY, { ...all, [userId]: entry });
      return entry;
    },
  };
}
