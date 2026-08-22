/**
 * Подборки для главной и обзора.
 *
 * Раньше «рекомендации» были одной строкой: либо выдача Anixart, либо «высокий
 * рейтинг» для всех подряд. Здесь из вкусов человека собирается несколько
 * осмысленных рядов — «потому что вы смотрели X», «ещё экшена», «сезон сейчас»
 * — а гостю показывается витрина, которая хотя бы меняется день ото дня.
 */
import { get } from 'svelte/store';
import { getApi } from './api';
import { userToken } from './stores';
import { catalogPage } from './catalog';
import { FEATURED_GENRES } from './genres';
import { tasteSeed } from './sitedata';

const ROW_LIMIT = 20;

/** Ответы приходят как {release: {...}} либо самим релизом. */
function unwrap(list) {
	return (list || []).map((x) => x?.release || x).filter((x) => x && x.id);
}

async function safe(promise, fallback) {
	try {
		return await promise;
	} catch (e) {
		console.error('picks', e);
		return fallback;
	}
}

/** Текущий сезон по календарю: 1 — зима, 2 — весна, 3 — лето, 4 — осень. */
export function currentSeason() {
	const month = new Date().getMonth();
	if (month <= 1 || month === 11) return 1;
	if (month <= 4) return 2;
	if (month <= 7) return 3;
	return 4;
}

const SEASON_NAMES = { 1: 'Зимний', 2: 'Весенний', 3: 'Летний', 4: 'Осенний' };

/**
 * Вкусы пользователя: любимые жанры и то, что он уже смотрел.
 * У Anixart они посчитаны на сервере (preferred_genres), у аккаунта сайта —
 * собираются из списков через tasteSeed().
 *
 * @returns {Promise<{ genres: string[], seen: Set<number>, liked: number[] }>}
 */
export async function tasteProfile() {
	const api = getApi();
	const token = get(userToken);
	if (api && token?.id) {
		const data = await safe(api.profile.info(Number(token.id)), null);
		const profile = data?.profile;
		if (profile) {
			const genres = [
				...(profile.preferred_genres || []),
				...(profile.preferred_themes || [])
			]
				.filter((g) => g?.name)
				.sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
				.map((g) => g.name);
			const seen = new Set(unwrap(profile.history).map((r) => Number(r.id)));
			const liked = unwrap(profile.votes)
				.filter((r) => Number(r.your_vote ?? r.vote ?? 0) >= 4)
				.map((r) => Number(r.id));
			return { genres: [...new Set(genres)], seen, liked };
		}
	}
	const { liked, seen } = await safe(tasteSeed(), { liked: [], seen: new Set() });
	return { genres: [], seen: seen instanceof Set ? seen : new Set(), liked: liked || [] };
}

/** Уже в списках/истории — в подборке такому не место. */
function unseen(items, seen) {
	return items.filter(
		(item) =>
			item &&
			item.id &&
			!seen.has(Number(item.id)) &&
			item.is_viewed !== true &&
			!(Number(item.profile_list_status) > 0)
	);
}

/** Ряд подборки. @returns {{ id: string, title: string, subtitle?: string, href?: string, items: any[] }} */
function row(id, title, items, extra = {}) {
	return { id, title, items: items.slice(0, ROW_LIMIT), ...extra };
}

/**
 * Готовые ряды подборок. Персональные, если есть чем персонализировать,
 * иначе — витрина «на любой вкус», стабильная в пределах суток.
 *
 * @param {{ max?: number }} opts
 * @returns {Promise<Array<{id: string, title: string, subtitle?: string, href?: string, items: any[]}>>}
 */
export async function buildPicks({ max = 6 } = {}) {
	const api = getApi();
	if (!api) return [];

	const taste = await tasteProfile();
	const year = new Date().getFullYear();
	const season = currentSeason();
	const rows = [];

	// 1. Сезон, который идёт прямо сейчас — самое живое, что можно показать.
	const seasonal = await safe(
		catalogPage({ sort: 3, season, start_year: year, end_year: year }),
		[]
	);
	if (seasonal.length) {
		rows.push(
			row('season', `${SEASON_NAMES[season]} сезон ${year}`, unseen(seasonal, taste.seen), {
				subtitle: 'Выходит прямо сейчас',
				href: `/search?season=${season}&year=${year}`
			})
		);
	}

	// 2. «Потому что вы смотрели…» — от конкретного тайтла, а не абстрактно.
	if (taste.liked.length) {
		const seedId = taste.liked[Math.floor(Math.random() * Math.min(taste.liked.length, 5))];
		const seed = await safe(api.release.info(seedId, true).then((d) => d?.release), null);
		const similar = unseen(
			unwrap([...(seed?.recommended_releases || []), ...(seed?.related_releases || [])]),
			taste.seen
		);
		if (seed && similar.length >= 4) {
			rows.push(
				row('similar', `Похоже на «${seed.title_ru || seed.title_original}»`, similar, {
					subtitle: 'Потому что вам это понравилось',
					href: `/release/${seed.id}`
				})
			);
		}
	}

	// 3. Любимые жанры — по одному ряду на жанр.
	const genres = taste.genres.length ? taste.genres : dailyGenres(2);
	for (const genre of genres.slice(0, 2)) {
		const items = await safe(catalogPage({ sort: 3, genres: [genre] }), []);
		const fresh = unseen(items, taste.seen);
		if (fresh.length >= 4) {
			rows.push(
				row(`genre:${genre}`, capitalize(genre), fresh, {
					subtitle: taste.genres.length ? 'Вы часто это смотрите' : 'Жанр дня',
					href: `/search?genre=${encodeURIComponent(genre)}`
				})
			);
		}
	}

	// 4. Проверенная классика — то, что стоит посмотреть хоть раз.
	const classics = await safe(catalogPage({ sort: 1, end_year: year - 5 }), []);
	const freshClassics = unseen(classics, taste.seen);
	if (freshClassics.length >= 4) {
		rows.push(
			row('classics', 'Классика, мимо которой прошли', freshClassics, {
				subtitle: 'Высокие оценки, вышло давно'
			})
		);
	}

	// 5. Короткие тайтлы — «на один вечер».
	const shorts = await safe(catalogPage({ sort: 1, episodes_from: 1, episodes_to: 12 }), []);
	const freshShorts = unseen(shorts, taste.seen);
	if (freshShorts.length >= 4) {
		rows.push(row('shorts', 'На один вечер', freshShorts, { subtitle: 'До 12 серий' }));
	}

	return rows.slice(0, max);
}

/** Коллекции Anixart для витрины «Подборки недели». */
export async function popularCollections(limit = 12) {
	const api = getApi();
	if (!api) return [];
	const data = await safe(api.collection.all(0, 2), null);
	return (data?.content || []).slice(0, limit);
}

/** Два жанра «на сегодня» — одинаковые в пределах суток, но разные день ото дня. */
function dailyGenres(count) {
	const day = Math.floor(Date.now() / 86400000);
	return Array.from({ length: count }, (_, i) => FEATURED_GENRES[(day + i * 7) % FEATURED_GENRES.length]);
}

function capitalize(value) {
	const s = String(value || '');
	return s.charAt(0).toUpperCase() + s.slice(1);
}
