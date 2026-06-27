import { get } from 'svelte/store';
import { supabase } from '$lib/supabase';
import { siteSession } from '$lib/stores/auth';

// Система друзей для аккаунтов сайта (Supabase, таблица friendships).

function uid() {
	return get(siteSession)?.user?.id || null;
}

async function profilesByIds(ids) {
	if (!ids.length) return {};
	const { data } = await supabase.from('profiles').select('id, username, avatar_url').in('id', ids);
	const map = {};
	for (const p of data || []) map[p.id] = p;
	return map;
}

/** Поиск пользователей по нику (кроме себя). */
export async function searchUsers(query) {
	if (!supabase || !uid() || !query?.trim()) return [];
	const { data } = await supabase
		.from('profiles')
		.select('id, username, avatar_url')
		.ilike('username', `%${query.trim()}%`)
		.neq('id', uid())
		.limit(15);
	return data || [];
}

/** Принятые друзья. */
export async function listFriends() {
	if (!supabase || !uid()) return [];
	const { data } = await supabase
		.from('friendships')
		.select('requester, addressee')
		.eq('status', 'accepted')
		.or(`requester.eq.${uid()},addressee.eq.${uid()}`);
	const ids = (data || []).map((r) => (r.requester === uid() ? r.addressee : r.requester));
	const map = await profilesByIds(ids);
	return ids.map((id) => map[id]).filter(Boolean);
}

/** Входящие заявки (мне). */
export async function listIncoming() {
	if (!supabase || !uid()) return [];
	const { data } = await supabase
		.from('friendships')
		.select('requester')
		.eq('addressee', uid())
		.eq('status', 'pending');
	const ids = (data || []).map((r) => r.requester);
	const map = await profilesByIds(ids);
	return ids.map((id) => map[id]).filter(Boolean);
}

/** Исходящие заявки (от меня). */
export async function listOutgoing() {
	if (!supabase || !uid()) return [];
	const { data } = await supabase
		.from('friendships')
		.select('addressee')
		.eq('requester', uid())
		.eq('status', 'pending');
	const ids = (data || []).map((r) => r.addressee);
	const map = await profilesByIds(ids);
	return ids.map((id) => map[id]).filter(Boolean);
}

/** Отправить заявку в друзья. */
export async function sendRequest(userId) {
	if (!supabase || !uid()) throw new Error('Нет аккаунта');
	const { error } = await supabase
		.from('friendships')
		.upsert({ requester: uid(), addressee: userId, status: 'pending' });
	if (error) throw error;
}

/** Ответить на входящую заявку. */
export async function respondRequest(requesterId, accept) {
	if (!supabase || !uid()) return;
	if (accept) {
		await supabase
			.from('friendships')
			.update({ status: 'accepted' })
			.eq('requester', requesterId)
			.eq('addressee', uid());
	} else {
		await supabase.from('friendships').delete().eq('requester', requesterId).eq('addressee', uid());
	}
}

/** Удалить друга / отменить заявку (в любую сторону). */
export async function removeFriend(userId) {
	if (!supabase || !uid()) return;
	await supabase
		.from('friendships')
		.delete()
		.or(
			`and(requester.eq.${uid()},addressee.eq.${userId}),and(requester.eq.${userId},addressee.eq.${uid()})`
		);
}
