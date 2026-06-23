import { writable } from 'svelte/store';
import { browser } from '$app/environment';

/** localStorage-backed store. */
function persisted(key, defaultValue) {
	let initial = defaultValue;
	if (browser) {
		try {
			const raw = localStorage.getItem(key);
			if (raw != null) initial = JSON.parse(raw);
		} catch {
			initial = defaultValue;
		}
	}
	const store = writable(initial);
	if (browser) {
		store.subscribe((value) => {
			try {
				localStorage.setItem(key, JSON.stringify(value));
			} catch {
				/* quota / private mode */
			}
		});
	}
	return store;
}

/** Токен авторизации: { token, id, login, avatar, status } | null */
export const userToken = persisted('user_token', null);

/** Эндпоинт API. */
export const endpointUrl = persisted('endpointUrl', 'api.anixart.app');

/** Настройки интерфейса. */
export const guiSettings = persisted('guiSettings', {
	theme: 'amoled',
	releaseCardType: 'grid'
});

/** Настройки плеера. */
export const playerSettings = persisted('playerSettings', {
	autoplayEpisode: true,
	defaultAspectRatio: '16-9',
	defaultVolume: 1,
	defaultSpeed: 1,
	saveUserVolume: { enabled: true, lastValue: null },
	hotkeys: {
		playPause: ['Space', 'KeyK'],
		nextEpisode: ['KeyN'],
		prevEpisode: ['KeyB'],
		forward: ['ArrowRight'],
		backward: ['ArrowLeft'],
		mute: ['KeyM'],
		fullscreen: ['KeyF']
	}
});

/** Настройки воспроизведения (источник/качество/история). */
export const playingSettings = persisted('playingSettings', {
	defaultQuality: 1080,
	defaultSource: null,
	disableHistory: false
});

export const firstRun = persisted('first_run', true);

/* ── runtime-only stores ── */
export const notificationCount = writable(0);
export const mobileMenuOpen = writable(false);
export const profileInfo = writable(null);
export const installPrompt = writable(null);
export const toast = writable(null);

/** Показать всплывающее уведомление. */
export function showToast(message, type = 'info', timeout = 3000) {
	toast.set({ message, type, id: Date.now() });
	if (timeout) setTimeout(() => toast.set(null), timeout);
}
