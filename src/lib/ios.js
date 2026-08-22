/**
 * Оболочка приложения на iOS.
 *
 * PWA на iPhone ведёт себя как сайт, а не как приложение: резинит вся страница,
 * двойной тап зумит, ссылки наружу выкидывают из standalone обратно в Safari,
 * позиция скролла теряется при «назад», а зона безопасности живёт своей жизнью.
 * Всё это чинится здесь одним местом, чтобы остальной код об этом не думал.
 */
import { browser } from '$app/environment';
import { writable } from 'svelte/store';

/** Открыто с домашнего экрана (не во вкладке Safari). */
export const standalone = writable(false);
/** iOS/iPadOS — там свои правила почти во всём. */
export const isIosDevice = writable(false);

export function detectIos() {
	if (!browser) return false;
	const ua = navigator.userAgent;
	// iPad с iPadOS 13+ представляется как Mac — отличаем по тач-точкам.
	return (
		/iPad|iPhone|iPod/.test(ua) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
	);
}

export function detectStandalone() {
	if (!browser) return false;
	return (
		// navigator.standalone — нестандартное свойство Safari, типов на него нет.
		// @ts-ignore
		window.navigator.standalone === true ||
		window.matchMedia?.('(display-mode: standalone)').matches === true ||
		window.matchMedia?.('(display-mode: fullscreen)').matches === true
	);
}

/** Safari на iOS: только там установка идёт через «Поделиться → На экран «Домой»». */
export function isIosSafari() {
	if (!browser) return false;
	return detectIos() && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/.test(navigator.userAgent);
}

/* ─────────────────────────── тактильный отклик ─────────────────────────── */

/**
 * Короткая вибрация на действие. На iOS Web Vibration API нет — там вызов
 * просто ничего не делает, и это нормально: на Android отклик появится.
 * @param {'light'|'medium'|'heavy'|'select'} kind
 */
export function haptic(kind = 'light') {
	if (!browser) return;
	const pattern = { light: 8, medium: 14, heavy: 22, select: 4 }[kind] ?? 8;
	try {
		navigator.vibrate?.(pattern);
	} catch {
		/* заблокировано настройками — не беда */
	}
}

/* ───────────────────────── позиция прокрутки ───────────────────────── */

const scrollMemory = new Map();

/** Запомнить, где остановился скролл на этом маршруте. */
export function rememberScroll(key, value) {
	scrollMemory.set(key, value);
}

/** Куда вернуть скролл при возврате на маршрут. */
export function recallScroll(key) {
	return scrollMemory.get(key) ?? 0;
}

/* ─────────────────────── жест «назад» от левого края ─────────────────────── */

const EDGE_ZONE = 28; // откуда начинается системный жест на iOS
const TRIGGER_RATIO = 0.32; // сколько ширины надо протянуть, чтобы сработало

/**
 * Svelte-action: свайп от левого края возвращает на предыдущий экран.
 * Страница едет за пальцем, поэтому жест ощущается как в нативном приложении.
 *
 * @param {HTMLElement} node
 * @param {{ enabled?: boolean, onBack?: () => void }} options
 */
export function swipeBack(node, options = {}) {
	let enabled = options.enabled ?? true;
	let onBack = options.onBack ?? (() => history.back());
	let startX = 0;
	let startY = 0;
	let tracking = false;
	let decided = false;

	function reset(animated = true) {
		node.style.transition = animated ? 'transform 0.22s cubic-bezier(0.2,0.8,0.2,1)' : '';
		node.style.transform = '';
		tracking = false;
		decided = false;
	}

	function onStart(event) {
		if (!enabled || event.touches.length !== 1) return;
		const touch = event.touches[0];
		if (touch.clientX > EDGE_ZONE) return;
		startX = touch.clientX;
		startY = touch.clientY;
		tracking = true;
		decided = false;
		node.style.transition = '';
	}

	function onMove(event) {
		if (!tracking) return;
		const touch = event.touches[0];
		const dx = touch.clientX - startX;
		const dy = touch.clientY - startY;
		if (!decided) {
			// Пока не ясно, жест это или вертикальная прокрутка — не мешаем странице.
			if (Math.abs(dy) > Math.abs(dx)) return reset(false);
			if (Math.abs(dx) < 10) return;
			decided = true;
		}
		if (dx <= 0) return;
		event.preventDefault();
		node.style.transform = `translate3d(${dx}px,0,0)`;
	}

	function onEnd(event) {
		if (!tracking) return;
		const dx = (event.changedTouches?.[0]?.clientX ?? startX) - startX;
		const done = dx > node.clientWidth * TRIGGER_RATIO;
		reset(true);
		if (done) {
			haptic('light');
			onBack();
		}
	}

	node.addEventListener('touchstart', onStart, { passive: true });
	node.addEventListener('touchmove', onMove, { passive: false });
	node.addEventListener('touchend', onEnd, { passive: true });
	node.addEventListener('touchcancel', () => reset(true), { passive: true });

	return {
		update(next = {}) {
			enabled = next.enabled ?? true;
			onBack = next.onBack ?? onBack;
		},
		destroy() {
			node.removeEventListener('touchstart', onStart);
			node.removeEventListener('touchmove', onMove);
			node.removeEventListener('touchend', onEnd);
		}
	};
}

/* ──────────────────────────── инициализация ──────────────────────────── */

/**
 * Настроить оболочку под устройство. Зовётся один раз из корневого layout,
 * возвращает функцию отписки.
 */
export function initShell() {
	if (!browser) return () => {};

	const ios = detectIos();
	const root = document.documentElement;
	isIosDevice.set(ios);
	root.classList.toggle('ios', ios);

	const applyStandalone = () => {
		const value = detectStandalone();
		standalone.set(value);
		root.classList.toggle('standalone', value);
		// Отступ под индикатор «домой» нужен только в standalone: в Safari его
		// закрывает собственная панель браузера, и лишний отступ выглядит дырой.
		root.style.setProperty('--safe-bottom', value ? 'env(safe-area-inset-bottom, 0px)' : '0px');
	};
	applyStandalone();

	const displayQuery = window.matchMedia?.('(display-mode: standalone)');
	displayQuery?.addEventListener?.('change', applyStandalone);

	// Двойной тап масштабирует страницу и ломает ощущение приложения.
	let lastTap = 0;
	const onTouchEnd = (event) => {
		const now = Date.now();
		if (now - lastTap < 300) event.preventDefault();
		lastTap = now;
	};
	document.addEventListener('touchend', onTouchEnd, { passive: false });

	// Пинч-зум внутри приложения тоже ни к чему (плеер зумит сам, по-своему).
	const onGesture = (event) => event.preventDefault();
	document.addEventListener('gesturestart', onGesture);

	// В standalone обычная ссылка наружу открывает Safari поверх приложения и
	// «съедает» окно. Уводим такие ссылки в отдельную вкладку явно.
	const onClick = (event) => {
		if (!detectStandalone()) return;
		const link = event.target?.closest?.('a[href]');
		if (!link || link.target === '_blank') return;
		let url;
		try {
			url = new URL(link.href, location.href);
		} catch {
			return;
		}
		if (url.origin === location.origin) return;
		event.preventDefault();
		window.open(url.href, '_blank', 'noopener,noreferrer');
	};
	document.addEventListener('click', onClick);

	return () => {
		displayQuery?.removeEventListener?.('change', applyStandalone);
		document.removeEventListener('touchend', onTouchEnd);
		document.removeEventListener('gesturestart', onGesture);
		document.removeEventListener('click', onClick);
	};
}
