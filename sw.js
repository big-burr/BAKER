// BAKER Service Worker — baker-v73
const CACHE = 'baker-v73';

const ASSETS = [
  '/BAKER/',
  '/BAKER/hud.html',
  '/BAKER/hud.css',
  '/BAKER/nine-worlds.png',
  '/BAKER/index.html',
  '/BAKER/manifest.json',
  '/BAKER/icon.svg',
  '/BAKER/js/vault-sync.js',
  '/BAKER/js/vault-graph.js',
  '/BAKER/js/vault-graph-draw.js',
  '/BAKER/js/vault-graph-trees.js',
  '/BAKER/js/spotify.js',
  '/BAKER/js/cal.js',
  '/BAKER/js/mcal.js',
  '/BAKER/js/vault-ui.js',
  '/BAKER/js/budget.js',
  '/BAKER/js/fallout.js',
  '/BAKER/js/panels.js',
  '/BAKER/js/voice.js',
  '/BAKER/js/orb.js',
  '/BAKER/js/strength-maps.js',
  '/BAKER/js/strength.js',
  '/BAKER/js/hud-info.js',
  '/BAKER/js/reminders.js',
  '/BAKER/js/filedrop.js',
  '/BAKER/js/biometrics.js',
  '/BAKER/js/focus.js',
  '/BAKER/js/academic.js',
  '/BAKER/js/places.js',
  '/BAKER/js/daily.js',
  '/BAKER/js/dailylog.js',
  '/BAKER/js/timeline.js',
  '/BAKER/js/habits.js',
  '/BAKER/js/lecture.js',
  '/BAKER/js/weekly.js',
  '/BAKER/js/inbox.js',
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
  if (
    e.request.url.includes('anthropic.com') ||
    e.request.url.includes('spotify.com') ||
    e.request.url.includes('googleapis.com/css') ||
    e.request.url.includes('nominatim.openstreetmap.org') ||
    e.request.url.includes('overpass-api.de') ||
    e.request.url.includes('router.project-osrm.org') ||
    e.request.url.includes('basemaps.cartocdn.com') ||
    e.request.url.includes('cdnjs.cloudflare.com') ||
    e.request.url.includes('open-meteo.com') ||
    e.request.url.includes('ntfy.sh')
  ) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

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
