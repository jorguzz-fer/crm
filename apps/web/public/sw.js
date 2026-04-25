/**
 * CRM Service Worker
 *
 * Estratégia:
 *  - Cache-first  : /_next/static/** (bundles com hash de conteúdo — cache para sempre)
 *  - Cache-first  : /icons/**, /favicon.ico, /manifest.json
 *  - Network-first: tudo o mais (páginas HTML, APIs)
 *
 * Quando offline e não há cache, responde com a página offline.
 */

const CACHE_STATIC  = "crm-static-v1";
const CACHE_PAGES   = "crm-pages-v1";
const OFFLINE_URL   = "/offline";

const STATIC_PATTERNS = [
  /^\/_next\/static\//,
  /^\/icons\//,
  /^\/favicon\.ico$/,
  /^\/manifest\.json$/,
];

// ─── Instalação ─────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_PAGES)
      .then((cache) => cache.addAll([OFFLINE_URL]).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

// ─── Ativação ────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  const VALID = new Set([CACHE_STATIC, CACHE_PAGES]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !VALID.has(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// ─── Fetch ───────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Ignora requisições não-GET e cross-origin
  if (request.method !== "GET") return;
  if (!request.url.startsWith(self.location.origin)) return;

  const pathname = new URL(request.url).pathname;

  // ① Cache-first para assets estáticos
  if (STATIC_PATTERNS.some((re) => re.test(pathname))) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_STATIC).then((c) => c.put(request, clone));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // ② Ignora rotas de API — sem cache
  if (pathname.startsWith("/api/")) return;

  // ③ Network-first para páginas (com fallback offline)
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_PAGES).then((c) => c.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(request)
          .then((cached) => cached ?? caches.match(OFFLINE_URL))
          .then((r) => r ?? new Response("Você está offline.", { status: 503 })),
      ),
  );
});
