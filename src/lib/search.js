/**
 * Умный поиск по названиям.
 *
 * Anixart ищет подстрокой и почти не прощает ошибок: «наруто шипуден» находит,
 * «наруто шиппуден» — уже нет, а латиница по русскому названию не находит
 * ничего. Поэтому запрос раскладывается на варианты (нормализация,
 * транслитерация, урезание до значащих слов), варианты уходят на сервер
 * параллельно, а выдача склеивается и переупорядочивается по близости к тому,
 * что человек набрал.
 */
import { getApi } from './api';
import { SEARCH_BY } from './anixart';
import { canonicalGenre } from './genres';

/* ─────────────────────────── нормализация ─────────────────────────── */

/** Регистр, «ё», пунктуация и лишние пробелы — всё к одному виду. */
export function normalize(value) {
	return String(value || '')
		.toLowerCase()
		.replace(/ё/g, 'е')
		.replace(/[’'`ʼ]/g, '')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim()
		.replace(/\s+/g, ' ');
}

const RU_TO_LAT = {
	а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'j', з: 'z', и: 'i', й: 'y',
	к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
	ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'y', ь: '',
	э: 'e', ю: 'yu', я: 'ya'
};

// Многобуквенные сочетания идут первыми: иначе «sh» распадётся на «с»+«х».
const LAT_TO_RU = [
	['shi', 'си'], ['chi', 'ти'], ['tsu', 'цу'], ['sh', 'ш'], ['ch', 'ч'], ['ts', 'ц'],
	['yu', 'ю'], ['ya', 'я'], ['yo', 'ё'], ['jo', 'дзё'], ['ju', 'дзю'], ['ja', 'дзя'],
	['zu', 'дзу'], ['ji', 'дзи'], ['ph', 'ф'], ['th', 'т'], ['ck', 'к'], ['ee', 'и'],
	['oo', 'у'], ['a', 'а'], ['b', 'б'], ['c', 'к'], ['d', 'д'], ['e', 'е'], ['f', 'ф'],
	['g', 'г'], ['h', 'х'], ['i', 'и'], ['j', 'дж'], ['k', 'к'], ['l', 'л'], ['m', 'м'],
	['n', 'н'], ['o', 'о'], ['p', 'п'], ['q', 'к'], ['r', 'р'], ['s', 'с'], ['t', 'т'],
	['u', 'у'], ['v', 'в'], ['w', 'в'], ['x', 'кс'], ['y', 'й'], ['z', 'з']
];

/** Кириллица → латиница. */
export function toLatin(value) {
	return normalize(value)
		.split('')
		.map((ch) => (ch in RU_TO_LAT ? RU_TO_LAT[ch] : ch))
		.join('');
}

/** Латиница → кириллица (грубая, но для поиска этого хватает). */
export function toCyrillic(value) {
	let rest = normalize(value);
	let out = '';
	outer: while (rest.length) {
		for (const [lat, ru] of LAT_TO_RU) {
			if (rest.startsWith(lat)) {
				out += ru;
				rest = rest.slice(lat.length);
				continue outer;
			}
		}
		out += rest[0];
		rest = rest.slice(1);
	}
	return out;
}

const hasCyrillic = (value) => /[а-яё]/i.test(value);
const hasLatin = (value) => /[a-z]/i.test(value);

/* ─────────────────────────── похожесть ─────────────────────────── */

/** Расстояние Левенштейна с ранним выходом по порогу. */
function levenshtein(a, b, max = 8) {
	if (a === b) return 0;
	if (!a.length) return b.length;
	if (!b.length) return a.length;
	if (Math.abs(a.length - b.length) > max) return max + 1;
	let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const curr = [i];
		let rowMin = i;
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
			if (curr[j] < rowMin) rowMin = curr[j];
		}
		if (rowMin > max) return max + 1;
		prev = curr;
	}
	return prev[b.length];
}

/** 0…1: насколько строки похожи. */
function ratio(a, b) {
	if (!a || !b) return 0;
	const distance = levenshtein(a, b, Math.max(4, Math.floor(Math.max(a.length, b.length) * 0.4)));
	return 1 - distance / Math.max(a.length, b.length);
}

/** Все написания названия, по которым имеет смысл сравнивать. */
function titleVariants(release) {
	const titles = [
		release?.title_ru,
		release?.title_original,
		release?.title_alt,
		release?.title_en
	].filter(Boolean);
	// title_alt в Anixart — строка с несколькими названиями через « / ».
	return titles
		.flatMap((t) => String(t).split(/\s*[/|]\s*/))
		.map(normalize)
		.filter(Boolean);
}

/**
 * Насколько релиз соответствует запросу. 0 — мимо, ~1 — точное совпадение.
 * Учитывается и русское, и оригинальное название, и транслитерация запроса.
 */
export function relevance(release, query) {
	const q = normalize(query);
	if (!q) return 0;
	const queries = [q];
	if (hasCyrillic(q)) queries.push(toLatin(q));
	if (hasLatin(q)) queries.push(toCyrillic(q));

	const titles = titleVariants(release);
	if (!titles.length) return 0;

	let best = 0;
	for (const title of titles) {
		const latinTitle = hasCyrillic(title) ? toLatin(title) : title;
		for (const candidate of queries) {
			for (const target of new Set([title, latinTitle])) {
				let score = 0;
				if (target === candidate) score = 1;
				else if (target.startsWith(candidate)) score = 0.92 - Math.min(0.2, (target.length - candidate.length) / 120);
				else if (target.includes(candidate)) score = 0.8 - Math.min(0.2, (target.length - candidate.length) / 120);
				else {
					// Пословное совпадение: «клинок демонов» ↔ «клинок, рассекающий демонов».
					const qWords = candidate.split(' ').filter((w) => w.length > 2);
					const tWords = new Set(target.split(' '));
					if (qWords.length) {
						const hits = qWords.filter((w) => tWords.has(w) || target.includes(w)).length;
						score = (hits / qWords.length) * 0.7;
					}
					score = Math.max(score, ratio(candidate, target) * 0.65);
				}
				if (score > best) best = score;
			}
		}
	}
	return best;
}

