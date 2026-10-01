import { createMergeRestorationStore } from "./merge-restoration.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const providerIcon = (provider) => ["google", "facebook", "email"].includes(provider)
  ? `<img class="provider-icon" src="/icons/${provider}.svg" width="20" height="20" alt="" aria-hidden="true">`
  : "";

function signInMethodsMarkup(methods, methodsError, online) {
  const connectedCount = methods ? Object.values(methods).filter(Boolean).length : 0;
  const rows = [["email", "Email/password"], ["google", "Google"], ["facebook", "Facebook"]]
    .map(([provider, label]) => {
      const connected = !!methods?.[provider];
      const status = methods ? (connected ? "Connected" : "Not connected") :
        (methodsError ? "Unavailable" : "Checking...");
      const action = provider === "email" || !methods ? "" : connected
        ? `<button class="subtle-btn" type="button" data-account-unlink="${provider}"${connectedCount < 2 || !online ? " disabled" : ""}>Disconnect ${label}</button>`
        : `<button class="outline-btn" type="button" data-account-link="${provider}"${!online ? " disabled" : ""}>Connect ${label}</button>`;
      return `<div class="account-method"><div class="account-method-identity">${providerIcon(provider)}<span><strong>${label}</strong><span class="account-method-status${connected ? " is-connected" : ""}">${status}</span></span></div>${action}</div>`;
    }).join("");
  return '<section class="account-panel account-methods"><h3>Sign-in methods</h3>' +
    '<p>Connect another sign-in method to this account. Disconnect requires another connected method. This does not move or merge practice data.</p>' +
    '<div class="account-method-list">' + rows + '</div>' +
    (methodsError ? '<p class="account-note">Could not load sign-in methods. ' +
      '<button class="subtle-btn" type="button" data-account-action="retry-methods">Try again</button></p>' : '') +
    '</section>';
}

