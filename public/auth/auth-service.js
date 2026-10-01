import { loadSupabaseClient } from "./supabase-client.js";

const PROVIDERS = new Set(["google", "facebook"]);
const ACCOUNT_PROVIDERS = new Set(["google", "facebook", "email"]);
const GUEST = Object.freeze({ status: "guest", user: null });

function identityError(error, provider) {
  if (error?.code === "identity_already_exists")
    return new Error(`This ${provider === "facebook" ? "Facebook" : "Google"} account is already connected to another iRig Trainer account.`);
  if (error?.code === "manual_linking_disabled")
    return new Error("Account linking is not enabled in Supabase Auth settings yet.");
  return error;
}

export function authCallbackMessage(locationRef = globalThis.location) {
  const search = new URLSearchParams(locationRef?.search || "");
  const hash = String(locationRef?.hash || "");
  const code = search.get("error_code") ||
    (hash.startsWith("#error=") ? new URLSearchParams(hash.slice(1)).get("error_code") : null);
  if (code === "identity_already_exists")
    return "That sign-in account is already connected to another iRig Trainer account.";
  if (code === "manual_linking_disabled")
    return "Account linking is not enabled in Supabase Auth settings yet.";
  return "";
}

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
  let linkedIdentities = [];
  const callbackError = authCallbackMessage();
  const listeners = new Set();
  const snapshot = () => ({
    status: account.status,
    user: account.user ? { ...account.user, providers: [...account.user.providers] } : null,
    availability,
    recovery,
    callbackError,
  });
  function notify(event) {
    for (const listener of listeners) listener(snapshot(), event);
  }
  function applySession(session, event) {
    const previousId = account.user?.id;
    account = normalizeAccount(session);
    if (account.user?.id !== previousId) linkedIdentities = [];
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
      ...(provider === "facebook" ? {} : { options: { redirectTo: redirectUrl() } }),
    });
    if (error) throw error;
  }
  async function authenticatedClient() {
    const sdk = await requireClient();
    if (!account.user?.id) throw new Error("Sign in before changing sign-in methods.");
    return sdk;
  }
  async function getSignInMethods() {
    const sdk = await authenticatedClient();
    const userId = account.user.id;
    const { data, error } = await sdk.auth.getUserIdentities();
    if (error) throw error;
    if (account.user?.id !== userId) throw new Error("Your account changed. Open sign-in methods again.");
    if (!Array.isArray(data?.identities)) throw new Error("Sign-in methods are unavailable right now.");
    linkedIdentities = data.identities.filter((identity) =>
      identity && ACCOUNT_PROVIDERS.has(identity.provider));
    return Object.fromEntries([...ACCOUNT_PROVIDERS].map((provider) =>
      [provider, linkedIdentities.some((identity) => identity.provider === provider)]));
  }
  async function linkIdentity(provider) {
    if (!PROVIDERS.has(provider)) throw new Error("Choose a supported sign-in provider.");
    const sdk = await authenticatedClient();
    const methods = await getSignInMethods();
    if (methods[provider]) throw new Error("That sign-in method is already connected.");
    const { error } = await sdk.auth.linkIdentity({ provider });
    if (error) throw identityError(error, provider);
  }
  async function unlinkIdentity(provider) {
    if (!PROVIDERS.has(provider)) throw new Error("Choose a supported sign-in provider.");
    const sdk = await authenticatedClient();
    await getSignInMethods();
    const identity = linkedIdentities.find((entry) => entry.provider === provider);
    if (!identity) throw new Error("That sign-in method is not connected.");
    if (new Set(linkedIdentities.map((entry) => entry.provider)).size < 2)
      throw new Error("Keep at least one other sign-in method connected.");
    const { error } = await sdk.auth.unlinkIdentity(identity);
    if (error) throw error;
    return getSignInMethods();
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
  async function getAccessToken() {
    const sdk = await authenticatedClient();
    const expectedId = account.user.id;
    const { data, error } = await sdk.auth.getSession();
    if (error || !data?.session?.access_token || data.session.user?.id !== expectedId)
      throw new Error("Your account session changed. Sign in again before merging.");
    return data.session.access_token;
  }
  return {
    initialize,
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot(), "CURRENT");
      return () => listeners.delete(listener);
    },
    getSession: snapshot,
    getAccessToken,
    signInWithProvider,
    signInWithGoogle: () => signInWithProvider("google"),
    signInWithFacebook: () => signInWithProvider("facebook"),
    getSignInMethods,
    linkIdentity,
    unlinkIdentity,
    signInWithEmail,
    signUpWithEmail,
    forgotPassword,
    updatePassword,
    signOut,
    dispose() { subscription?.unsubscribe?.(); listeners.clear(); },
  };
}
