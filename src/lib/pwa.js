/**
 * Установка приложения, обновления service worker и системные уведомления.
 * Всё, что касается поведения оболочки на iOS, живёт в $lib/ios.
 */
import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { standalone, detectStandalone, isIosSafari } from './ios';

export { standalone, isIosSafari };

/** Отложенное событие beforeinstallprompt (Android/desktop Chrome) или null. */
export const installPrompt = writable(null);
/** Скачано обновление и ждёт применения. */
export const updateReady = writable(false);
/** Разрешение на системные уведомления: 'default' | 'granted' | 'denied' | 'unsupported' */
export const notificationPermission = writable('unsupported');

let waitingWorker = null;
/** Пользователь нажал «Обновить» — значит перезагрузка ожидаема. */
let updateRequested = false;

/** Показать системный диалог установки. Возвращает true, если приняли. */
export async function promptInstall(event) {
	if (!event) return false;
	try {
		event.prompt();
		const { outcome } = await event.userChoice;
		if (outcome === 'accepted') installPrompt.set(null);
		return outcome === 'accepted';
	} catch (e) {
		console.error('install prompt', e);
		return false;
	}
}

/** Применить скачанное обновление и перезагрузить страницу. */
export function applyUpdate() {
	updateRequested = true;
	if (!waitingWorker) {
		location.reload();
		return;
	}
	waitingWorker.postMessage('skip-waiting');
	waitingWorker = null;
	updateReady.set(false);
}

/* ─────────────────────── системные уведомления ─────────────────────── */

/**
 * Спросить разрешение на уведомления.
 *
 * На iOS оно доступно только в установленном приложении (iOS 16.4+): в Safari
 * запрос молча провалится, поэтому там сначала просим установить.
 */
export async function requestNotifications() {
	if (!browser || typeof Notification === 'undefined') return 'unsupported';
	try {
		const result = await Notification.requestPermission();
		notificationPermission.set(result);
		return result;
	} catch (e) {
		console.error('notification permission', e);
		return 'denied';
	}
}

/**
 * Показать локальное уведомление (без сервера пушей): используется, когда
 * приложение само нашло новую серию у тайтла из списка «Смотрю».
 *
 * @param {{ title: string, body?: string, url?: string, tag?: string, image?: string }} data
 */
export async function showLocalNotification({ title, body, url, tag, image }) {
	if (!browser || typeof Notification === 'undefined') return false;
	if (Notification.permission !== 'granted') return false;
	try {
		const registration = await navigator.serviceWorker?.ready;
		const options = {
			body,
			tag: tag || title,
			icon: '/icon-192.png',
			badge: '/icon-192.png',
			image,
			data: { url: url || '/notifications' }
		};
		if (registration) await registration.showNotification(title, options);
		else new Notification(title, options);
		return true;
	} catch (e) {
		console.error('local notification', e);
		return false;
	}
}

/** Значок с числом на иконке приложения (iOS 16.4+ в standalone, Chrome). */
export function setAppBadge(count) {
	if (!browser) return;
	try {
		if (count > 0) navigator.setAppBadge?.(count);
		else navigator.clearAppBadge?.();
	} catch {
		/* не поддерживается — не беда */
	}
}

/* ──────────────────────────── инициализация ──────────────────────────── */

/** Подписки на установку и обновления. Вызывается один раз из корневого layout. */
export function initPwa(onNavigate) {
	if (!browser) return () => {};

	standalone.set(detectStandalone());
	if (typeof Notification !== 'undefined') notificationPermission.set(Notification.permission);

	const onBeforeInstall = (event) => {
		event.preventDefault(); // иначе Chrome покажет свой баннер и забудет событие
		installPrompt.set(event);
	};
	const onInstalled = () => {
		installPrompt.set(null);
		standalone.set(true);
	};
	window.addEventListener('beforeinstallprompt', onBeforeInstall);
	window.addEventListener('appinstalled', onInstalled);

	// Перезагружаем страницу только после того, как её об этом попросили
	// кнопкой «Обновить». Первый clients.claim() тоже меняет контроллер — без
	// этой проверки приложение само себя перезагружало на ровном месте.
	let reloading = false;
	const onControllerChange = () => {
		if (reloading || !updateRequested) return;
		reloading = true;
		location.reload();
	};

	// Клик по системному уведомлению просит открыть конкретный экран.
	const onMessage = (event) => {
		if (event.data?.type === 'navigate' && event.data.url) onNavigate?.(event.data.url);
	};

	navigator.serviceWorker?.ready
		.then((registration) => {
			if (registration.waiting) {
				waitingWorker = registration.waiting;
				updateReady.set(true);
			}
			registration.addEventListener('updatefound', () => {
				const next = registration.installing;
				if (!next) return;
				next.addEventListener('statechange', () => {
					// controller есть — значит это обновление, а не первая установка
					if (next.state === 'installed' && navigator.serviceWorker.controller) {
						waitingWorker = next;
						updateReady.set(true);
					}
				});
			});
		})
		.catch(() => {});
	navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange);
	navigator.serviceWorker?.addEventListener('message', onMessage);

	return () => {
		window.removeEventListener('beforeinstallprompt', onBeforeInstall);
		window.removeEventListener('appinstalled', onInstalled);
		navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange);
		navigator.serviceWorker?.removeEventListener('message', onMessage);
	};
}
