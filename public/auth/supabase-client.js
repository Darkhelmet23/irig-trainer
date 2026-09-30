export function validatePublicConfig(raw) {
  if (!raw?.configured) return null;
  const key = typeof raw.anonKey === "string" ? raw.anonKey.trim() : "";
  let url;
  try { url = new URL(raw.url); } catch { throw new Error("Account configuration is invalid."); }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      url.username || url.password || url.search || url.hash)
    throw new Error("Account configuration is invalid.");
  let publicKey = key.startsWith("sb_publishable_") && key.length > 20;
  if (!publicKey && key.split(".").length === 3) {
    try {
      const payload = key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      publicKey = JSON.parse(atob(payload)).role === "anon";
    } catch {}
  }
  if (!publicKey) throw new Error("A public Supabase key is required.");
  return { url: url.toString().replace(/\/+$/, ""), anonKey: key };
}

export async function loadSupabaseClient({
  fetchConfig = globalThis.fetch,
  importSdk = () => import("../vendor/supabase-sdk.js"),
} = {}) {
  const response = await fetchConfig("/api/auth-config", { cache: "no-store" });
  if (!response.ok) throw new Error("Account service is unavailable.");
  const config = validatePublicConfig(await response.json());
  if (!config) return null;
  const { createClient } = await importSdk();
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storageKey: "irig-supabase-auth",
    },
  });
}
