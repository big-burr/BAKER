const CACHE = 'baker-v11';
const BASE = '/BAKER';
const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/lecture.html',
  BASE + '/conversation.html',
  BASE + '/analyze.html',
  BASE + '/inbox.html',
  BASE + '/weekly.html',
  BASE + '/notelinker.html',
  BASE + '/vaultgraph.html',
  BASE + '/baker-app.js',
  BASE + '/icon.svg',
  BASE + '/manifest.json'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.url.includes('api.anthropic.com')) return;
  if (e.request.url.includes('fonts.googleapis.com')) return;
  if (e.request.url.includes('open-meteo.com')) return;
  if (e.request.url.includes('api.spotify.com')) return;
  if (e.request.url.includes('accounts.spotify.com')) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match(BASE + '/index.html')))
  );
});
