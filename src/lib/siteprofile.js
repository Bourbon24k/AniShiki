import { get } from 'svelte/store';
import { supabase } from '$lib/supabase';
import { siteSession } from '$lib/stores/auth';
import { canonicalGenre, genreGroup } from '$lib/genres';

/**
 * Публичный профиль аккаунта сайта — по объёму тот же, что у Anixart:
 * статус, соцсети, приватность, кольцо списков, любимые жанры, время
 * просмотра, динамика по дням, оценки с датами и недавно просмотренное.
 *
 * Что видно постороннему, решает приватность владельца (is_stats_hidden /
 * is_social_hidden) — ровно как в Anixart. Закрытые блоки не приходят с
 * сервера вовсе: политики в БД проверяют тот же флаг.
 */

function uid() {
	return get(siteSession)?.user?.id || null;
}

/** id аккаунта сайта — uuid; у Anixart он числовой. По этому и различаем маршрут. */
export function isSiteId(value) {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
		String(value || '')
	);
}

function toCard(row) {
	return { id: row.release_id, title_ru: row.title, image: row.image };
}

/** Пользователь считается «в сети», если отметка активности свежее пяти минут. */
function isOnline(lastActiveAt) {
	const ms = Date.parse(lastActiveAt || '');
	return Number.isFinite(ms) && Date.now() - ms < 5 * 60 * 1000;
}

/**
 * Любимые жанры по строкам списков, оценок и избранного.
 *
 * Считаем доли так же, как их показывает Anixart: процент от всех
 * упоминаний жанра, а не от числа тайтлов. Оценка от 8 и избранное весят
 * вдвое — иначе «в планах» перевешивает то, что человек действительно любит.
 */
function preferredGenres(sources) {
	const tally = new Map();
	let total = 0;
	for (const { rows, weight } of sources) {
		for (const row of rows || []) {
			for (const raw of String(row.genres || '').split(',')) {
				const name = canonicalGenre(raw);
				if (!name) continue;
				tally.set(name, (tally.get(name) || 0) + weight);
				total += weight;
			}
		}
	}
	if (!total) return [];
	// Доля считается внутри своей группы, а не от всех упоминаний сразу: иначе
	// проценты в строке «Жанры» размывались тегами аудитории и тематики и
	// выглядели втрое меньше тех же цифр у Anixart.
	const groups = new Map();
	const groupTotals = new Map();
	for (const [name, count] of tally) {
		const group = genreGroup(name) || 'Жанры';
		if (!groups.has(group)) groups.set(group, []);
		groups.get(group).push({ name, count });
		groupTotals.set(group, (groupTotals.get(group) || 0) + count);
	}
	for (const [group, items] of groups) {
		const groupTotal = groupTotals.get(group) || 1;
		for (const item of items) item.percentage = Math.round((item.count / groupTotal) * 100);
	}
	// Порядок групп фиксируем, чтобы блок не прыгал между загрузками.
	return ['Жанры', 'Аудитория', 'Тематика']
		.filter((label) => groups.has(label))
		.map((label) => ({
			label,
			items: groups
				.get(label)
				.sort((a, b) => b.percentage - a.percentage)
				.filter((i) => i.percentage > 0)
				.slice(0, 4)
		}))
		.filter((group) => group.items.length);
}

/**
 * Профиль пользователя сайта.
 * @param {string} userId
 */
