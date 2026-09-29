// Be Kind, Rewind service worker.
// App shell: network-first so deploys show up on the next load, cache as fallback.
// TMDB images: cache-first, they never change for a given path.
// GitHub API, TMDB API, raw CSV: never touched here; the page handles its own offline fallback.
const VERSION = 'bkr-v1';
const SHELL = ['./', './index.html', './favicon.svg', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  if (url.hostname === 'image.tmdb.org') {
    e.respondWith(
      caches.open(VERSION).then(async c => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        try { const res = await fetch(e.request); if (res.ok) c.put(e.request, res.clone()); return res; }
        catch { return new Response('', { status: 504 }); }
      })
    );
    return;
  }

  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) caches.open(VERSION).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
    );
  }
});