function mergeMarkup(merge, user, online, methods) {
  const identity = `<strong>${escapeHtml(user.email || user.displayName)}</strong>`;
  if (merge.step === "preview") {
    const data = merge.preview;
    const summary = (entry) => `<span>${Number(entry.skills) || 0} skills · ${Number(entry.sessions) || 0} practice sessions · ${Number(entry.projects) || 0} Song Studio projects</span>`;
    return `<section class="account-panel account-merge"><span class="eyebrow">REVIEW MERGE</span><h3>Keep this account</h3>` +
      `<p>${escapeHtml(data.primary.email)} · ${data.primary.providers.map(escapeHtml).join(", ") || "email"}</p>${summary(data.primary)}` +
      `<h3>Merge from the other account</h3><p>${escapeHtml(data.secondary.email)} · ${data.secondary.providers.map(escapeHtml).join(", ") || "email"}</p>${summary(data.secondary)}` +
      `<p>Your highest XP in each skill will be kept. Practice history and projects from both cloud accounts will be preserved. The other RiffTree account will be removed.</p>` +
      `<p class="account-note">Primary settings, profile, and email/password stay. Other OAuth methods must be connected again. Local device progress remains local until cloud sync exists.</p>` +
      `<div class="account-choice-list"><button type="button" class="primary" data-account-action="confirm-merge"${!online ? " disabled" : ""}>Merge accounts</button>` +
      `<button type="button" class="subtle-btn" data-account-action="cancel-merge">Cancel</button></div></section>`;
  }
  if (merge.step === "restore") {
    const pending = merge.pending;
    const rows = ["facebook", "google"].map((provider) => {
      const label = provider === "google" ? "Google" : "Facebook";
      const connected = !!methods?.[provider];
      return `<div class="account-method"><div class="account-method-identity">${providerIcon(provider)}<span><strong>${label}</strong><span class="account-method-status${connected ? " is-connected" : ""}">${connected ? "✓ Connected" : pending.providers.includes(provider) ? "○ Connect" : "Not connected"}</span></span></div>` +
        (pending.providers.includes(provider) ? `<button type="button" class="outline-btn" data-account-link="${provider}"${!online ? " disabled" : ""}>Connect ${label}</button><button type="button" class="subtle-btn" data-restore-skip="${provider}">Skip for now</button>` : "") + `</div>`;
    }).join("");
    const differentEmail = pending.email && user.email && pending.email.toLowerCase() !== user.email.toLowerCase();
    const emailForm = !user.email ?
      `<p>${pending.emailConfirmationPending ? "Email confirmation pending. Check your inbox, then return to Account after verifying the address." : "Add an email address and confirm it before setting a new password."}</p>` +
      `<form id="account-merge-email-setup"><label class="form-group"><span>Email address</span><input name="email" type="email" value="${escapeHtml(pending.email || "")}" required></label><button class="primary" type="submit"${!online ? " disabled" : ""}>${pending.emailConfirmationPending ? "Resend email change" : "Add email"}</button></form>` :
      !user.emailVerified ? `<p>Email confirmation pending for ${escapeHtml(user.email)}. Verify this address before setting a password.</p>` :
      `<form id="account-merge-password"><label class="form-group"><span>New password</span><input name="password" type="password" minlength="8" autocomplete="new-password" required></label><button class="primary" type="submit"${!online ? " disabled" : ""}>Set up email sign-in</button></form>`;
    const emailRow = pending.emailRequired ? `<div class="account-method"><div class="account-method-identity">${providerIcon("email")}<span><strong>Email/password</strong><span class="account-method-status">○ Set up</span></span></div></div>` +
      `<p>Your accounts are merged. Set a new password to continue using ${escapeHtml(user.email || "an email address")} to sign in. Your previous password does not carry over.</p>` +
      (differentEmail ? `<p class="account-note">The other account used ${escapeHtml(pending.email)}. Your primary email stays ${escapeHtml(user.email)}; the other email cannot be retained automatically.</p>` : "") +
      emailForm +
      `<button type="button" class="subtle-btn" data-restore-skip="email">Skip for now</button>` : "";
    return `<section class="account-panel account-merge"><span class="eyebrow">DATA MERGED</span><p>✓ Cloud progress combined</p><h3>SIGN-IN METHODS</h3><p>Your progress is merged. One final step: reconnect missing sign-in methods to your RiffTree account.</p><div class="account-method-list">${rows}${emailRow}</div>` +
      `<p class="account-note">Your progress is safe. You can reconnect Google or Facebook later from Account → Sign-in methods.</p></section>`;
  }
  if (merge.step === "done") {
    return `<section class="account-panel account-merge"><span class="eyebrow">ACCOUNTS MERGED</span><h3>Your RiffTree account is ready.</h3><p>Cloud progress is combined. Local device data has not changed.</p>` +
      `<button type="button" class="subtle-btn" data-account-action="cancel-merge">Done</button></section>`;
  }
  return `<section class="account-panel account-merge"><span class="eyebrow">MERGE ACCOUNTS</span><h3>You are keeping ${identity}</h3>` +
    `<p>Sign in to the other existing account. This keeps your current sign-in active. No data changes until you review and confirm.</p>` +
    `<div class="account-provider-list"><button type="button" class="outline-btn" data-merge-provider="google"${!online ? " disabled" : ""}>${providerIcon("google")}Other account: Google</button>` +
    `<button type="button" class="outline-btn" data-merge-provider="facebook"${!online ? " disabled" : ""}>${providerIcon("facebook")}Other account: Facebook</button></div>` +
    `<form id="account-merge-email"><label class="form-group"><span>Other account email</span><input name="email" type="email" autocomplete="off" required></label>` +
    `<label class="form-group"><span>Password</span><input name="password" type="password" autocomplete="off" required></label>` +
    `<button class="primary" type="submit"${!online ? " disabled" : ""}>Preview merge</button></form>` +
    `<button type="button" class="subtle-btn" data-account-action="cancel-merge">Cancel</button></section>`;
}

