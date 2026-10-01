import { validatePublicConfig } from "./supabase-client.js";

export async function loadMergeClient({ popup = false, fetchConfig = globalThis.fetch,
  importSdk = () => import("../vendor/supabase-sdk.js") } = {}) {
  const response = await fetchConfig("/api/auth-config", { cache: "no-store" });
  if (!response.ok) throw new Error("Account service is unavailable.");
  const config = validatePublicConfig(await response.json());
  if (!config) throw new Error("Account merging requires Supabase configuration.");
  const { createClient } = await importSdk();
  const client = createClient(config.url, config.anonKey, { auth: {
    storageKey: "irig-merge-auth", flowType: "pkce",
    storage: popup ? globalThis.sessionStorage : undefined,
    persistSession: popup, autoRefreshToken: false, detectSessionInUrl: popup,
  } });
  return { client, functionUrl: `${config.url}/functions/v1/merge-accounts`, anonKey: config.anonKey };
}

export function isExpectedMergeMessage(event, popup, nonce, origin) {
  const data = event?.data;
  return event?.origin === origin && event?.source === popup &&
    data && data.type === "irig-merge-auth" && data.nonce === nonce &&
    (data.status === "error" && typeof data.message === "string" ||
      data.status === "ready" && typeof data.accessToken === "string" && data.accessToken.length > 20);
}

export function createMergeService({ auth, loadClient = loadMergeClient,
  openPopup = (url) => window.open(url, "irig-merge-oauth", "popup,width=520,height=700"),
  origin = () => window.location.origin, addListener = (listener) => window.addEventListener("message", listener),
  removeListener = (listener) => window.removeEventListener("message", listener),
  fetchImpl = globalThis.fetch,
} = {}) {
  let secondary = null, emailClient = null, popup = null, activeListener = null, pendingCancel = null;
  async function clear() {
    const cancel = pendingCancel;
    pendingCancel = null;
    if (cancel) cancel();
    secondary = null;
    if (activeListener) { removeListener(activeListener); activeListener = null; }
    if (popup && !popup.closed) popup.close();
    popup = null;
    if (emailClient) {
      try { await emailClient.auth.signOut({ scope: "local" }); } catch {}
      emailClient = null;
    }
  }
  async function signInWithEmail(email, password) {
    await clear();
    if (!auth.getSession().user) throw new Error("Sign in to the account you want to keep first.");
    const { client } = await loadClient();
    emailClient = client;
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data?.session?.access_token) throw new Error("The other account could not be signed in.");
      secondary = data.session.access_token;
    } catch (error) { await clear(); throw error; }
  }
  async function signInWithProvider(provider) {
    if (!["google", "facebook"].includes(provider)) throw new Error("Choose Google or Facebook.");
    await clear();
    if (!auth.getSession().user) throw new Error("Sign in to the account you want to keep first.");
    const nonce = crypto.randomUUID();
    const url = `/merge-auth.html?provider=${encodeURIComponent(provider)}&nonce=${encodeURIComponent(nonce)}`;
    popup = openPopup(url);
    if (!popup) throw new Error("Allow the account sign-in popup and try again.");
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error("Other-account sign-in timed out.")), 120000);
      const closed = setInterval(() => {
        if (popup?.closed) finish(new Error("Other-account sign-in was canceled."));
      }, 500);
      async function finish(error, token) {
        pendingCancel = null;
        clearTimeout(timeout); clearInterval(closed);
        if (activeListener) { removeListener(activeListener); activeListener = null; }
        if (popup && !popup.closed) popup.close();
        popup = null;
        if (error) { await clear(); reject(error); }
        else { secondary = token; resolve(); }
      }
      activeListener = (event) => {
        if (!isExpectedMergeMessage(event, popup, nonce, origin())) return;
        if (event.data.status === "error") finish(new Error(event.data.message.slice(0, 200)));
        else finish(null, event.data.accessToken);
      };
      pendingCancel = () => finish(new Error("Other-account sign-in was canceled."));
      addListener(activeListener);
    });
  }
  async function request(operation) {
    if (!auth.getSession().user || !secondary) throw new Error("Sign in to both accounts before continuing.");
    const primary = await auth.getAccessToken();
    const { functionUrl, anonKey } = await loadClient();
    const response = await fetchImpl(functionUrl, {
      method: "POST", headers: { "content-type": "application/json",
        apikey: anonKey, authorization: `Bearer ${primary}` },
      body: JSON.stringify({ operation, secondaryToken: secondary }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || "Could not merge cloud accounts.");
      error.status = data.status;
      await clear();
      throw error;
    }
    if (operation === "merge") await clear();
    return data;
  }
  return { signInWithEmail, signInWithProvider, preview: () => request("preview"),
    merge: () => request("merge"), clear };
}
