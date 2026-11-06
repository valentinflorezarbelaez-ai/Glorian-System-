/**
 * EOS SYSTEM — HIGH-RESILIENCE OFFLINE SERVICE WORKER (Layer 0)
 * Conforms to W3C Service Worker API, PWA Offline-First Specifications,
 * and Stale-While-Revalidate (SWR) cache tiering.
 *
 * Zero external runtime dependencies.
 */

const CACHE_VERSION = 'v40-actionable-paths';
const STATIC_CACHE = `eos-static-${CACHE_VERSION}`;
const API_CACHE = `eos-api-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/css/eos.css",
  "/js/eos.js",
  "/js/wasm_exec.js",
  "/css/eos.css?v=15.0",
  "/js/eos.js?v=18.0",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/assets/eos-system.webp"
];

// Precache critical shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Purge obsolete cache generations
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== API_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Tiered routing: Stale-While-Revalidate for static, Network-First for HTML/API
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 1. API Endpoints: Network-First with API cache fallback and synthetic offline response
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(API_CACHE).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() =>
          caches.match(req).then((cached) => {
            if (cached) return cached;
            return new Response(
              JSON.stringify({
                status: "OFFLINE_STANDALONE_MODE",
                offline: true,
                message: "EOS System offline-first fallback active. Local L0 Monad operating from cache.",
                timestamp: new Date().toISOString()
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json; charset=utf-8" }
              }
            );
          })
        )
    );
    return;
  }

  // 2. Static assets use stale-while-revalidate; cached responses have no timing guarantee.
  const isStatic =
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".webmanifest") ||
    url.hostname.includes("fonts.g");

  if (isStatic) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              const clone = networkRes.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(req, clone));
            }
            return networkRes;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // 3. Navigation / HTML Document: Network-First with offline shell fallback
  event.respondWith(
    fetch(req)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(req, clone));
        }
        return networkRes;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || caches.match("/index.html"))
      )
  );
});
