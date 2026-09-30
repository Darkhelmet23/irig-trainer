import { loadSupabaseClient } from "./supabase-client.js";

const PROVIDERS = new Set(["apple", "google", "facebook"]);
const ACCOUNT_PROVIDERS = new Set(["apple", "google", "facebook", "email"]);
const GUEST = Object.freeze({ status: "guest", user: null });

function cleanText(value, limit = 160) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, limit)
    : "";
}

export function normalizeAccount(session) {
  const raw = session?.user;
  const id = cleanText(raw?.id, 128);
  if (!id) return GUEST;
  const metadata = raw.user_metadata && typeof raw.user_metadata === "object" &&
    !Array.isArray(raw.user_metadata) ? raw.user_metadata : {};
  const appMetadata = raw.app_metadata && typeof raw.app_metadata === "object" &&
    !Array.isArray(raw.app_metadata) ? raw.app_metadata : {};
  const email = cleanText(raw.email, 254);
  const displayName = cleanText(
    metadata.display_name || metadata.full_name || metadata.name, 80,
  ) || "Guitar player";
  const names = [
    ...(Array.isArray(appMetadata.providers) ? appMetadata.providers : []),
    appMetadata.provider,
  ];
  const providers = [...new Set(names.filter((name) =>
    typeof name === "string" && ACCOUNT_PROVIDERS.has(name)))];
  let avatarUrl = null;
  try {
    const candidate = new URL(metadata.avatar_url);
    if (candidate.protocol === "https:" || candidate.protocol === "http:")
      avatarUrl = candidate.href.slice(0, 2048);
  } catch {}
  return {
    status: "authenticated",
    user: {
      id,
      email,
      displayName,
      avatarUrl,
      providers,
      emailVerified: !!raw.email_confirmed_at,
    },
  };
}

export function browserRedirectUrl(locationRef = globalThis.location) {
  if (!locationRef || !["http:", "https:"].includes(locationRef.protocol))
    throw new Error("Account redirects require a web address.");
  return locationRef.origin + locationRef.pathname;
}

export function createAuthService({
  loadClient = loadSupabaseClient,
  redirectUrl = browserRedirectUrl,
  isOnline = () => globalThis.navigator?.onLine !== false,
} = {}) {
  let account = GUEST;
  let availability = "checking";
  let recovery = false;
  let client = null;
  let initializing = null;
  let subscription = null;
  const listeners = new Set();
  const snapshot = () => ({
    status: account.status,
    user: account.user ? { ...account.user, providers: [...account.user.providers] } : null,
    availability,
    recovery,
  });
  function notify(event) {
    for (const listener of listeners) listener(snapshot(), event);
  }
  function applySession(session, event) {
    account = normalizeAccount(session);
    if (event === "PASSWORD_RECOVERY") recovery = true;
    if (event === "SIGNED_OUT") recovery = false;
    notify(event);
  }
  async function initialize() {
    if (initializing) return initializing;
    initializing = (async () => {
      try {
        client = await loadClient();
        if (!client) {
          availability = "unconfigured";
          notify("UNCONFIGURED");
          return snapshot();
        }
        availability = "ready";
        const observer = client.auth.onAuthStateChange((event, session) => {
          if (["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT",
            "TOKEN_REFRESHED", "PASSWORD_RECOVERY", "USER_UPDATED"].includes(event))
            applySession(session, event);
        });
        subscription = observer?.data?.subscription || null;
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        applySession(data?.session || null, "INITIAL_SESSION");
      } catch {
        subscription?.unsubscribe?.();
        subscription = null;
        client = null;
        account = GUEST;
        availability = isOnline() ? "unavailable" : "offline";
        notify("UNAVAILABLE");
      }
      return snapshot();
    })();
    return initializing;
  }
  async function requireClient() {
    await initialize();
    if (client) return client;
    if (availability === "offline")
      throw new Error("Offline — local progress is still available.");
    if (availability === "unconfigured")
      throw new Error("Account sign-in is not configured yet. Continue as a local player.");
    throw new Error("Account sign-in is unavailable. Local practice still works.");
  }
  function emailAddress(value) {
    const email = cleanText(value, 254);
    if (!email || !email.includes("@")) throw new Error("Enter a valid email address.");
    return email;
  }
  function passwordValue(value) {
    if (typeof value !== "string" || value.length < 8)
      throw new Error("Use a password with at least 8 characters.");
    return value;
  }
  async function signInWithProvider(provider) {
    if (!PROVIDERS.has(provider)) throw new Error("Choose a supported sign-in provider.");
    const sdk = await requireClient();
    const { error } = await sdk.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectUrl() },
    });
    if (error) throw error;
  }
  async function signInWithEmail(email, password) {
    const sdk = await requireClient();
    const result = await sdk.auth.signInWithPassword({
      email: emailAddress(email), password: passwordValue(password),
    });
    if (result.error) throw result.error;
    if (!result.data?.session)
      throw new Error("Sign-in did not finish. Check your email confirmation.");
    recovery = false;
    applySession(result.data.session, "SIGNED_IN");
    return snapshot();
  }
  async function signUpWithEmail(email, password) {
    const sdk = await requireClient();
    const result = await sdk.auth.signUp({
      email: emailAddress(email),
      password: passwordValue(password),
      options: { emailRedirectTo: redirectUrl() },
    });
    if (result.error) throw result.error;
    if (!result.data?.user && !result.data?.session)
      throw new Error("Account creation did not finish. Try again.");
    if (result.data?.session) applySession(result.data.session, "SIGNED_IN");
    return { needsEmailVerification: !result.data?.session };
  }
  async function forgotPassword(email) {
    const sdk = await requireClient();
    const { error } = await sdk.auth.resetPasswordForEmail(emailAddress(email), {
      redirectTo: redirectUrl(),
    });
    if (error) throw error;
  }
  async function updatePassword(password) {
    const sdk = await requireClient();
    const { error } = await sdk.auth.updateUser({ password: passwordValue(password) });
    if (error) throw error;
    recovery = false;
    notify("PASSWORD_UPDATED");
  }
  async function signOut() {
    if (client) {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw error;
    }
    applySession(null, "SIGNED_OUT");
  }
  return {
    initialize,
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot(), "CURRENT");
      return () => listeners.delete(listener);
    },
    getSession: snapshot,
    signInWithProvider,
    signInWithApple: () => signInWithProvider("apple"),
    signInWithGoogle: () => signInWithProvider("google"),
    signInWithFacebook: () => signInWithProvider("facebook"),
    signInWithEmail,
    signUpWithEmail,
    forgotPassword,
    updatePassword,
    signOut,
    dispose() { subscription?.unsubscribe?.(); listeners.clear(); },
  };
}
