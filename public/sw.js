/* PrepWays service worker: makes the site installable and usable offline.
 * Pages and data: network first (always fresh when online), cached copy offline.
 * Hashed build assets (/assets/*), icons and fonts: cache first.
 * Bump VERSION to drop old caches after a deploy that changes caching rules. */
const VERSION = 'v2';
const CACHE = `prepways-${VERSION}`;
const PAGES = ['/', '/index.html', '/jee.html', '/neet.html', '/school.html', '/sitemap.html', '/terms.html', '/privacy.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(PAGES.map((p) => cache.add(p))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('prepways-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const hit = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (hit) return hit;
    if (request.mode === 'navigate') return (await cache.match('/index.html')) || Response.error();
    return Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !fonts) return; // e.g. OTP API: never cached

  if (request.mode === 'navigate' || url.pathname.startsWith('/data/')) {
    event.respondWith(networkFirst(request));
  } else if (fonts || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request));
  }
});