export async function getSiteProfile(userId) {
	if (!supabase || !userId) return null;
	const { data: profile } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', userId)
		.maybeSingle();
	if (!profile) return null;

	const mine = profile.id === uid();
	const statsHidden = Boolean(profile.is_stats_hidden) && !mine;

	const [lists, ratings, favorites, history, activity, collections, historyTotal, friends] =
		await Promise.all([
			supabase
				.from('lists')
				.select('*')
				.eq('user_id', userId)
				.order('updated_at', { ascending: false }),
			supabase
				.from('ratings')
				.select('*')
				.eq('user_id', userId)
				.order('updated_at', { ascending: false }),
			supabase
				.from('favorites')
				.select('*')
				.eq('user_id', userId)
				.order('created_at', { ascending: false }),
			statsHidden
				? { data: [] }
				: supabase
						.from('history')
						.select('*')
						.eq('user_id', userId)
						.order('updated_at', { ascending: false })
						.limit(200),
			statsHidden
				? { data: [] }
				: supabase
						.from('activity')
						.select('created_at')
						.eq('user_id', userId)
						.eq('type', 'watch')
						.gte('created_at', new Date(Date.now() - 31 * 86400000).toISOString())
						.limit(1000),
			supabase.from('collections').select('id').eq('user_id', userId),
			// Историю берём страницей, поэтому её счётчик считаем отдельно — иначе
			// он молча упирался бы в лимит выборки.
			statsHidden
				? { count: 0 }
				: supabase
						.from('history')
						.select('release_id', { count: 'exact', head: true })
						.eq('user_id', userId),
			supabase
				.from('friendships')
				.select('requester, addressee')
				.eq('status', 'accepted')
				.or(`requester.eq.${userId},addressee.eq.${userId}`)
		]);

	const listRows = lists.data || [];
	const ratingRows = ratings.data || [];
	const favoriteRows = favorites.data || [];
	const historyRows = history.data || [];

	const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
	for (const row of listRows) counts[row.status] = (counts[row.status] || 0) + 1;

	const votes = ratingRows.map((r) => r.vote).filter(Boolean);
	const avgRating = votes.length ? votes.reduce((a, b) => a + b, 0) / votes.length : 0;

	// Время просмотра в минутах — в той же единице, что ждёт formatWatchTime.
	// Берём накопитель watched_seconds, а не seconds: seconds — это позиция в
	// текущей серии, плеер её перезаписывает, и сумма по релизам давала пару
	// часов даже тому, кто посмотрел сотни серий.
	const watchedMinutes = Math.round(
		historyRows.reduce((sum, r) => sum + (Number(r.watched_seconds) || 0), 0) / 60
	);
	const watchedEpisodes = historyRows.reduce(
		(sum, r) => sum + (Number(r.episode_position) || 1),
		0
	);

	return {
		id: profile.id,
		username: profile.username || 'Пользователь',
		avatar: profile.avatar_url,
		status: profile.status,
		registeredAt: profile.created_at,
		lastActiveAt: profile.last_active_at,
		isOnline: isOnline(profile.last_active_at),
		isMine: mine,
		isVerified: Boolean(profile.is_verified),
		isSponsor: Boolean(profile.is_sponsor),
		statsHidden,
		socialHidden: Boolean(profile.is_social_hidden) && !mine,
		countsHidden: Boolean(profile.is_counts_hidden) && !mine,
		friendRequestsDisallowed: Boolean(profile.is_friend_requests_disallowed),
		socials: {
			vk: profile.vk_page,
			tg: profile.tg_page,
			tt: profile.tt_page,
			inst: profile.inst_page,
			discord: profile.discord_page
		},
		counts,
		favoriteCount: favoriteRows.length,
		ratedCount: ratingRows.length,
		collectionCount: (collections.data || []).length,
		friendCount: (friends.data || []).length,
		historyCount: historyTotal.count ?? historyRows.length,
		watchedMinutes,
		watchedEpisodes,
		avgRating: Math.round(avgRating * 10) / 10,
		preferred: preferredGenres([
			{ rows: ratingRows.filter((r) => r.vote >= 8), weight: 2 },
			{ rows: favoriteRows, weight: 2 },
			{ rows: listRows, weight: 1 },
			{ rows: ratingRows.filter((r) => r.vote < 8), weight: 1 }
		]),
		// Динамика: по одной записи активности на просмотренную серию.
		dailyWatch: (activity.data || []).map((a) => ({
			ms: Date.parse(a.created_at),
			count: 1
		})),
		byStatus: (status) => listRows.filter((r) => r.status === status).map(toCard),
		favorites: favoriteRows.map(toCard),
		rated: ratingRows.map((r) => ({
			...toCard(r),
			vote: r.vote,
			ratedAt: r.updated_at
		})),
		history: historyRows.map((r) => {
			const position = Number(r.episode_position) || 0;
			const total = Number(r.episodes_total) || 0;
			return {
				id: r.release_id,
				title_ru: r.title,
				image: r.image,
				href: position > 0 ? `/player/${r.release_id}?ep=${position}` : `/release/${r.release_id}`,
				badge:
					position > 0 ? (total ? `${position} серия из ${total}` : `${position} серия`) : null,
				progress: position > 0 && total ? Math.min(100, (position / total) * 100) : 0
			};
		})
	};
}