export function accountMarkup({
  state,
  message = "",
  view = "sign-in",
  migration = null,
  decision = null,
  showMigrationChoices = false,
  methods = null,
  methodsError = "",
  online = true,
  merge = null,
}) {
  const user = state.user;
  const unavailable = !online || state.availability === "offline"
    ? "Offline — local progress is still available."
    : state.availability === "unconfigured"
      ? "Account sign-in needs Supabase configuration. You can keep practicing locally."
      : state.availability === "unavailable"
        ? "Account sign-in is unavailable right now. Local practice still works."
        : "";
  const head = '<div class="account-head"><div><span class="eyebrow">YOUR SPACE</span>' +
    '<h2 id="account-title">Account</h2><p>Keep your guitar journey on this device. Sign in when you are ready.</p></div>' +
    '<button class="close-btn" type="button" data-account-action="close" aria-label="Close account">×</button></div>';
  let body;
  if (state.recovery && user) {
    body = '<section class="account-panel"><h3>Set a new password</h3>' +
      '<form id="account-new-password"><label class="form-group"><span>New password</span>' +
      '<input name="password" type="password" minlength="8" autocomplete="new-password" required></label>' +
      '<button class="primary" type="submit">Update password</button></form></section>';
  } else if (user) {
    body = '<section class="account-panel account-identity"><span class="eyebrow">SIGNED IN</span>' +
      '<h3>' + escapeHtml(user.displayName) + '</h3><p>' + escapeHtml(user.email) + '</p>' +
      (!user.emailVerified && user.providers.includes("email")
        ? '<p class="account-note">Check your inbox to verify your email address.</p>' : '') +
      '<button class="outline-btn" type="button" data-account-action="sign-out">Sign out</button></section>';
    body += signInMethodsMarkup(methods, methodsError, online);
    if (view === "merge") body += mergeMarkup(merge || { step: "sign-in" }, user, online, methods);
    else body += '<section class="account-panel account-merge"><h3>Merge another account</h3>' +
      '<p>Combine cloud progress from another RiffTree account with this one. This account will be kept.</p>' +
      '<button class="outline-btn" type="button" data-account-action="start-merge"' +
      (!online ? ' disabled' : '') + '>Merge another account</button></section>';
    if (migration?.found) {
      if (!decision || showMigrationChoices) {
        body += '<section class="account-panel account-migration"><span class="eyebrow">LOCAL PROGRESS</span>' +
          '<h3>We found practice progress on this device.</h3>' +
          '<p>Your XP, songs, and projects stay here while you decide how to handle future sync.</p>' +
          '<div class="account-choice-list">' +
          '<button type="button" class="outline-btn" data-migration="pending-sync">Sync local progress to my account</button>' +
          '<button type="button" class="outline-btn" data-migration="keep-local">Keep local progress separate</button>' +
          '<button type="button" class="subtle-btn" data-migration="later">Not now</button></div>' +
          '<p class="tiny muted">Sync is planned for a later release. Choosing it now will not upload or remove anything.</p></section>';
      } else {
        const choiceText = decision.choice === "pending-sync"
          ? "Ready for future sync. Nothing has been uploaded."
          : decision.choice === "keep-local"
            ? "Your local progress will stay separate."
            : "Your local progress is safe. You can decide later.";
        body += '<section class="account-panel account-migration"><h3>Local progress</h3><p>' +
          escapeHtml(choiceText) + '</p><button class="subtle-btn" type="button" data-account-action="review-migration">' +
          'Review options</button></section>';
      }
    }
  } else if (view === "forgot") {
    body = '<section class="account-panel"><h3>Reset your password</h3>' +
      '<p>Enter your email and we will send a reset link if an account exists.</p>' +
      '<form id="account-forgot"><label class="form-group"><span>Email</span>' +
      '<input name="email" type="email" autocomplete="email" required></label>' +
      '<button class="primary" type="submit">Send reset link</button></form>' +
      '<button class="subtle-btn" type="button" data-account-action="back">Back to sign in</button></section>';
  } else {
    body = '<section class="account-panel"><h3>Continue with an account</h3>' +
      '<div class="account-provider-list">' +
      `<button class="outline-btn" type="button" data-provider="google">${providerIcon("google")}Continue with Google</button>` +
      `<button class="outline-btn" type="button" data-provider="facebook">${providerIcon("facebook")}Continue with Facebook</button>` +
      '</div><div class="account-divider"><span>or use email</span></div>' +
      '<form id="account-email"><label class="form-group"><span>Email</span>' +
      '<input name="email" type="email" autocomplete="email" required></label>' +
      '<label class="form-group"><span>Password</span>' +
      '<input name="password" type="password" minlength="8" autocomplete="current-password" required></label>' +
      `<div class="account-form-actions"><button class="primary" type="submit" name="intent" value="sign-in">${providerIcon("email")}Sign in</button>` +
      `<button class="outline-btn" type="submit" name="intent" value="sign-up">${providerIcon("email")}Create account</button></div></form>` +
      '<button class="subtle-btn" type="button" data-account-action="forgot">Forgot password?</button></section>' +
      '<button class="account-guest" type="button" data-account-action="close">Continue without an account</button>';
  }
  return '<div class="account-shell">' + head +
    (unavailable ? '<p class="account-offline" role="status">' + escapeHtml(unavailable) + '</p>' : '') +
    body + '<p id="account-message" class="account-message" role="status" aria-live="polite">' +
    escapeHtml(message) + '</p></div>';
}

