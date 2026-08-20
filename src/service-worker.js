/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

const CACHE = `anishiki-cache-${version}`;
// adapter-static с fallback: любая навигация обслуживается этой оболочкой,
// поэтому её кладём в кэш явно — иначе офлайн отдавать нечего.
const SHELL = '/index.html';
const ASSETS = [...build, ...files];

// skipWaiting здесь не зовём: страница сама решит, когда применить обновление.
self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(ASSETS).catch((e) => console.error('sw precache', e));
			// Оболочку кладём отдельно, чтобы её промах не обнулил весь прекэш.
			await cache.add(SHELL).catch(() => cache.add('/').catch(() => {}));
		})()
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

// Страница просит применить только что скачанное обновление.
self.addEventListener('message', (event) => {
	if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	// Чужие origin (API Anixart, Supabase, видео и постеры CDN) не трогаем.
	if (url.origin !== self.location.origin) return;
	// Свой серверный шлюз — всегда из сети, ответы персональные и быстро протухают.
	if (url.pathname.startsWith('/api/')) return;

	// Статика собранного приложения неизменяема (хэш в имени) — cache-first.
	if (ASSETS.includes(url.pathname)) {
		event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
		return;
	}

	// Навигация — network-first, офлайн отдаём оболочку приложения.
	if (request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				try {
					return await fetch(request);
				} catch (err) {
					const cache = await caches.open(CACHE);
					const shell = (await cache.match(SHELL)) || (await cache.match('/'));
					// Оболочки в кэше может не быть (прекэш ещё идёт или сорвался).
					// Тогда пробрасываем исходную ошибку: пусть браузер покажет свою
					// офлайн-страницу, а не наш пустой network error.
					if (shell) return shell;
					throw err;
				}
			})()
		);
		return;
	}

	// Остальное своего origin — из сети с откатом в кэш.
	event.respondWith(
		(async () => {
			try {
				return await fetch(request);
			} catch (err) {
				const hit = await caches.match(request);
				if (hit) return hit;
				throw err;
			}
		})()
	);
});
