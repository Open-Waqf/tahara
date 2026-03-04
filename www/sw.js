let CACHE_NAME = 'tahara-v2.3';
let ASSETS = [
    './',
    './index.html',
    './compiled.css',
    './script.js',
    './strings.json'
];

try {
    importScripts('./sw-assets.js');
    if (self.__TAHARA_SW_MANIFEST && Array.isArray(self.__TAHARA_SW_MANIFEST.assets)) {
        CACHE_NAME = self.__TAHARA_SW_MANIFEST.cacheName || CACHE_NAME;
        ASSETS = self.__TAHARA_SW_MANIFEST.assets;
    }
} catch (error) {
    console.warn('SW manifest not found, using fallback asset list', error);
}

self.addEventListener("install", (event) => {
    self.skipWaiting();
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        // Don’t brick install if one asset fails (CDN hiccup, typo, etc.)
        await Promise.allSettled(ASSETS.map((a) => cache.add(a)));
    })());
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // 1. Ignore non-GET and external requests
    if (req.method !== "GET" || url.origin !== self.location.origin) return;

    // 2. Network Only: APK downloads (Never cache)
    if (url.pathname.endsWith(".apk")) {
        event.respondWith(fetch(req));
        return;
    }

    // 3. Network First: Main HTML (Critical for detecting version changes)
    if (req.mode === "navigate" || url.pathname.endsWith("index.html")) {
        event.respondWith((async () => {
            try {
                // A. Try network first (to get new version if online)
                const networkResponse = await fetch(req);
                const cache = await caches.open(CACHE_NAME);
                cache.put(req, networkResponse.clone());
                return networkResponse;
            } catch (error) {
                // B. Fallback to cache if offline
                const cache = await caches.open(CACHE_NAME);
                return await cache.match("./index.html");
            }
        })());
        return;
    }

    // 4. Stale-While-Revalidate: All other assets (CSS, JS, JSON, Images)
    // This serves fast from cache, but updates the cache in the background
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(req);

        // Fetch from network to update cache for NEXT time
        const networkFetch = fetch(req).then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
                cache.put(req, networkResponse.clone());
            }
            return networkResponse;
        }).catch(() => null); // Ignore errors if offline

        // Return cached response if we have it, otherwise wait for network
        return cachedResponse || networkFetch;
    })());
});

// 5. LISTENER: Handle the "Skip Waiting" message from script.js
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