export function createAccountUI({
  auth,
  mergeService,
  migrationRepository,
  detectProgress,
  dialog = document.querySelector("#account-dialog"),
  openButton = document.querySelector("#account-open"),
  isOnline = () => navigator.onLine !== false,
  restorationStore = createMergeRestorationStore(),
}) {
  let message = "";
  let view = "sign-in";
  let migration = null;
  let decision = null;
  let migrationFor = null;
  let showMigrationChoices = false;
  let methods = null;
  let methodsError = "";
  let methodsFor = null;
  let methodsRequest = 0;
  let busy = false;
  let merge = { step: "sign-in" };
  function resumeRestoration() {
    const userId = auth.getSession().user?.id;
    const pending = restorationStore.read(userId);
    if (pending) { view = "merge"; merge = { step: "restore", primaryId: userId, pending }; }
  }
  const content = dialog.querySelector("#account-content");

  function render() {
    const state = auth.getSession();
    const name = state.user?.displayName || "Guest / Local player";
    openButton.querySelector("#account-status").textContent = name;
    openButton.setAttribute("aria-label", "Account: " + name);
    if (!dialog.open) return;
    content.innerHTML = accountMarkup({
      state, message, view, migration, decision, showMigrationChoices,
      methods: state.user?.id === methodsFor ? methods : null, methodsError,
      online: isOnline(),
      merge,
    });
  }
  async function refreshMigration() {
    const id = auth.getSession().user?.id;
    migrationFor = id || null;
    migration = null;
    decision = id ? migrationRepository.get(id) : null;
    showMigrationChoices = false;
    render();
    if (!id) return;
    try {
      const found = await detectProgress();
      if (auth.getSession().user?.id !== id) return;
      migration = found;
      render();
    } catch {
      // Storage errors must never block account controls or local practice.
    }
  }
  async function refreshMethods() {
    const request = ++methodsRequest;
    const id = auth.getSession().user?.id;
    methodsFor = id || null;
    methods = null;
    methodsError = "";
    render();
    if (!id) return;
    try {
      const found = await auth.getSignInMethods();
      if (request !== methodsRequest || auth.getSession().user?.id !== id) return;
      methods = found;
      if (merge.step === "restore" && merge.primaryId === id) {
        for (const provider of merge.pending.providers) {
          if (found[provider]) merge.pending = restorationStore.finish(id, provider);
        }
        if (!merge.pending) merge = { step: "done", primaryId: id };
      }
    } catch {
      if (request !== methodsRequest || auth.getSession().user?.id !== id) return;
      methodsError = "unavailable";
    }
    render();
    return methods;
  }
  function open() {
    resumeRestoration();
    if (!dialog.open) dialog.showModal();
    render();
    if (auth.getSession().user) void refreshMethods();
  }
  function close() {
    if (view === "merge" && !["done", "restore"].includes(merge.step)) void mergeService?.clear();
    view = "sign-in";
    merge = { step: "sign-in" };
    if (dialog.open) dialog.close();
    openButton.focus();
  }
  async function run(action) {
    if (busy) return;
    busy = true;
    message = "";
    try {
      await action();
    } catch (error) {
      message = error?.message || "Account action could not finish. Try again.";
      if (view === "merge" && merge.step === "preview")
        merge = { step: "sign-in", primaryId: auth.getSession().user?.id };
    } finally {
      busy = false;
      render();
    }
  }
  function bind() {
    openButton.addEventListener("click", open);
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
    dialog.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const provider = button.dataset.provider;
      if (provider) return void run(() => auth.signInWithProvider(provider));
      const mergeProvider = button.dataset.mergeProvider;
      if (mergeProvider) return void run(async () => {
        const primaryId = merge.primaryId;
        await mergeService.signInWithProvider(mergeProvider);
        if (auth.getSession().user?.id !== primaryId) throw new Error("The account you kept changed. Start again.");
        merge = { step: "preview", primaryId, preview: await mergeService.preview() };
      });
      const linkProvider = button.dataset.accountLink;
      if (linkProvider) return void run(async () => {
        await auth.linkIdentity(linkProvider);
        const updated = await refreshMethods();
        message = updated?.[linkProvider]
          ? `${linkProvider === "google" ? "Google" : "Facebook"} connected to this account.`
          : "Finish the provider sign-in to connect it to this account.";
      });
      const unlinkProvider = button.dataset.accountUnlink;
      if (unlinkProvider) return void run(async () => {
        await auth.unlinkIdentity(unlinkProvider);
        const updated = await refreshMethods();
        message = updated && !updated[unlinkProvider]
          ? `${unlinkProvider === "google" ? "Google" : "Facebook"} disconnected from this account.`
          : "Refresh sign-in methods to confirm the change.";
      });
      const skipMethod = button.dataset.restoreSkip;
      if (skipMethod) return void run(async () => {
        merge.pending = restorationStore.finish(auth.getSession().user?.id, skipMethod);
        if (!merge.pending) merge = { step: "done", primaryId: auth.getSession().user?.id };
        message = "Your progress is safe. You can reconnect Google or Facebook later from Account → Sign-in methods.";
      });
      const choice = button.dataset.migration;
      if (choice) {
        const id = auth.getSession().user?.id;
        if (!id) return;
        decision = migrationRepository.set(id, choice);
        showMigrationChoices = false;
        message = choice === "pending-sync"
          ? "Ready for future sync. No data was uploaded."
          : "Your local progress stays on this device.";
        return render();
      }
      switch (button.dataset.accountAction) {
        case "close": close(); break;
        case "forgot": view = "forgot"; message = ""; render(); break;
        case "back": view = "sign-in"; message = ""; render(); break;
        case "sign-out": void run(() => auth.signOut()); break;
        case "start-merge": view = "merge"; merge = { step: "sign-in", primaryId: auth.getSession().user?.id }; render(); break;
        case "cancel-merge": void mergeService?.clear(); view = "sign-in"; merge = { step: "sign-in" }; message = ""; render(); break;
        case "confirm-merge": void run(async () => {
          if (auth.getSession().user?.id !== merge.primaryId)
            throw new Error("The account you kept changed. Start again.");
          const result = await mergeService.merge();
          const pending = restorationStore.write(merge.primaryId, result);
          merge = pending ? { step: "restore", primaryId: merge.primaryId, pending } : { step: "done", result };
          await refreshMethods();
        }); break;
        case "retry-methods": void refreshMethods(); break;
        case "review-migration": showMigrationChoices = true; render(); break;
      }
    });
    dialog.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.target;
      if (form.id === "account-email") {
        const email = form.elements.email.value;
        const password = form.elements.password.value;
        const intent = event.submitter?.value || "sign-in";
        if (intent === "sign-up")
          void run(async () => {
            const result = await auth.signUpWithEmail(email, password);
            message = result.needsEmailVerification
              ? "Check your email to verify your account before signing in."
              : "Account created.";
          });
        else void run(() => auth.signInWithEmail(email, password));
      } else if (form.id === "account-merge-email") {
        void run(async () => {
          const primaryId = merge.primaryId;
          await mergeService.signInWithEmail(form.elements.email.value, form.elements.password.value);
          if (auth.getSession().user?.id !== primaryId) throw new Error("The account you kept changed. Start again.");
          merge = { step: "preview", primaryId, preview: await mergeService.preview() };
        });
      } else if (form.id === "account-forgot") {
        const email = form.elements.email.value;
        void run(async () => {
          await auth.forgotPassword(email);
          message = "If an account exists, a reset link is on its way.";
        });
      } else if (form.id === "account-new-password") {
        const password = form.elements.password.value;
        void run(async () => {
          await auth.updatePassword(password);
          message = "Password updated.";
        });
      } else if (form.id === "account-merge-password") {
        const password = form.elements.password.value;
        void run(async () => {
          await auth.updatePassword(password);
          merge.pending = restorationStore.finish(auth.getSession().user?.id, "email");
          if (!merge.pending) merge = { step: "done", primaryId: auth.getSession().user?.id };
          await refreshMethods();
          message = "A new password is set for your primary email.";
        });
      } else if (form.id === "account-merge-email-setup") {
        const email = form.elements.email.value;
        void run(async () => {
          await auth.requestEmailChange(email);
          merge.pending = restorationStore.emailConfirmation(auth.getSession().user?.id, email);
          message = "Email confirmation pending. Check your inbox before setting a new password.";
        });
      }
    });
    auth.subscribe((state, event) => {
      if (state.user && ["SIGNED_IN", "INITIAL_SESSION", "USER_UPDATED"].includes(event) && view !== "merge") resumeRestoration();
      if (view === "merge" && merge.primaryId && state.user?.id !== merge.primaryId) {
        void mergeService?.clear();
        view = "sign-in";
        merge = { step: "sign-in" };
      }
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" ||
          (state.user && state.user.id !== migrationFor))
        void refreshMigration();
      else if (event === "SIGNED_OUT") void refreshMigration();
      if (["SIGNED_IN", "INITIAL_SESSION", "SIGNED_OUT", "USER_UPDATED"].includes(event))
        void refreshMethods();
      if (event === "SIGNED_OUT") { void mergeService?.clear(); view = "sign-in"; merge = { step: "sign-in" }; }
      if (state.callbackError && ["INITIAL_SESSION", "UNAVAILABLE"].includes(event)) {
        message = state.callbackError;
        open();
      }
      if (event === "PASSWORD_RECOVERY" && !document.querySelector("#lesson-dialog")?.open)
        open();
      render();
    });
    window.addEventListener("online", render);
    window.addEventListener("offline", render);
    void auth.initialize();
  }
  return { bind, open, close, render };
}
