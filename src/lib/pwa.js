import { browser } from '$app/environment';
import { writable } from 'svelte/store';

// Установка приложения и обновления service worker.

/** Отложенное событие beforeinstallprompt (Android/desktop Chrome) или null. */
export const installPrompt = writable(null);
/** Приложение уже открыто как установленное. */
export const standalone = writable(false);
/** Скачано обновление и ждёт применения. */
export const updateReady = writable(false);

let waitingWorker = null;

/** Открыто ли из иконки на домашнем экране. */
function isStandalone() {
	if (!browser) return false;
	return (
		window.matchMedia?.('(display-mode: standalone)').matches ||
		window.matchMedia?.('(display-mode: minimal-ui)').matches ||
		// iOS Safari не поддерживает display-mode до 16.4
		window.navigator.standalone === true
	);
}

/** Safari на iPhone/iPad: там нет beforeinstallprompt, нужна инструкция руками. */
export function isIosSafari() {
	if (!browser) return false;
	const ua = navigator.userAgent;
	const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
	return iOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

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
	if (!waitingWorker) {
		location.reload();
		return;
	}
	waitingWorker.postMessage('skip-waiting');
	waitingWorker = null;
	updateReady.set(false);
}

/** Подписки на установку и обновления. Вызывается один раз из корневого layout. */
export function initPwa() {
	if (!browser) return () => {};

	standalone.set(isStandalone());

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

	let reloading = false;
	const onControllerChange = () => {
		if (reloading) return;
		reloading = true;
		location.reload();
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

	return () => {
		window.removeEventListener('beforeinstallprompt', onBeforeInstall);
		window.removeEventListener('appinstalled', onInstalled);
		navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange);
	};
}