/* ───────────────────────── варианты запроса ───────────────────────── */

const STOP_WORDS = new Set(['аниме', 'сезон', 'the', 'a', 'смотреть', 'онлайн']);

/** Запросы, которые стоит отправить на сервер, в порядке убывания веса. */
export function queryVariants(raw) {
	const q = normalize(raw);
	if (!q) return [];
	const variants = [q];
	const words = q.split(' ').filter((w) => !STOP_WORDS.has(w));
	const meaningful = words.join(' ');
	if (meaningful && meaningful !== q) variants.push(meaningful);
	// Другая раскладка алфавита — чтобы «naruto» находил «Наруто» и наоборот.
	if (hasCyrillic(q)) variants.push(toLatin(q));
	if (hasLatin(q)) variants.push(toCyrillic(q));
	// Длинный запрос из нескольких слов часто не находится целиком:
	// самое длинное слово почти всегда ключевое.
	if (words.length > 1) {
		const longest = words.slice().sort((a, b) => b.length - a.length)[0];
		if (longest && longest.length >= 4) variants.push(longest);
	}
	return [...new Set(variants)].filter(Boolean).slice(0, 4);
}

/* ─────────────────────────── сам поиск ─────────────────────────── */

const MIN_GOOD_HITS = 6;
const RELEVANCE_FLOOR = 0.28;

/**
 * Поиск релизов по названию с подстраховкой вариантами и переранжированием.
 *
 * @param {string} query
 * @param {{ page?: number, signal?: AbortSignal }} opts
 * @returns {Promise<{ items: any[], franchise: any|null, hasMore: boolean, genre: string|null }>}
 */
export async function smartSearch(query, { page = 0 } = {}) {
	const variants = queryVariants(query);
	if (!variants.length) return { items: [], franchise: null, hasMore: false, genre: null };

	// Ввели название жанра — подсказываем это отдельно, поиск при этом обычный.
	const genre = canonicalGenre(query);

	const primary = await safeSearch(variants[0], page);
	let items = primary.items;
	let franchise = primary.franchise;
	let hasMore = primary.items.length >= 20;

	// Подстраховка нужна только на первой странице: дальше листаем основной запрос.
	const weakHits = items.filter((r) => relevance(r, query) >= RELEVANCE_FLOOR).length;
	if (page === 0 && weakHits < MIN_GOOD_HITS && variants.length > 1) {
		const extra = await Promise.all(variants.slice(1).map((v) => safeSearch(v, 0)));
		const seen = new Set(items.map((r) => r.id));
		for (const result of extra) {
			if (!franchise) franchise = result.franchise;
			for (const item of result.items) {
				if (seen.has(item.id)) continue;
				seen.add(item.id);
				items.push(item);
			}
		}
	}

	return { items: rank(items, query), franchise, hasMore, genre };
}

/** Поиск по жанру/тегу — отдельная ручка Anixart (searchBy = tag). */
export async function searchByTag(tag, page = 0) {
	const api = getApi();
	if (!api) return { items: [], hasMore: false };
	const data = await api.search.releases({ query: tag, page, searchBy: SEARCH_BY.tag });
	const items = data?.releases || data?.content || [];
	return { items, hasMore: items.length >= 20 };
}

async function safeSearch(query, page) {
	try {
		const api = getApi();
		if (!api) return { items: [], franchise: null };
		const data = await api.search.releases({ query, page, searchBy: SEARCH_BY.name });
		const related = data?.related;
		return {
			items: data?.releases || data?.content || [],
			franchise: related?.id && (related.release_count || 0) > 1 ? related : null
		};
	} catch (e) {
		console.error('search', query, e);
		return { items: [], franchise: null };
	}
}

/**
 * Переупорядочить выдачу: сначала близкие по названию, при равной близости —
 * то, что выше оценено и чаще смотрят.
 */
export function rank(items, query) {
	return items
		.map((item) => ({ item, score: relevance(item, query) }))
		.sort((a, b) => {
			if (Math.abs(b.score - a.score) > 0.06) return b.score - a.score;
			const gradeDiff = (Number(b.item.grade) || 0) - (Number(a.item.grade) || 0);
			if (Math.abs(gradeDiff) > 0.25) return gradeDiff;
			return (Number(b.item.favorite_count) || 0) - (Number(a.item.favorite_count) || 0);
		})
		.map((entry) => entry.item);
}

/* ──────────────────────── история запросов ──────────────────────── */

const HISTORY_KEY = 'search_history';
const HISTORY_LIMIT = 12;

export function readHistory() {
	try {
		const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
		return Array.isArray(raw) ? raw.slice(0, HISTORY_LIMIT) : [];
	} catch {
		return [];
	}
}

export function pushHistory(query) {
	const value = String(query || '').trim();
	if (value.length < 2) return readHistory();
	const next = [value, ...readHistory().filter((q) => normalize(q) !== normalize(value))].slice(
		0,
		HISTORY_LIMIT
	);
	try {
		localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
	} catch {
		/* приватный режим */
	}
	return next;
}

export function clearHistory() {
	try {
		localStorage.removeItem(HISTORY_KEY);
	} catch {
		/* игнорируем */
	}
	return [];
}
