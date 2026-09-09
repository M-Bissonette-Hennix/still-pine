const VERSION = '1.2.0';
const STATIC_CACHE = `still-pine-static-v${VERSION}`;
const CONTENT_CACHE = `still-pine-content-v${VERSION}`;
const RUNTIME_CACHE = `still-pine-runtime-v${VERSION}`;
const CACHE_PREFIX = 'still-pine-';
const LEGACY_CACHES = new Set(['still-pine-v1.0.0', 'still-pine-v1.1.0']);

const CORE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './js/practice-engine.js',
  './js/pack-validator.js',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/kuji/01-rin.jpg',
  './assets/kuji/02-pyo.jpg',
  './assets/kuji/03-to.jpg',
  './assets/kuji/04-sha.jpg',
  './assets/kuji/05-kai.jpg',
  './assets/kuji/06-jin.jpg',
  './assets/kuji/07-retsu.jpg',
  './assets/kuji/08-zai.jpg',
  './assets/kuji/09-zen.jpg',
  './content/manifest.json',
  './content/readings/library.json',
  './content/readings/fukanzazengi-study-notes.md',
  './content/packs/foundation-01.zenpack.json'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(CORE);
    const existing = await caches.keys();
    if (existing.some(key => LEGACY_CACHES.has(key))) await self.skipWaiting();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC_CACHE, CONTENT_CACHE, RUNTIME_CACHE]);
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && !keep.has(key)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (['script', 'style', 'image', 'manifest'].includes(request.destination)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (/\.(?:json|md)$/i.test(url.pathname)) {
    event.respondWith(networkFirst(request, CONTENT_CACHE));
    return;
  }

  event.respondWith(networkFirst(request, RUNTIME_CACHE));
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) return response;
    return response;
  } catch {
    return (await caches.match(request)) || (await caches.match('./index.html')) || Response.error();
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}
