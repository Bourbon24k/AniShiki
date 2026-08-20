import { get } from 'svelte/store';
import { supabase } from '$lib/supabase';
import { siteSession } from '$lib/stores/auth';

// Публичный профиль аккаунта сайта: то, что видно постороннему.
// История просмотра сюда не входит — она закрыта политикой «только своё».

function uid() {
	return get(siteSession)?.user?.id || null;
}

/** id аккаунта сайта — uuid; у Anixart он числовой. По этому и различаем маршрут. */
export function isSiteId(value) {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function toCard(row) {
	return { id: row.release_id, title_ru: row.title, image: row.image };
}

/**
 * Профиль пользователя сайта со списками, оценками и избранным.
 * @param {string} userId
 */
export async function getSiteProfile(userId) {
	if (!supabase || !userId) return null;
	const { data: profile } = await supabase
		.from('profiles')
		.select('id, username, avatar_url, created_at')
		.eq('id', userId)
		.maybeSingle();
	if (!profile) return null;

	const [lists, ratings, favorites] = await Promise.all([
		supabase.from('lists').select('*').eq('user_id', userId).order('updated_at', { ascending: false }),
		supabase.from('ratings').select('*').eq('user_id', userId).order('updated_at', { ascending: false }),
		supabase.from('favorites').select('*').eq('user_id', userId).order('created_at', { ascending: false })
	]);

	const listRows = lists.data || [];
	const ratingRows = ratings.data || [];
	const favoriteRows = favorites.data || [];

	const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
	for (const row of listRows) counts[row.status] = (counts[row.status] || 0) + 1;

	const votes = ratingRows.map((r) => r.vote).filter(Boolean);
	const avgRating = votes.length ? votes.reduce((a, b) => a + b, 0) / votes.length : 0;

	return {
		id: profile.id,
		username: profile.username || 'Пользователь',
		avatar: profile.avatar_url,
		registeredAt: profile.created_at,
		isMine: profile.id === uid(),
		counts,
		favoriteCount: favoriteRows.length,
		ratedCount: ratingRows.length,
		avgRating: Math.round(avgRating * 10) / 10,
		byStatus: (status) => listRows.filter((r) => r.status === status).map(toCard),
		favorites: favoriteRows.map(toCard),
		rated: ratingRows.map((r) => ({ ...toCard(r), vote: r.vote }))
	};
}
