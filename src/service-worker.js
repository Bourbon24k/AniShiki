/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

const CACHE = `cache-${version}`;
const ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
    async function addFilesToCache() {
        const cache = await caches.open(CACHE);
        await cache.addAll(ASSETS);
    }
    event.waitUntil(addFilesToCache());
});

self.addEventListener('activate', (event) => {
    async function deleteOldCaches() {
        for (const key of await caches.keys()) {
            if (key !== CACHE) await caches.delete(key);
        }
    }
    event.waitUntil(deleteOldCaches());
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    async function respond() {
        const url = new URL(event.request.url);
        const cache = await caches.open(CACHE);

        // Serve build files from cache
        if (ASSETS.includes(url.pathname)) {
            const cachedResponse = await cache.match(event.request);
            if (cachedResponse) return cachedResponse;
        }

        // Try network first, fall back to cache
        try {
            const response = await fetch(event.request);
            const isNotExtension = url.protocol === 'http:' || url.protocol === 'https:';
            const isSuccess = response.status === 200;

            if (isNotExtension && isSuccess) {
                cache.put(event.request, response.clone());
            }

            return response;
        } catch {
            const cachedResponse = await cache.match(event.request);
            if (cachedResponse) return cachedResponse;
        }

        return new Response('Offline', { status: 503 });
    }

    event.respondWith(respond());
});
