/**
 * Кэш каталога для главной и обзора.
 *
 * Раньше каждый заход на главную заново дёргал шесть запросов и заново рисовал
 * скелетоны — отсюда и подтормаживания при переходах «главная → релиз → назад».
 * Здесь ответы живут в памяти вкладки и в sessionStorage, отдаются мгновенно и
 * обновляются в фоне (stale-while-revalidate).
 */
import { browser } from '$app/environment';
import { getApi } from './api';
import { buildFilter } from './filters';

const TTL = 10 * 60 * 1000; // свежесть каталога — 10 минут
const PREFIX = 'catalog:';

/** @type {Map<string, { at: number, value: any }>} */
const memory = new Map();
/** @type {Map<string, Promise<any>>} */
const inflight = new Map();

function readStore(key) {
	if (!browser) return null;
	const hit = memory.get(key);
	if (hit) return hit;
	try {
		const raw = sessionStorage.getItem(PREFIX + key);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed.at !== 'number') return null;
		memory.set(key, parsed);
		return parsed;
	} catch {
		return null;
	}
}

function writeStore(key, value) {
	const entry = { at: Date.now(), value };
	memory.set(key, entry);
	try {
		sessionStorage.setItem(PREFIX + key, JSON.stringify(entry));
	} catch {
		// Квота кончилась — память всё равно остаётся, этого достаточно.
	}
}

/**
 * Достать из кэша или загрузить. Протухшее значение отдаётся сразу, а следом
 * тихо обновляется — экран не мигает скелетоном на каждом возврате.
 *
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} loader
 * @param {(value: T) => void} [onRefresh] вызовется, если фоновое обновление принесло новое
 * @returns {Promise<T>}
 */
export async function cached(key, loader, onRefresh) {
	const hit = readStore(key);
	if (hit) {
		if (Date.now() - hit.at > TTL) revalidate(key, loader, onRefresh);
		return hit.value;
	}
	return load(key, loader);
}

function load(key, loader) {
	const running = inflight.get(key);
	if (running) return running;
	const promise = loader()
		.then((value) => {
			writeStore(key, value);
			return value;
		})
		.finally(() => inflight.delete(key));
	inflight.set(key, promise);
	return promise;
}

function revalidate(key, loader, onRefresh) {
	load(key, loader)
		.then((value) => onRefresh?.(value))
		.catch(() => {
			/* обновление в фоне: молча оставляем старое */
		});
}

/** Сбросить кэш каталога (смена эндпоинта, ручное обновление). */
export function clearCatalogCache() {
	memory.clear();
	if (!browser) return;
	try {
		for (const key of Object.keys(sessionStorage)) {
			if (key.startsWith(PREFIX)) sessionStorage.removeItem(key);
		}
	} catch {
		/* игнорируем */
	}
}

/** Одна страница каталога по фильтру, с кэшем по телу фильтра. */
export function catalogPage(patch, page = 0) {
	const key = `filter:${page}:${JSON.stringify(patch)}`;
	return cached(key, async () => {
		const data = await getApi()?.release.filter(page, buildFilter(patch), true);
		return data?.content || [];
	});
}

/** То же, но с колбэком на фоновое обновление. */
export function catalogPageLive(patch, page, onRefresh) {
	const key = `filter:${page}:${JSON.stringify(patch)}`;
	return cached(
		key,
		async () => {
			const data = await getApi()?.release.filter(page, buildFilter(patch), true);
			return data?.content || [];
		},
		onRefresh
	);
}
