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

/** Сохранить/обновить позицию просмотра (включая точную секунду). */
export async function saveHistory(release, { episodePosition, sourceId, dubberId, seconds, duration } = {}) {
	if (!supabase || !uid()) return;
	const row = {
		user_id: uid(),
		release_id: release.id,
		title: release.title_ru || release.title || null,
		image: release.image || null,
		episode_position: episodePosition ?? null,
		source_id: sourceId ?? null,
		dubber_id: dubberId ?? null,
		updated_at: new Date().toISOString()
	};
	if (seconds != null) row.seconds = Math.floor(seconds);
	if (duration != null) row.duration = Math.floor(duration);
	await supabase.from('history').upsert(row);
}

/** Запись истории по релизу (для «продолжить с секунды»). */
export async function getHistoryEntry(releaseId) {
	if (!supabase || !uid()) return null;
	const { data } = await supabase
		.from('history')
		.select('*')
		.eq('user_id', uid())
		.eq('release_id', releaseId)
		.maybeSingle();
	return data || null;
}

/** «Продолжить просмотр» — записи с ненулевой позицией. */
export async function listContinue() {
	if (!supabase || !uid()) return [];
	const { data } = await supabase
		.from('history')
		.select('*')
		.gt('seconds', 0)
		.order('updated_at', { ascending: false })
		.limit(20);
	return (data || []).map(toCard);
}

// ── Списки по статусам (1 смотрю,2 в планах,3 просмотрено,4 отложено,5 брошено) ──

export async function getListStatus(releaseId) {
	if (!supabase || !uid()) return 0;
	const { data } = await supabase
		.from('lists')
		.select('status')
		.eq('user_id', uid())
		.eq('release_id', releaseId)
		.maybeSingle();
	return data?.status || 0;
}

export async function setListStatus(release, status) {
	if (!supabase || !uid()) throw new Error('Нет аккаунта');
	if (!status) {
		await supabase.from('lists').delete().eq('user_id', uid()).eq('release_id', release.id);
		return;
	}
	const { error } = await supabase.from('lists').upsert({
		user_id: uid(),
		release_id: release.id,
		status,
		title: release.title_ru || release.title || null,
		image: release.image || null,
		updated_at: new Date().toISOString()
	});
	if (error) throw error;
}

export async function listByStatus(status) {
	if (!supabase || !uid()) return [];
	const { data } = await supabase
		.from('lists')
		.select('*')
		.eq('status', status)
		.order('updated_at', { ascending: false });
	return (data || []).map(toCard);
}

/** Счётчики по статусам + избранное + история (для профиля). */
export async function counts() {
	if (!supabase || !uid()) return {};
	const tally = { fav: 0, hist: 0, rated: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
	const [lists, fav, hist, rated] = await Promise.all([
		supabase.from('lists').select('status'),
		supabase.from('favorites').select('release_id'),
		supabase.from('history').select('release_id'),
		supabase.from('ratings').select('release_id')
	]);
	for (const r of lists.data || []) tally[r.status] = (tally[r.status] || 0) + 1;
	tally.fav = (fav.data || []).length;
	tally.hist = (hist.data || []).length;
	tally.rated = (rated.data || []).length;
	return tally;
}

// ── Оценки (1..10) ──

export async function getRating(releaseId) {
	if (!supabase || !uid()) return 0;
	const { data } = await supabase
		.from('ratings')
		.select('vote')
		.eq('user_id', uid())
		.eq('release_id', releaseId)
		.maybeSingle();
	return data?.vote || 0;
}

export async function setRating(release, vote) {
	if (!supabase || !uid()) throw new Error('Нет аккаунта');
	if (!vote) {
		await supabase.from('ratings').delete().eq('user_id', uid()).eq('release_id', release.id);
		return;
	}
	const { error } = await supabase.from('ratings').upsert({
		user_id: uid(),
		release_id: release.id,
		vote,
		title: release.title_ru || release.title || null,
		image: release.image || null,
		updated_at: new Date().toISOString()
	});
	if (error) throw error;
}

// ── Профиль ──

export async function updateProfile({ username, avatar_url } = {}) {
	if (!supabase || !uid()) throw new Error('Нет аккаунта');
	const patch = {};
	if (username != null) patch.username = username;
	if (avatar_url !== undefined) patch.avatar_url = avatar_url;
	const { error } = await supabase.from('profiles').update(patch).eq('id', uid());
	if (error) throw error;
}
