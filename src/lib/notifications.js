import { get } from 'svelte/store';
import { supabase } from '$lib/supabase';
import { siteSession } from '$lib/stores/auth';
import { getApi } from '$lib/api';
import { showLocalNotification } from '$lib/pwa';

// Уведомления аккаунта сайта: заявки в друзья, комментарии и новые серии.
//
// Серии проверяются на клиенте: крона нет, поэтому при заходе сверяем дату
// последнего обновления эпизодов у тайтлов из списка «Смотрю» с отметкой,
// сохранённой в прошлый раз. Первый проход только расставляет отметки, чтобы
// не завалить человека уведомлениями обо всём сразу.

const EPISODE_MARK_KEY = 'episode_marks';
const EPISODE_SYNC_KEY = 'episode_sync_at';
const SYNC_INTERVAL = 30 * 60 * 1000; // не чаще раза в полчаса
const SYNC_LIMIT = 12; // столько тайтлов проверяем за проход

function uid() {
	return get(siteSession)?.user?.id || null;
}

export async function listNotifications(limit = 50) {
	if (!supabase || !uid()) return [];
	const { data } = await supabase
		.from('notifications')
		.select('*')
		.eq('user_id', uid())
		.order('created_at', { ascending: false })
		.limit(limit);
	return data || [];
}

export async function unreadCount() {
	if (!supabase || !uid()) return 0;
	const { count } = await supabase
		.from('notifications')
		.select('id', { count: 'exact', head: true })
		.eq('user_id', uid())
		.eq('is_read', false);
	return count || 0;
}

export async function markRead(id) {
	if (!supabase || !uid()) return;
	await supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', uid());
}

export async function markAllRead() {
	if (!supabase || !uid()) return;
	await supabase
		.from('notifications')
		.update({ is_read: true })
		.eq('user_id', uid())
		.eq('is_read', false);
}

export async function removeNotification(id) {
	if (!supabase || !uid()) return;
	await supabase.from('notifications').delete().eq('id', id).eq('user_id', uid());
}

/**
 * Создать уведомление другому пользователю от своего имени.
 * @param {string} userId кому
 * @param {{ type: string, title: string, body?: string, releaseId?: number, image?: string, url?: string }} payload
 */
export async function notify(userId, { type, title, body, releaseId, image, url }) {
	if (!supabase || !uid() || !userId) return;
	try {
		await supabase.from('notifications').insert({
			user_id: userId,
			actor_id: uid(),
			type,
			title,
			body: body ?? null,
			release_id: releaseId ?? null,
			image: image ?? null,
			url: url ?? null
		});
	} catch (e) {
		console.error('notify', e);
	}
}

/** Уведомление самому себе (новые серии). */
async function notifySelf({ type, title, body, releaseId, image, url }) {
	if (!supabase || !uid()) return;
	try {
		await supabase.from('notifications').insert({
			user_id: uid(),
			actor_id: uid(),
			type,
			title,
			body: body ?? null,
			release_id: releaseId ?? null,
			image: image ?? null,
			url: url ?? null
		});
	} catch (e) {
		console.error('notify self', e);
	}
}

function readMarks() {
	try {
		return JSON.parse(localStorage.getItem(EPISODE_MARK_KEY) || '{}');
	} catch {
		return {};
	}
}

function writeMarks(marks) {
	try {
		localStorage.setItem(EPISODE_MARK_KEY, JSON.stringify(marks));
	} catch {
		/* приватный режим / переполнение */
	}
}

/** Сколько времени осталось до следующей допустимой проверки, мс. */
export function nextSyncIn() {
	try {
		const last = Number(localStorage.getItem(EPISODE_SYNC_KEY) || 0);
		return Math.max(0, SYNC_INTERVAL - (Date.now() - last));
	} catch {
		return 0;
	}
}

/** Разрешить следующей проверке пройти прямо сейчас (кнопка «Обновить»). */
export function forceNextSync() {
	try {
		localStorage.removeItem(EPISODE_SYNC_KEY);
	} catch {
		/* приватный режим */
	}
}

/**
 * Проверить тайтлы из списка «Смотрю» на новые серии и завести уведомления.
 * Безопасно звать на каждый заход: сама себя троттлит.
 */
export async function syncEpisodeNotifications() {
	if (!supabase || !uid()) return 0;
	const api = getApi();
	if (!api) return 0;

	try {
		const last = Number(localStorage.getItem(EPISODE_SYNC_KEY) || 0);
		if (Date.now() - last < SYNC_INTERVAL) return 0;
		localStorage.setItem(EPISODE_SYNC_KEY, String(Date.now()));
	} catch {
		/* без localStorage просто идём дальше */
	}

	const { data } = await supabase
		.from('lists')
		.select('release_id, title')
		.eq('user_id', uid())
		.eq('status', 1)
		.order('updated_at', { ascending: false })
		.limit(SYNC_LIMIT);
	const watching = data || [];
	if (!watching.length) return 0;

	const marks = readMarks();
	const firstRun = Object.keys(marks).length === 0;
	let created = 0;

	const releases = await Promise.all(
		watching.map((row) =>
			api.release
				.info(row.release_id, true)
				.then((d) => d?.release)
				.catch(() => null)
		)
	);

	for (const release of releases) {
		if (!release?.id) continue;
		const update = release.episode_last_update || {};
		const stamp = Number(update.last_episode_update_date) || 0;
		if (!stamp) continue;
		const key = String(release.id);
		const known = Number(marks[key]) || 0;
		marks[key] = stamp;
		// Первый проход только запоминает состояние — уведомлять не о чем.
		if (firstRun || !known || stamp <= known) continue;
		const title = release.title_ru || release.title || 'Новая серия';
		const body = update.last_episode_update_name
			? `Вышла ${update.last_episode_update_name}`
			: 'Вышла новая серия';
		const url = `/release/${release.id}`;
		await notifySelf({
			type: 'episode',
			title,
			body,
			releaseId: release.id,
			image: release.image || release.poster || null,
			url
		});
		// Плюс системное уведомление — чтобы узнать о серии, не открывая приложение.
		// Если разрешения нет, вызов молча вернёт false.
		showLocalNotification({ title, body, url, tag: `episode-${release.id}` }).catch(() => {});
		created += 1;
	}

	writeMarks(marks);
	return created;
}
