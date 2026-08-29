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

/**
 * Описание системного уведомления. Данные из базы должны быть полезны и в
 * шторке ОС: «Новое уведомление» не объясняет человеку, зачем открывать
 * приложение. Старые строки тоже приводим к осмысленному тексту.
 */
export function notificationCopy(row = {}) {
	const type = String(row.type || '');
	const title = String(row.title || '').trim();
	const body = String(row.body || '').trim();
	if (title && title.toLowerCase() !== 'новое уведомление') {
		return { title, body: body || fallbackBody(type) };
	}
	if (type === 'friend_request') return { title: 'Новая заявка в друзья', body: body || 'Откройте раздел «Друзья», чтобы ответить.' };
	if (type === 'friend_accepted') return { title: 'Заявка в друзья принята', body: body || 'Теперь вы друзья.' };
	if (type === 'comment') return { title: 'Новый ответ на комментарий', body: body || 'Откройте релиз, чтобы прочитать ответ.' };
	if (type === 'episode') return { title: 'Новая серия', body: body || 'Вышла новая серия в тайтле из списка «Смотрю».' };
	return { title: 'Новое событие в AniShiki', body: body || 'Откройте раздел «События», чтобы посмотреть подробности.' };
}

/** Текст события Anixart для системной шторки (API не отдаёт готовый title). */
export function anixartNotificationCopy(row = {}) {
	const type = String(row.type || '');
	const who = row.by_profile?.login || row.profile?.login || '';
	const release = typeof row.release === 'object' ? row.release : null;
	if (type === 'friend') {
		return {
			title: who ? `${who}: друзья` : 'Событие в друзьях',
			body: row.status === 'request' ? 'Отправил(а) заявку в друзья' : 'Добавил(а) вас в друзья',
			url: row.by_profile?.id || row.profile?.id ? `/profile/${row.by_profile?.id || row.profile?.id}` : '/friends'
		};
	}
	if (type === 'releaseComment') {
		return { title: who ? `${who} ответил(а) на комментарий` : 'Новый ответ на комментарий', body: row.comment?.message || 'Откройте релиз, чтобы прочитать ответ.', url: row.comment?.release?.id ? `/release/${row.comment.release.id}` : '/notifications' };
	}
	if (type === 'collectionComment') {
		return { title: who ? `${who} ответил(а) в коллекции` : 'Новый комментарий в коллекции', body: row.comment?.message || 'Откройте коллекцию, чтобы прочитать ответ.', url: row.collection?.id ? `/collection/${row.collection.id}` : '/collections' };
	}
	if (type === 'relatedRelease') {
		return { title: 'Новый связанный релиз', body: release?.title_ru || release?.title || 'Откройте карточку, чтобы посмотреть.', url: release?.id ? `/release/${release.id}` : '/notifications' };
	}
	const title = release?.title_ru || release?.title || row.title || 'Новая серия';
	return {
		title: `Новая серия: ${title}`,
		body: row.episode?.name || row.message || 'Серия доступна к просмотру.',
		url: release?.id || row.release ? `/release/${release?.id || row.release}` : '/notifications'
	};
}

function fallbackBody(type) {
	if (type === 'friend_request') return 'Откройте раздел «Друзья», чтобы ответить.';
	if (type === 'friend_accepted') return 'Теперь вы друзья.';
	if (type === 'comment') return 'Откройте релиз, чтобы прочитать ответ.';
	if (type === 'episode') return 'Вышла новая серия в тайтле из списка «Смотрю».';
	return '';
}

/**
 * Подписка на вставки в таблицу уведомлений. До этого новые строки становились
 * видны только после ручного открытия экрана «События»; теперь бейдж и шторка
 * ОС обновляются в момент прихода события.
 */
export function watchNotifications(userId, onInsert) {
	if (!supabase || !userId) return () => {};
	const channel = supabase
		.channel(`notifications:${userId}`)
		.on(
			'postgres_changes',
			{ event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
			(payload) => onInsert?.(payload.new)
		)
		.subscribe((status) => {
			if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
				console.warn('notifications realtime', status);
			}
		});
	return () => supabase.removeChannel(channel);
}

function uid() {
	return get(siteSession)?.user?.id || null;
}

const PREFERENCE_BY_TYPE = {
	episode: 'is_episode_notifications_enabled',
	related_release: 'is_related_release_notifications_enabled',
	comment: 'is_comment_notifications_enabled',
	collection_comment: 'is_my_collection_comment_notifications_enabled',
	report: 'is_report_process_notifications_enabled'
};

/** Проверяет подписку получателя до создания строки, как это делает Anixart. */
async function recipientAllows(userId, type) {
	const field = PREFERENCE_BY_TYPE[type];
	if (!field || !userId || userId === uid()) return true;
	const { data, error } = await supabase.from('profiles').select(field).eq('id', userId).maybeSingle();
	// Старые профили, на которых миграция ещё не появилась, не лишаем
	// уведомлений: отсутствие поля означает стандартное «включено».
	if (error || !data || data[field] == null) return true;
	return Boolean(data[field]);
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
		if (!(await recipientAllows(userId, type))) return false;
		const { error } = await supabase.from('notifications').insert({
			user_id: userId,
			actor_id: uid(),
			type,
			title,
			body: body ?? null,
			release_id: releaseId ?? null,
			image: image ?? null,
			url: url ?? null
		});
		if (error) throw error;
		return true;
	} catch (e) {
		console.error('notify', e);
		return false;
	}
}

/** Уведомление самому себе (новые серии). */
async function notifySelf({ type, title, body, releaseId, image, url }) {
	if (!supabase || !uid()) return;
	try {
		const { error } = await supabase.from('notifications').insert({
			user_id: uid(),
			actor_id: uid(),
			type,
			title,
			body: body ?? null,
			release_id: releaseId ?? null,
			image: image ?? null,
			url: url ?? null
		});
		if (error) throw error;
		return true;
	} catch (e) {
		console.error('notify self', e);
		return false;
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
