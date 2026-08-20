import { getApi } from '$lib/api';
import { get } from 'svelte/store';
import { userToken } from '$lib/stores';
import { listContinue, tasteSeed } from '$lib/sitedata';

// Персональные блоки главной: «Продолжить просмотр» и «Рекомендации».
//
// Важно про Anixart API: /discover/watching — это ГЛОБАЛЬНЫЙ блок «сейчас
// смотрят» (отдаётся даже без токена), а не личный список. Личная история —
// только /history (release.getHistory), она и нужна для «Продолжить просмотр».

const SEED_LIMIT = 5;

async function safe(promise, fallback) {
	try {
		return await promise;
	} catch (e) {
		console.error('personal', e);
		return fallback;
	}
}

/** Ответы приходят как {release: {...}} либо самим релизом. */
function unwrap(list) {
	return (list || []).map((x) => x?.release || x).filter((x) => x && x.id);
}

/**
 * Уже просмотренное/добавленное к себе — такому в подборках не место.
 * Для Anixart признак приходит прямо в релизе (is_viewed, profile_list_status),
 * для аккаунта сайта берётся из tasteSeed().
 */
function isSeen(item, seen) {
	return (
		seen.has(Number(item?.id)) ||
		item?.is_viewed === true ||
		Number(item?.profile_list_status) > 0 ||
		Number(item?.your_vote) > 0
	);
}

/** Релиз из истории Anixart → карточка со ссылкой в плеер и номером серии. */
function toContinueCard(release) {
	const position = Number(release?.last_view_episode?.position) || 0;
	return {
		...release,
		href: position > 0 ? `/player/${release.id}?ep=${position}` : `/player/${release.id}`,
		badge: position > 0 ? `${position} серия` : null
	};
}

/**
 * «Продолжить просмотр» — то, что пользователь реально смотрел.
 * @param {number} limit
 * @returns {Promise<any[]>}
 */
export async function getContinueWatching(limit = 20) {
	const api = getApi();
	if (!api) return [];
	if (get(userToken)) {
		const data = await safe(api.release.getHistory(0), null);
		return unwrap(data?.content).map(toContinueCard).slice(0, limit);
	}
	return listContinue(limit);
}

/**
 * Рекомендации. С аккаунтом Anixart — его собственная выдача один в один.
 * Без него: аккаунт сайта → «похожее» по любимым тайтлам, гость → высокий рейтинг.
 * @param {number} limit
 * @returns {Promise<{ items: any[], personal: boolean }>}
 */
export async function getRecommendations(limit = 24) {
	const api = getApi();
	if (!api) return { items: [], personal: false };

	/** Высокий рейтинг за вычетом того, что человек уже смотрел. */
	const topRated = async (seen = new Set()) => {
		const items = await safe(api.release.filter(0, { sort: 1 }, true).then((r) => unwrap(r?.content)), []);
		return items.filter((item) => !isSeen(item, seen));
	};

	// 1. Anixart отдаёт персональные рекомендации сам — показываем как есть.
	if (get(userToken)) {
		const data = await safe(api.discover.getRecommendations(0), null);
		const items = unwrap(data?.content);
		if (items.length) return { items, personal: true };
		return { items: (await topRated()).slice(0, limit), personal: false };
	}

	const { liked, seen } = await safe(tasteSeed(), { liked: [], seen: new Set() });
	if (!liked.length) return { items: (await topRated(seen)).slice(0, limit), personal: false };

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
			if (isSeen(item, seen)) continue;
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
		const fill = (await topRated(seen)).filter(
			(item) => !items.some((existing) => existing.id === item.id)
		);
		return { items: [...items, ...fill].slice(0, limit), personal: items.length > 0 };
	}
	return { items: items.slice(0, limit), personal: true };
}
