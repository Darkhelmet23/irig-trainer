const CACHE = "irig-trainer-static-v19";
const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/auth/supabase-client.js",
  "/auth/auth-service.js",
  "/auth/account-ui.js",
  "/data/local-repositories.js",
  "/data/migration.js",
  "/vendor/supabase-sdk.js",
  "/audio.js",
  "/curriculum.js",
  "/engine.js",
  "/lesson-patterns.js",
  "/song-tempo.js",
  "/song-practice-ui.js",
  "/song-studio.js",
  "/song-studio-storage.js",
  "/song-studio-ui.js",
  "/song-studio-capture.js",
  "/riff-editor.js",
  "/jam-mode.js",
  "/onboarding.js",
  "/tunings.js",
  "/songs.js",
  "/repertoire.js",
  "/arcade-ui.js",
  "/practice-hub.js",
  "/drills.js",
  "/session-coach.js",
  "/song-difficulty.js",
  "/input-diagnostics.js",
  "/metronome.js",
  "/session-controls.js",
  "/score-practice.js",
  "/library-tools.js",
  "/storage.js",
  "/profile-store.js",
  "/navigation.js",
  "/progression.js",
  "/skill-tree-ui.js",
  "/progression-library-ui.js",
  "/lesson-library-ui.js",
  "/setup-ui.js",
  "/lesson-session-ui.js",
  "/page-bindings.js",
  "/song-import-ui.js",
  "/arena-page.js",
  "/tuner-ui.js",
  "/practice/session.js",
  "/manifest.webmanifest",
  "/brand-icon.svg",
  "/brand-mark.svg",
  "/brand-mark-mono.svg",
  "/brand-wordmark.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("irig-trainer-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/"))
    return;
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (
            response.ok &&
            (url.pathname.endsWith(".js") ||
              url.pathname.endsWith(".css") ||
              url.pathname.endsWith(".svg"))
          ) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          request.mode === "navigate"
            ? caches.match("/index.html")
            : Response.error(),
        );
    }),
  );
});
