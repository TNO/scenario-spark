const CACHE_NAME = 'scenario-spark-82aa4a1fced3b4fb';
const STARTER_KIT_LANGUAGES = new Set(['nl', 'en', 'fr', 'de', 'es', 'pl']);

const BASE = self.location.pathname.replace(/\/sw\.js$/, '') || '/';

const PRECACHE_URLS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/assets/index.js',
  BASE + '/assets/index.css',
  BASE + '/manifest.webmanifest',
  BASE + '/icons/icon-192.png',
  BASE + '/icons/icon-512.png',
  BASE + '/offline.html',
].map((url) => url.replace(/\/+/g, '/'));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('scenario-spark-') && k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_STARTER_KIT') return;
  const language = event.data.language;
  if (!STARTER_KIT_LANGUAGES.has(language)) {
    console.error('Unsupported starter kit language:', language);
    return;
  }
  const url = `${BASE}/assets/${language}.js`;
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.match(url).then((cached) => cached || cache.add(url)))
      .catch((error) => console.error('Could not cache starter kit:', error))
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests for same-origin or CDN assets
  if (event.request.method !== 'GET') return;

  // Network-first for navigation requests (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(BASE + '/offline.html'))
    );
    return;
  }

  const url = new URL(event.request.url);
  const isHashedAsset = url.origin === self.location.origin && /-[\w-]{8}\.[a-z0-9]+$/i.test(url.pathname);

  const fetchAndCache = () =>
    fetch(event.request).then((response) => {
      if (!response || response.status !== 200 || response.type === 'opaque') return response;
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      return response;
    });

  // Cache-first for content-hashed assets: their URL changes whenever their content does.
  if (isHashedAsset) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetchAndCache()));
    return;
  }

  // Network-first for code and other assets with stable names, so a new deployment is used immediately.
  event.respondWith(fetchAndCache().catch(() => caches.match(event.request).then((cached) => cached || Response.error())));
});
