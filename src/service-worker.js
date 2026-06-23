/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

const CACHE = `anishiki-cache-${version}`;
const ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	// Никогда не кэшируем запросы к API Anixart и видео/постеры CDN.
	if (url.origin !== self.location.origin) return;

	// Статика приложения — cache-first.
	if (ASSETS.includes(url.pathname)) {
		event.respondWith(caches.match(request).then((c) => c || fetch(request)));
		return;
	}

	// Навигация — network-first с офлайн-фолбэком на закэшированную оболочку.
	event.respondWith(
		fetch(request).catch(() => caches.match(request).then((c) => c || caches.match('/')))
	);
});
