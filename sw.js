let CACHE_NAME = "tahara-v2";

let ASSETS = [ "./", "./index.html", "./compiled.css", "./style.css", "./script.js", "./strings.json" ];

try {
    importScripts("./sw-assets.js");
    if (self.__TAHARA_SW_MANIFEST && Array.isArray(self.__TAHARA_SW_MANIFEST.assets)) {
        CACHE_NAME = self.__TAHARA_SW_MANIFEST.cacheName || CACHE_NAME;
        ASSETS = self.__TAHARA_SW_MANIFEST.assets;
    }
} catch (error) {
    console.warn("SW manifest not found, using fallback asset list", error);
}

self.addEventListener("install", event => {
    self.skipWaiting();
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await Promise.allSettled(ASSETS.map(a => cache.add(a)));
    })());
});

self.addEventListener("activate", event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()));
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", event => {
    const req = event.request;
    const url = new URL(req.url);
    if (req.method !== "GET" || url.origin !== self.location.origin) return;
    if (url.pathname.endsWith(".apk")) {
        event.respondWith(fetch(req));
        return;
    }
    if (req.mode === "navigate" || url.pathname.endsWith("index.html")) {
        event.respondWith((async () => {
            try {
                const networkResponse = await fetch(req);
                const cache = await caches.open(CACHE_NAME);
                cache.put(req, networkResponse.clone());
                return networkResponse;
            } catch (error) {
                const cache = await caches.open(CACHE_NAME);
                return await cache.match("./index.html");
            }
        })());
        return;
    }
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(req);
        const networkFetch = fetch(req).then(networkResponse => {
            if (networkResponse && networkResponse.ok) {
                cache.put(req, networkResponse.clone());
            }
            return networkResponse;
        }).catch(() => null);
        return cachedResponse || networkFetch;
    })());
});

self.addEventListener("message", event => {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});