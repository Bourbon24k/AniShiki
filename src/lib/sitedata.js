import { get } from 'svelte/store';
import { supabase } from '$lib/supabase';
import { siteSession } from '$lib/stores/auth';

// Избранное и история для аккаунта сайта (Supabase). Используются, когда
// пользователь вошёл через сайт (нет/не используется аккаунт Anixart).

function uid() {
	return get(siteSession)?.user?.id || null;
}

/** Привести строку из БД к форме, понятной AnimeCard. */
function toCard(row) {
	return { id: row.release_id, title_ru: row.title, image: row.image };
}

export async function listFavorites() {
	if (!supabase || !uid()) return [];
	const { data } = await supabase
		.from('favorites')
		.select('*')
		.order('created_at', { ascending: false });
	return (data || []).map(toCard);
}

export async function isFavorite(releaseId) {
	if (!supabase || !uid()) return false;
	const { data } = await supabase
		.from('favorites')
		.select('release_id')
		.eq('user_id', uid())
		.eq('release_id', releaseId)
		.maybeSingle();
	return !!data;
}

export async function addFavorite(release) {
	if (!supabase || !uid()) throw new Error('Нет аккаунта');
	const { error } = await supabase.from('favorites').upsert({
		user_id: uid(),
		release_id: release.id,
		title: release.title_ru || release.title || null,
		image: release.image || null
	});
	if (error) throw error;
}

export async function removeFavorite(releaseId) {
	if (!supabase || !uid()) return;
	await supabase.from('favorites').delete().eq('user_id', uid()).eq('release_id', releaseId);
}

export async function listHistory() {
	if (!supabase || !uid()) return [];
	const { data } = await supabase
		.from('history')
		.select('*')
		.order('updated_at', { ascending: false });
	return (data || []).map(toCard);
}

/** Сохранить/обновить позицию просмотра. */
export async function saveHistory(release, { episodePosition, sourceId, dubberId } = {}) {
	if (!supabase || !uid()) return;
	await supabase.from('history').upsert({
		user_id: uid(),
		release_id: release.id,
		title: release.title_ru || release.title || null,
		image: release.image || null,
		episode_position: episodePosition ?? null,
		source_id: sourceId ?? null,
		dubber_id: dubberId ?? null,
		updated_at: new Date().toISOString()
	});
}
