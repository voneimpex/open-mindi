/* Open Mindi service worker — runtime cache so the installed app works offline.
 * Cache-first for anything already seen; otherwise fetch and stash a copy. */
const CACHE = 'open-mindi-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const resp = await fetch(req);
        if (resp && resp.status === 200 && resp.type === 'basic') cache.put(req, resp.clone());
        return resp;
      } catch (err) {
        return cached || Response.error();
      }
    })
  );
});
