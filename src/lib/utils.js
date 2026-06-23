/**
 * Вспомогательные функции и справочники AniShiki.
 * Портировано из Bourbon24k/AniShiki (GPL-2.0).
 */

export const seasons = [null, 'Зима', 'Весна', 'Лето', 'Осень'];

export const endpointValues = [
	{ label: 'api.anixart.app', value: 'api.anixart.app' },
	{ label: 'api-s.anixsekai.com', value: 'api-s.anixsekai.com' }
];

export const themeValues = [
	{ label: 'AMOLED (чёрная)', value: 'amoled' },
	{ label: 'Тёмная', value: 'dark' },
	{ label: 'Светлая', value: 'light' }
];

export const bookmarkSortValues = [
	{ label: 'По дате: сначала новые', value: 1 },
	{ label: 'По дате: сначала старые', value: 2 },
	{ label: 'По году: сначала новые', value: 3 },
	{ label: 'По году: сначала старые', value: 4 },
	{ label: 'A → Z', value: 5 },
	{ label: 'Z → A', value: 6 }
];

export const privacyOptions = [
	{ label: 'Никто', value: 2 },
	{ label: 'Только друзья', value: 1 },
	{ label: 'Все пользователи', value: 0 }
];

export const sourceValues = [
	{ label: 'Не выбран', value: null },
	{ label: 'Kodik', value: 0 },
	{ label: 'Libria', value: 1 },
	{ label: 'Sibnet', value: 2 }
];

export const qualityValues = [
	{ label: '1080p', value: 1080 },
	{ label: '720p', value: 720 },
	{ label: '480p', value: 480 },
	{ label: '360p', value: 360 }
];

export const aspectRatioValues = [
	{ label: '16:9', value: '16-9' },
	{ label: '4:3', value: '4-3' },
	{ label: 'Fit', value: 'fit' }
];

export const playerSpeedValues = [
	{ label: '0.5x', value: 0.5 },
	{ label: '1x', value: 1.0 },
	{ label: '1.25x', value: 1.25 },
	{ label: '1.5x', value: 1.5 },
	{ label: '2x', value: 2.0 }
];

export const collectionSortValues = [
	{ label: 'В закладках', value: 0 },
	{ label: 'Лидеры рейтинга', value: 1 },
	{ label: 'Популярные за год', value: 2 },
	{ label: 'Популярные за сезон', value: 3 },
	{ label: 'Популярные за неделю', value: 4 },
	{ label: 'Недавно добавленные', value: 5 },
	{ label: 'Случайные', value: 6 }
];

/** Типы каталога для главной/поиска (status_id / category_id для release.filter). */
export const releaseTypes = [
	{ id: 0, label: 'Последние', filter: { sort: 0 } },
	{ id: 5, label: 'Популярные', filter: { sort: 1 } },
	{ id: 1, label: 'Онгоинги', filter: { sort: 0, status_id: 2 } },
	{ id: 2, label: 'Анонсы', filter: { sort: 0, status_id: 3 } },
	{ id: 3, label: 'Завершённые', filter: { sort: 0, status_id: 1 } },
	{ id: 4, label: 'Фильмы', filter: { sort: 0, category_id: 2 } }
];

export function getNumericWord(number, words) {
	const cases = [2, 0, 1, 1, 1, 2];
	return words[
		number % 100 > 4 && number % 100 < 20 ? 2 : cases[number % 10 < 5 ? number % 10 : 5]
	];
}

export function returnEpisodeString(anime) {
	let released = anime?.episodes_released;
	let total = anime?.episodes_total;
	if (total == null && released == null) return '?';
	if (total == null) total = '?';
	if (released == null) released = '?';
	if (total === released) return String(total);
	return `${released} из ${total}`;
}

export function getAgeRate(rate) {
	switch (rate) {
		case 2:
			return '6+';
		case 3:
			return '12+';
		case 4:
			return '16+';
		case 5:
			return '18+';
		case 1:
		default:
			return '0+';
	}
}

export function getStatusInfo(status) {
	switch (status?.id) {
		case 1:
			return { text: 'Завершён', color: 'var(--completed-color)' };
		case 2:
			return { text: 'Онгоинг', color: 'var(--watching-color)' };
		case 3:
			return { text: 'Анонс', color: 'var(--plan-color)' };
		default:
			return { text: status?.name || '', color: 'var(--gray-btn)' };
	}
}

export function getShortDate(timestamp) {
	const d = new Date(timestamp * 1000);
	const dd = String(d.getDate()).padStart(2, '0');
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	return `${dd}.${mm}`;
}

export function returnTimeString(time, showYear = false) {
	const d = new Date(time);
	const mm = String(d.getMinutes()).padStart(2, '0');
	return `${d.getDate()} ${d.toLocaleString('ru-RU', { month: 'short' })} ${
		showYear ? d.getFullYear() : ''
	} в ${d.getHours()}:${mm}`;
}

/** Секунды → MM:SS или HH:MM:SS. */
export function returnFormatedTime(time) {
	if (!Number.isFinite(time) || time < 0) time = 0;
	const h = Math.floor(time / 3600);
	const m = Math.floor((time % 3600) / 60);
	const s = Math.floor(time % 60);
	const pad = (x) => String(x).padStart(2, '0');
	return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function returnSoonText(release) {
	if (release?.aired_on_date) {
		const d = new Date(release.aired_on_date * 1000);
		return `${d.getDate()} ${d.toLocaleDateString('ru-RU', { month: 'short' })} ${d.getFullYear()}`;
	}
	if (release?.year) {
		return `${seasons[release.season] ? `${seasons[release.season]}, ` : ''}${release.year} г.`;
	}
	return 'Скоро';
}

/** Время просмотра (в минутах) → { days, hours, minutes, short, long }. */
export function formatWatchTime(totalMinutes) {
	const m = Math.max(0, Math.floor(totalMinutes || 0));
	const days = Math.floor(m / 1440);
	const hours = Math.floor((m % 1440) / 60);
	const minutes = m % 60;
	const parts = [];
	if (days) parts.push(`${days} ${getNumericWord(days, ['день', 'дня', 'дней'])}`);
	if (hours) parts.push(`${hours} ${getNumericWord(hours, ['час', 'часа', 'часов'])}`);
	if (!days && minutes) parts.push(`${minutes} ${getNumericWord(minutes, ['минута', 'минуты', 'минут'])}`);
	// Краткая форма для большой карточки: ведущая единица + значение.
	let value, unit;
	if (days) {
		value = days;
		unit = getNumericWord(days, ['день', 'дня', 'дней']);
	} else if (hours) {
		value = hours;
		unit = getNumericWord(hours, ['час', 'часа', 'часов']);
	} else {
		value = minutes;
		unit = getNumericWord(minutes, ['минута', 'минуты', 'минут']);
	}
	return {
		days,
		hours,
		minutes,
		value,
		unit,
		long: parts.length ? parts.join(' ') : '0 минут'
	};
}

/** Число с разделителями тысяч (ru). */
export function fmtNum(n) {
	return (n || 0).toLocaleString('ru-RU');
}

/** Список жанров строкой → массив. */
export function parseGenres(genres, limit = 6) {
	if (!genres) return [];
	if (Array.isArray(genres))
		return genres.slice(0, limit).map((g) => g?.name || g).filter(Boolean);
	return String(genres)
		.split(',')
		.map((g) => g.trim())
		.filter(Boolean)
		.slice(0, limit);
}
