import { getApi } from '$lib/api';
import { get } from 'svelte/store';
import { userToken } from '$lib/stores';
import { tasteSeed } from '$lib/sitedata';

// Рекомендации для главной и «Обзора».
// • Аккаунт Anixart — готовая персональная выдача API.
// • Аккаунт сайта — собираем из «похожего» для тайтлов, которые человек оценил,
//   добавил в избранное или смотрел: чем чаще тайтл встречается в таких списках,
//   тем выше он в подборке. Всё уже виденное отсеиваем.
// • Гость — просто высокий рейтинг.

const SEED_LIMIT = 5; // сколько тайтлов разбираем (по запросу на каждый)

async function safe(promise, fallback) {
	try {
		return await promise;
	} catch (e) {
		console.error('recommend', e);
		return fallback;
	}
}

/** Ответы Anixart приходят как {release: {...}} либо самим релизом. */
function unwrap(list) {
	return (list || []).map((x) => x?.release || x).filter((x) => x && x.id);
}

/**
 * Подборка для блока «Рекомендации».
 * @param {number} limit
 * @returns {Promise<{ items: any[], personal: boolean }>}
 */
export async function getRecommendations(limit = 24) {
	const api = getApi();
	if (!api) return { items: [], personal: false };

	const topRated = () =>
		safe(api.release.filter(0, { sort: 1 }, true).then((r) => unwrap(r?.content)), []);

	// 1. Anixart отдаёт персональные рекомендации сам.
	if (get(userToken)) {
		const items = await safe(api.discover.getRecommendations(0).then((r) => unwrap(r?.content)), []);
		if (items.length) return { items: items.slice(0, limit), personal: true };
		return { items: (await topRated()).slice(0, limit), personal: false };
	}

	// 2. Аккаунт сайта: строим из «похожего» для любимых тайтлов.
	const { liked, seen } = await safe(tasteSeed(), { liked: [], seen: new Set() });
	if (!liked.length) return { items: (await topRated()).slice(0, limit), personal: false };

	const infos = await Promise.all(
		liked.slice(0, SEED_LIMIT).map((id) => safe(api.release.info(id, true).then((d) => d?.release), null))
	);

	const tally = new Map();
	for (const release of infos) {
		const similar = unwrap([
			...(release?.recommended_releases || []),
			...(release?.related_releases || [])
		]);
		for (const item of similar) {
			if (seen.has(Number(item.id))) continue;
			const entry = tally.get(item.id);
			if (entry) entry.hits += 1;
			else tally.set(item.id, { item, hits: 1 });
		}
	}

	const items = [...tally.values()]
		.sort((a, b) => b.hits - a.hits || (Number(b.item.grade) || 0) - (Number(a.item.grade) || 0))
		.map((entry) => entry.item);

	if (items.length < 6) {
		// «Похожего» почти не нашлось — дополняем высоким рейтингом.
		const fill = (await topRated()).filter(
			(item) => !seen.has(Number(item.id)) && !items.some((existing) => existing.id === item.id)
		);
		const merged = [...items, ...fill].slice(0, limit);
		return { items: merged, personal: items.length > 0 };
	}
	return { items: items.slice(0, limit), personal: true };
}
