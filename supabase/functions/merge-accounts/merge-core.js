const oauth = new Set(["google", "facebook"]);
export function providersOf(user) {
  return [...new Set((Array.isArray(user?.identities) ? user.identities : [])
    .map((identity) => identity?.provider).filter((value) => value === "email" || oauth.has(value)))];
}
export function maskEmail(email) {
  if (typeof email !== "string" || !email.includes("@")) return "Email unavailable";
  const [name, domain] = email.split("@");
  return `${name.slice(0, 1)}***@${domain}`.slice(0, 254);
}
function reply(status, body, origin = "") {
  return new Response(JSON.stringify(body), { status, headers: {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "vary": "Origin",
    ...(origin ? { "access-control-allow-origin": origin } : {}),
  } });
}
export function createMergeHandler({ admin, allowedOrigins }) {
  return async (request) => {
    const origin = request.headers.get("origin") || "";
    if (origin && !allowedOrigins.has(origin)) return reply(403, { error: "This origin is not allowed." });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: {
      "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "authorization, apikey, content-type", "vary": "Origin",
    } });
    if (request.method !== "POST") return reply(405, { error: "POST required." }, origin);
    const primaryToken = /^Bearer (\S+)$/i.exec(request.headers.get("authorization") || "")?.[1];
    if (!primaryToken) return reply(401, { error: "Sign in to the account you want to keep." }, origin);
    let body;
    try { body = await request.json(); } catch { return reply(400, { error: "Invalid request." }, origin); }
    if (!body || !["preview", "merge"].includes(body.operation) ||
        typeof body.secondaryToken !== "string" || !body.secondaryToken ||
        body.secondaryToken === primaryToken || Object.keys(body).some((key) =>
          !["operation", "secondaryToken"].includes(key)))
      return reply(400, { error: "Two separate account sessions are required." }, origin);
    try {
      const [{ data: primaryData, error: primaryError }, { data: secondaryData, error: secondaryError }] =
        await Promise.all([admin.auth.getUser(primaryToken), admin.auth.getUser(body.secondaryToken)]);
      const primary = primaryData?.user, secondary = secondaryData?.user;
      if (primaryError || !primary) return reply(401, { error: "Primary session expired. Sign in again." }, origin);
      if (secondaryError || !secondary) return reply(401, { error: "The other account session expired. Sign in again." }, origin);
      if (primary.id === secondary.id) return reply(400, { error: "Choose a different account to merge." }, origin);
      const params = { p_primary: primary.id, p_secondary: secondary.id };
      const preview = await admin.rpc("merge_account_preview", params);
      if (preview.error) {
        if (String(preview.error.message).includes("CLOUD_FILES_UNSUPPORTED"))
          return reply(409, { error: "This account has cloud files that cannot be merged yet." }, origin);
        return reply(500, { error: "Unable to inspect cloud account data. No changes were made." }, origin);
      }
      const primaryProviders = providersOf(primary), secondaryProviders = providersOf(secondary);
      const details = {
        primary: { email: maskEmail(primary.email), providers: primaryProviders, ...preview.data.primary },
        secondary: { email: maskEmail(secondary.email), providers: secondaryProviders, ...preview.data.secondary },
        alreadyMerged: !!preview.data.alreadyMerged,
        providersToLink: secondaryProviders.filter((provider) => oauth.has(provider) && !primaryProviders.includes(provider)),
        duplicateProviders: secondaryProviders.filter((provider) => oauth.has(provider) && primaryProviders.includes(provider)),
      };
      if (body.operation === "preview") return reply(200, details, origin);
      const merged = await admin.rpc("merge_user_data", params);
      if (merged.error) {
        if (String(merged.error.message).includes("CLOUD_FILES_UNSUPPORTED"))
          return reply(409, { error: "This account has cloud files that cannot be merged yet." }, origin);
        return reply(500, { error: "Cloud data merge failed. The other account was not deleted." }, origin);
      }
      const deleted = await admin.auth.admin.deleteUser(secondary.id);
      if (deleted.error) return reply(503, {
        status: "data_merged_auth_cleanup_pending",
        error: "Cloud data was preserved, but the other account could not be removed. Please retry the merge; it is safe to retry.",
      }, origin);
      return reply(200, { status: "merged", providersToLink: details.providersToLink,
        duplicateProviders: details.duplicateProviders }, origin);
    } catch {
      return reply(500, { error: "The account service is unavailable. Check account status before retrying." }, origin);
    }
  };
}
