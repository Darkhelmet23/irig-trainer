import { loadMergeClient } from "./merge-client.js";

const status = document.querySelector("#merge-popup-status");
const search = new URLSearchParams(location.search);
const provider = search.get("provider");
const nonce = search.get("nonce") || sessionStorage.getItem("irig-merge-nonce");
function send(message) {
  if (window.opener && nonce) window.opener.postMessage({ type: "irig-merge-auth", nonce, ...message }, location.origin);
}
async function run() {
  if (!window.opener || !nonce) throw new Error("Open this window from Merge another account.");
  if (provider) {
    if (!["google", "facebook"].includes(provider)) throw new Error("Unsupported sign-in provider.");
    sessionStorage.setItem("irig-merge-nonce", nonce);
    const { client } = await loadMergeClient({ popup: true });
    // The project's Site URL returns to /; the early head script routes this popup
    // to /merge-auth.html before the primary app can consume the OAuth code.
    const { error } = await client.auth.signInWithOAuth({ provider });
    if (error) throw error;
    status.textContent = "Finish signing in to the other account…";
    return;
  }
  if (search.get("error") || search.get("error_code"))
    throw new Error("Other-account sign-in did not finish. Try again.");
  const { client } = await loadMergeClient({ popup: true });
  const { data, error } = await client.auth.getSession();
  if (error || !data?.session?.access_token) throw new Error("Other-account sign-in did not finish. Try again.");
  send({ status: "ready", accessToken: data.session.access_token });
  status.textContent = "Account verified. You can return to iRig Trainer.";
  sessionStorage.removeItem("irig-merge-nonce");
}
run().catch((error) => {
  status.textContent = error.message || "Sign-in failed.";
  send({ status: "error", message: status.textContent });
  sessionStorage.removeItem("irig-merge-nonce");
});
