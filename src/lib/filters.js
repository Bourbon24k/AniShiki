/**
 * Тело фильтра каталога Anixart (POST /filter/{page}).
 *
 * Сервер ждёт все ключи разом: если часть пропустить, «жанры» и «исключения»
 * молча игнорируются — именно поэтому поиск по жанрам раньше ничего не менял.
 * Состав полей сверен с официальным клиентом AniX.
 */

export const FILTER_DEFAULT = {
	country: null,
	category_id: null,
	genres: [],
	is_genres_exclude_mode_enabled: false,
	profile_list_exclusions: [],
	types: [],
	studio: null,
	source: null,
	start_year: null,
	end_year: null,
	season: null,
	episodes_from: null,
	episodes_to: null,
	episode_duration_from: null,
	episode_duration_to: null,
	status_id: null,
	age_ratings: [],
	sort: 0
};

/** Полное тело фильтра из частичного набора полей. */
export function buildFilter(patch = {}) {
	return { ...FILTER_DEFAULT, ...patch };
}

export const SORT_OPTIONS = [
	{ value: 0, label: 'По обновлению' },
	{ value: 3, label: 'По популярности' },
	{ value: 1, label: 'По оценке' },
	{ value: 2, label: 'По году' }
];

export const STATUS_OPTIONS = [
	{ value: null, label: 'Любой' },
	{ value: 2, label: 'Онгоинг' },
	{ value: 1, label: 'Завершён' },
	{ value: 3, label: 'Анонс' }
];

export const CATEGORY_OPTIONS = [
	{ value: null, label: 'Любая' },
	{ value: 1, label: 'Сериал' },
	{ value: 2, label: 'Фильм' },
	{ value: 3, label: 'OVA' },
	{ value: 4, label: 'Дорама' }
];

export const SEASON_OPTIONS = [
	{ value: null, label: 'Любой' },
	{ value: 1, label: 'Зима' },
	{ value: 2, label: 'Весна' },
	{ value: 3, label: 'Лето' },
	{ value: 4, label: 'Осень' }
];

export const AGE_RATING_OPTIONS = [
	{ value: 1, label: '0+' },
	{ value: 2, label: '6+' },
	{ value: 3, label: '12+' },
	{ value: 4, label: '16+' },
	{ value: 5, label: '18+' }
];

export const EPISODE_OPTIONS = [
	{ label: 'Неважно', episodes_from: null, episodes_to: null },
	{ label: '1–12', episodes_from: 1, episodes_to: 12 },
	{ label: '13–25', episodes_from: 13, episodes_to: 25 },
	{ label: '26–100', episodes_from: 26, episodes_to: 100 },
	{ label: '100+', episodes_from: 100, episodes_to: null }
];

export const DURATION_OPTIONS = [
	{ label: 'Неважно', episode_duration_from: null, episode_duration_to: null },
	{ label: 'до 10 мин', episode_duration_from: 1, episode_duration_to: 10 },
	{ label: 'до 30 мин', episode_duration_from: 1, episode_duration_to: 30 },
	{ label: 'от 30 мин', episode_duration_from: 30, episode_duration_to: null }
];

export const COUNTRY_OPTIONS = [
	{ value: null, label: 'Любая' },
	{ value: 'Япония', label: 'Япония' },
	{ value: 'Китай', label: 'Китай' },
	{ value: 'Южная Корея', label: 'Южная Корея' }
];

/** Списки профиля, которые можно исключить из выдачи. */
export const LIST_EXCLUSIONS = [
	{ value: 1, label: 'Смотрю' },
	{ value: 2, label: 'В планах' },
	{ value: 3, label: 'Просмотрено' },
	{ value: 4, label: 'Отложено' },
	{ value: 5, label: 'Брошено' }
];
