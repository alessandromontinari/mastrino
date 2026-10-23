/* Mastrino service worker: keeps the app usable offline. */
const PREFIX = 'mastrino-';
const CACHE = PREFIX + '2026-10-23-2';
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./archivo-latin-wdth-normal.woff2",
  "./ibm-plex-mono-latin-400-normal.woff2",
  "./ibm-plex-mono-latin-500-normal.woff2"
];
const OFFLINE = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<title>Mastrino</title><body style="font-family:system-ui,sans-serif;padding:32px 20px;line-height:1.5">'
  + '<h1 style="font-size:20px">Mastrino non riesce a partire</h1>'
  + '<p>Il telefono sembra offline e l’app non è ancora stata salvata per l’uso senza rete. '
  + 'Riprova quando sei connesso: dopo il primo avvio funziona anche offline.</p>'
  + '<p><a href="./">Riprova</a></p></body>';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

/* Other apps on the same site keep their caches: only this app's old versions are removed. */
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    /* Pages: network first so updates show at once; after 3.5 s use the saved copy if there is one. */
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const net = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; });
      net.catch(() => {});
      try {
        const first = await Promise.race([net, new Promise((r) => setTimeout(() => r(null), 3500))]);
        if (first && first.ok) return first;
      } catch (e) {}
      const saved = (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./index.html')) || (await cache.match('./'));
      if (saved) return saved;
      try { return await net; }
      catch (e) { return new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }); }
    })());
    return;
  }
  /* Everything else: saved copy at once, refreshed in the background. */
  event.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => cached);
    if (cached) { event.waitUntil(network); return cached; }
    return network;
  }));
});
