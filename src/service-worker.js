/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

/**
 * Service worker приложения.
 *
 * Три хранилища с разным сроком жизни:
 *  - оболочка и статика сборки (неизменяемы, живут до следующей версии);
 *  - постеры (переживают версию, чистятся по числу записей);
 *  - последние ответы каталога (чтобы офлайн было что показать).
 */

const VERSION_CACHE = `anishiki-app-${version}`;
const IMAGE_CACHE = 'anishiki-images-v3';
const DATA_CACHE = 'anishiki-data-v1';
const KEEP = new Set([VERSION_CACHE, IMAGE_CACHE, DATA_CACHE]);

const IMAGE_LIMIT = 220;
const SHELL = '/index.html';
const ASSETS = [...build, ...files];
const ASSET_SET = new Set(ASSETS);

// skipWaiting здесь не зовём: страница сама решит, когда применить обновление.
self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(VERSION_CACHE);
			await cache.addAll(ASSETS).catch((e) => console.error('sw precache', e));
			// Оболочку кладём отдельно, чтобы её промах не обнулил весь прекэш.
			await cache.add(SHELL).catch(() => cache.add('/').catch(() => {}));
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k)));
			// Мгновенная отдача навигаций из сети, пока SW просыпается.
			if (self.registration.navigationPreload) {
				await self.registration.navigationPreload.enable().catch(() => {});
			}
			await self.clients.claim();
		})()
	);
});

self.addEventListener('message', (event) => {
	if (event.data === 'skip-waiting') self.skipWaiting();
});

// Нативный Web Push (когда сервер его отправит) и локальные уведомления
// используют одинаковый payload. Это важно для iOS PWA: клик открывает не
// главную, а конкретный релиз/комментарий даже если приложение было закрыто.
self.addEventListener('push', (event) => {
	event.waitUntil(
		(async () => {
			let payload = {};
			try {
				payload = event.data?.json?.() || {};
			} catch {
				payload = { body: event.data?.text?.() || '' };
			}
			await self.registration.showNotification(payload.title || 'Событие в AniShiki', {
				body: payload.body || 'Откройте приложение, чтобы посмотреть подробности.',
				icon: payload.icon || '/icon-192.png',
				badge: '/icon-192.png',
				image: payload.image,
				tag: payload.tag || `push-${Date.now()}`,
				data: { url: payload.url || '/notifications' }
			});
		})()
	);
});

/** Не давать кэшу картинок расти бесконечно. */
async function trimImages() {
	const cache = await caches.open(IMAGE_CACHE);
	const keys = await cache.keys();
	if (keys.length <= IMAGE_LIMIT) return;
	// Записи идут в порядке добавления — удаляем самые старые.
	await Promise.all(keys.slice(0, keys.length - IMAGE_LIMIT).map((k) => cache.delete(k)));
}

function isImageRequest(request, url) {
	return request.destination === 'image' || /\.(?:png|jpe?g|webp|avif|gif)$/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	let url;
	try {
		url = new URL(request.url);
	} catch {
		return;
	}

	// Постеры Anixart лежат на чужом CDN — их кэшировать полезнее всего:
	// именно они делают повторное открытие списков мгновенным. А вот свои
	// картинки (иконки, логотип) сюда попадать не должны: кэш постеров живёт
	// между версиями, и обновлённая иконка из него уже не вылезет.
	if (url.origin !== self.location.origin) {
		if (isImageRequest(request, url)) {
			event.respondWith(cacheFirstImage(request));
			return;
		}
		return;
	}

	// Свой серверный шлюз — всегда из сети, ответы персональные и быстро протухают.
	if (url.pathname.startsWith('/api/')) return;
	// Оптимизатор картинок Vercel — свой origin, но по сути тот же CDN.
	if (url.pathname.startsWith('/_vercel/image')) {
		event.respondWith(cacheFirstImage(request));
		return;
	}

	// Статика сборки неизменяема (хэш в имени) — cache-first.
	if (ASSET_SET.has(url.pathname)) {
		event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
		return;
	}

	// Навигация — network-first, офлайн отдаём оболочку приложения.
	if (request.mode === 'navigate') {
		event.respondWith(navigateWithFallback(event));
		return;
	}

	event.respondWith(networkThenCache(request));
});

async function cacheFirstImage(request) {
	const cache = await caches.open(IMAGE_CACHE);
	const hit = await cache.match(request);
	// Непрозрачный ответ разрешено отдавать только на no-cors запрос. Раньше
	// проверки не было: сохранённый однажды opaque-аватар возвращался и на
	// обычный запрос, браузер отвечал сетевой ошибкой, и картинка не грузилась
	// вовсе. cache.match режим запроса не учитывает, поэтому сверяем сами.
	if (hit && (hit.type !== 'opaque' || request.mode === 'no-cors')) return hit;
	try {
		const response = await fetch(request);
		// Непрозрачные ответы (CDN без CORS) тоже кладём: отдать их браузеру
		// как картинку можно, читать содержимое нам и не нужно.
		if (response.ok || (response.type === 'opaque' && request.mode === 'no-cors')) {
			cache.put(request, response.clone()).then(trimImages).catch(() => {});
		}
		return response;
	} catch (e) {
		const stale = await cache.match(request);
		if (stale && (stale.type !== 'opaque' || request.mode === 'no-cors')) return stale;
		throw e;
	}
}

async function navigateWithFallback(event) {
	try {
		const preloaded = await event.preloadResponse;
		if (preloaded) return preloaded;
		return await fetch(event.request);
	} catch (err) {
		const cache = await caches.open(VERSION_CACHE);
		const shell = (await cache.match(SHELL)) || (await cache.match('/'));
		// Оболочки в кэше может не быть (прекэш ещё идёт или сорвался).
		// Тогда пробрасываем исходную ошибку: пусть браузер покажет свою
		// офлайн-страницу, а не наш пустой network error.
		if (shell) return shell;
		throw err;
	}
}

async function networkThenCache(request) {
	try {
		const response = await fetch(request);
		if (response.ok) {
			const cache = await caches.open(DATA_CACHE);
			cache.put(request, response.clone()).catch(() => {});
		}
		return response;
	} catch (err) {
		const hit = (await caches.match(request)) || (await caches.open(DATA_CACHE).then((c) => c.match(request)));
		if (hit) return hit;
		throw err;
	}
}

/* ───────────────────────── уведомления ───────────────────────── */

// Клик по уведомлению должен открывать нужный экран, а не просто приложение.
self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const target = event.notification.data?.url || '/notifications';
	event.waitUntil(
		(async () => {
			const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
			for (const client of clients) {
				if ('focus' in client) {
					client.focus();
					client.postMessage({ type: 'navigate', url: target });
					return;
				}
			}
			await self.clients.openWindow(target);
		})()
	);
});
