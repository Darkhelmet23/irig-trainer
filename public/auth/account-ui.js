const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

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
      return `<div class="account-method"><div><strong>${label}</strong><span class="account-method-status${connected ? " is-connected" : ""}">${status}</span></div>${action}</div>`;
    }).join("");
  return '<section class="account-panel account-methods"><h3>Sign-in methods</h3>' +
    '<p>Connect another sign-in method to this account. Disconnect requires another connected method. This does not move or merge practice data.</p>' +
    '<div class="account-method-list">' + rows + '</div>' +
    (methodsError ? '<p class="account-note">Could not load sign-in methods. ' +
      '<button class="subtle-btn" type="button" data-account-action="retry-methods">Try again</button></p>' : '') +
    '</section>';
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
      '<button class="outline-btn" type="button" data-provider="google">Continue with Google</button>' +
      '<button class="outline-btn" type="button" data-provider="facebook">Continue with Facebook</button>' +
      '</div><div class="account-divider"><span>or use email</span></div>' +
      '<form id="account-email"><label class="form-group"><span>Email</span>' +
      '<input name="email" type="email" autocomplete="email" required></label>' +
      '<label class="form-group"><span>Password</span>' +
      '<input name="password" type="password" minlength="8" autocomplete="current-password" required></label>' +
      '<div class="account-form-actions"><button class="primary" type="submit" name="intent" value="sign-in">Sign in</button>' +
      '<button class="outline-btn" type="submit" name="intent" value="sign-up">Create account</button></div></form>' +
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
  migrationRepository,
  detectProgress,
  dialog = document.querySelector("#account-dialog"),
  openButton = document.querySelector("#account-open"),
  isOnline = () => navigator.onLine !== false,
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
    } catch {
      if (request !== methodsRequest || auth.getSession().user?.id !== id) return;
      methodsError = "unavailable";
    }
    render();
    return methods;
  }
  function open() {
    if (!dialog.open) dialog.showModal();
    render();
    if (auth.getSession().user) void refreshMethods();
  }
  function close() {
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
      }
    });
    auth.subscribe((state, event) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" ||
          (state.user && state.user.id !== migrationFor))
        void refreshMigration();
      else if (event === "SIGNED_OUT") void refreshMigration();
      if (["SIGNED_IN", "INITIAL_SESSION", "SIGNED_OUT", "USER_UPDATED"].includes(event))
        void refreshMethods();
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
