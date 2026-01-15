/* DTT記録ツール PWA Service Worker (v2: safer updates) */
const CACHE_NAME = "dtt-cache-v19-1768435795";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/app.js?v=1768435795",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async ()=>{
    const cache = await caches.open(CACHE_NAME);
    // Best effort: don't fail install if one asset fails.
    await Promise.allSettled(CORE_ASSETS.map(a=>cache.add(a)));
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

// Allow page to request immediate activation
self.addEventListener("message", (event)=>{
  if(event.data && event.data.type === "SKIP_WAITING"){
    self.skipWaiting();
  }
});

const NETWORK_FIRST_URLS = [
  "/index.html",
  "/assets/app.js",
];

self.addEventListener("fetch", (event) => {

  const url = new URL(event.request.url);
  const path = url.pathname;

  const shouldNetworkFirst =
    (path.endsWith("/index.html") || path.endsWith("/assets/app.js"));

  if(shouldNetworkFirst){
    event.respondWith((async ()=>{
      try{
        const res = await fetch(event.request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, res.clone());
        return res;
      }catch(e){
        const cached = await caches.match(event.request);
        if(cached) return cached;
        return new Response("Offline", {status: 503});
      }
    })());
    return;
  }

  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  // Navigation: network-first, fallback to cache
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith((async ()=>{
      try{
        const res = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, res.clone());
        return res;
      }catch{
        const cached = await caches.match(req);
        return cached || caches.match("./index.html");
      }
    })());
    return;
  }

  // Other assets: cache-first
  event.respondWith((async ()=>{
    const cached = await caches.match(req);
    if(cached) return cached;
    const res = await fetch(req);
    const cache = await caches.open(CACHE_NAME);
    cache.put(req, res.clone());
    return res;
  })());
});
