import { get } from 'svelte/store';
import { supabase } from '$lib/supabase';
import { siteSession } from '$lib/stores/auth';

// Коллекции аккаунта сайта: свои подборки релизов с публикацией.

function uid() {
	return get(siteSession)?.user?.id || null;
}

/** Приводим к форме, которую понимает CollectionCard. */
function toCard(row, itemCount = null) {
	return {
		id: row.id,
		title: row.title,
		description: row.description,
		image: row.cover,
		is_public: row.is_public,
		user_id: row.user_id,
		release_count: itemCount ?? row.release_count ?? 0,
		creation_date: row.created_at ? Math.floor(new Date(row.created_at).getTime() / 1000) : null,
		site: true
	};
}

/** Сколько релизов в каждой коллекции — одним запросом на всю пачку. */
async function countsFor(ids) {
	/** @type {Record<string, number>} */
	const counts = {};
	if (!ids.length) return counts;
	const { data } = await supabase.from('collection_items').select('collection_id').in('collection_id', ids);
	for (const row of data || []) counts[row.collection_id] = (counts[row.collection_id] || 0) + 1;
	return counts;
}

async function withCounts(rows) {
	const counts = await countsFor(rows.map((r) => r.id));
	return rows.map((row) => toCard(row, counts[row.id] || 0));
}

/** Публичные коллекции всех пользователей. */
export async function listPublicCollections(limit = 60) {
	if (!supabase) return [];
	const { data } = await supabase
		.from('collections')
		.select('*')
		.eq('is_public', true)
		.order('updated_at', { ascending: false })
		.limit(limit);
	return withCounts(data || []);
}

/** Коллекции пользователя. Свои — включая скрытые (это решает RLS). */
export async function listCollectionsByUser(userId) {
	if (!supabase || !userId) return [];
	const { data } = await supabase
		.from('collections')
		.select('*')
		.eq('user_id', userId)
		.order('updated_at', { ascending: false });
	return withCounts(data || []);
}

export async function listMyCollections() {
	return uid() ? listCollectionsByUser(uid()) : [];
}

/** Коллекция с содержимым и автором. */
export async function getCollection(id) {
	if (!supabase || !id) return null;
	const { data: row } = await supabase.from('collections').select('*').eq('id', id).maybeSingle();
	if (!row) return null;
	const [{ data: items }, { data: author }] = await Promise.all([
		supabase
			.from('collection_items')
			.select('*')
			.eq('collection_id', id)
			.order('added_at', { ascending: false }),
		supabase.from('profiles').select('id, username, avatar_url').eq('id', row.user_id).maybeSingle()
	]);
	const releases = (items || []).map((it) => ({
		id: it.release_id,
		title_ru: it.title,
		image: it.image
	}));
	return {
		...toCard(row, releases.length),
		releases,
		author: author || { id: row.user_id, username: 'Пользователь' },
		isMine: row.user_id === uid()
	};
}

export async function createCollection({ title, description = '', isPublic = true }) {
	if (!supabase || !uid()) throw new Error('Нет аккаунта');
	const { data, error } = await supabase
		.from('collections')
		.insert({ user_id: uid(), title, description: description || null, is_public: isPublic })
		.select()
		.single();
	if (error) throw error;
	return toCard(data, 0);
}

export async function updateCollection(id, { title, description, isPublic, cover }) {
	if (!supabase || !uid()) throw new Error('Нет аккаунта');
	/** @type {Record<string, any>} */
	const patch = { updated_at: new Date().toISOString() };
	if (title != null) patch.title = title;
	if (description !== undefined) patch.description = description || null;
	if (isPublic != null) patch.is_public = isPublic;
	if (cover !== undefined) patch.cover = cover || null;
	const { error } = await supabase.from('collections').update(patch).eq('id', id).eq('user_id', uid());
	if (error) throw error;
}

export async function deleteCollection(id) {
	if (!supabase || !uid()) throw new Error('Нет аккаунта');
	const { error } = await supabase.from('collections').delete().eq('id', id).eq('user_id', uid());
	if (error) throw error;
}

export async function addToCollection(collectionId, release) {
	if (!supabase || !uid()) throw new Error('Нет аккаунта');
	const { error } = await supabase.from('collection_items').upsert({
		collection_id: collectionId,
		release_id: release.id,
		title: release.title_ru || release.title || null,
		image: release.image || release.poster || null
	});
	if (error) throw error;
	// Первый добавленный постер становится обложкой.
	const cover = release.image || release.poster || null;
	if (cover) {
		await supabase
			.from('collections')
			.update({ cover, updated_at: new Date().toISOString() })
			.eq('id', collectionId)
			.eq('user_id', uid())
			.is('cover', null);
	}
}

export async function removeFromCollection(collectionId, releaseId) {
	if (!supabase || !uid()) return;
	await supabase
		.from('collection_items')
		.delete()
		.eq('collection_id', collectionId)
		.eq('release_id', releaseId);
}
