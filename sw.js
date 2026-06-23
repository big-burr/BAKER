// BAKER Service Worker — baker-v27
const CACHE = 'baker-v33';

const ASSETS = [
  '/BAKER/',
  '/BAKER/hud.html',
  '/BAKER/index.html',
  '/BAKER/conversation.html',
  '/BAKER/analyze.html',
  '/BAKER/inbox.html',
  '/BAKER/lecture.html',
  '/BAKER/weekly.html',
  '/BAKER/notelinker.html',
  '/BAKER/vaultgraph.html',
  '/BAKER/vaultchat.html',
  '/BAKER/baker-app.js',
  '/BAKER/map.html',
  '/BAKER/manifest.json',
  '/BAKER/icon.svg',
  '/BAKER/js/fallout.js',
  '/BAKER/js/vault-ui.js',
  '/BAKER/js/vault-graph.js',
  '/BAKER/js/vault-graph-draw.js',
  '/BAKER/js/vault-graph-trees.js',
  '/BAKER/js/spotify.js',
  '/BAKER/js/cal.js',
  '/BAKER/js/mcal.js',
  '/BAKER/js/budget.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Network-first for API calls — never cache Anthropic or Spotify
  if (
    e.request.url.includes('anthropic.com') ||
    e.request.url.includes('spotify.com') ||
    e.request.url.includes('googleapis.com/css') ||
    e.request.url.includes('nominatim.openstreetmap.org') ||
    e.request.url.includes('router.project-osrm.org') ||
    e.request.url.includes('basemaps.cartocdn.com')
  ) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // Cache-first for everything else
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
