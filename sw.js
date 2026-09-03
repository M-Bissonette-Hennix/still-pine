const CACHE = 'still-pine-v1.1.0';
const CORE = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest',
  './assets/icon-192.png', './assets/icon-512.png',
  './assets/kuji/01-rin.jpg', './assets/kuji/02-pyo.jpg', './assets/kuji/03-to.jpg',
  './assets/kuji/04-sha.jpg', './assets/kuji/05-kai.jpg', './assets/kuji/06-jin.jpg',
  './assets/kuji/07-retsu.jpg', './assets/kuji/08-zai.jpg', './assets/kuji/09-zen.jpg',
  './content/manifest.json', './content/readings/library.json',
  './content/readings/fukanzazengi-study-notes.md',
  './content/packs/foundation-01.zenpack.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(hit => hit || caches.match('./index.html')))
  );
});
