import { writable, get } from 'svelte/store';
import { supabase } from '$lib/supabase';

// Совместный просмотр через Supabase Realtime: presence (кто в комнате),
// broadcast 'sync' (синхронизация плеера), 'chat' (сообщения), 'meta' (настройки комнаты).

export const coActive = writable(false);
export const coRoomId = writable(null);
export const participants = writable([]);
export const chat = writable([]);
export const isHost = writable(false);
export const hostOnly = writable(false); // только хост управляет
export const hostId = writable(null);

export const selfId = Math.random().toString(36).slice(2, 10);

let channel = null;
let hooks = {};
let heartbeat = null;

export function genRoomId() {
	return Math.random().toString(36).slice(2, 8);
}

/**
 * Подключиться к комнате.
 * @param {string} roomId
 * @param {{name:string, avatar?:string}} identity
 * @param {{onSync?:Function, onRequestState?:Function}} h
 * @param {boolean} asHost — создатель комнаты (источник истины для ресинка)
 */
export function joinRoom(roomId, identity, h = {}, asHost = false) {
	if (!supabase) throw new Error('Supabase не настроен');
	leaveRoom();
	hooks = h;
	chat.set([]);
	isHost.set(asHost);
	hostOnly.set(false);

	channel = supabase.channel(`cowatch:${roomId}`, {
		config: { presence: { key: selfId } }
	});

	channel.on('broadcast', { event: 'sync' }, ({ payload }) => {
		if (payload?.from === selfId) return;
		// при hostOnly слушаем только хоста
		if (get(hostOnly) && payload.from !== get(hostId)) return;
		hooks.onSync?.(payload);
	});
	channel.on('broadcast', { event: 'reqstate' }, ({ payload }) => {
		if (payload?.from !== selfId) hooks.onRequestState?.();
	});
	channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
		if (payload?.from !== selfId) chat.update((c) => [...c, payload]);
	});
	channel.on('broadcast', { event: 'meta' }, ({ payload }) => {
		if (payload?.from !== selfId) hostOnly.set(!!payload.hostOnly);
	});
	channel.on('presence', { event: 'sync' }, () => {
		const list = Object.values(channel.presenceState()).flat();
		participants.set(list);
		// хост = участник с флагом host, иначе самый ранний по времени входа
		const host = list.find((p) => p.host) || [...list].sort((a, b) => (a.at || 0) - (b.at || 0))[0];
		hostId.set(host?.id || null);
		// хост рассылает текущие настройки комнаты новоприбывшим
		if (get(isHost)) send('meta', { hostOnly: get(hostOnly) });
	});

	channel.subscribe(async (status) => {
		if (status === 'SUBSCRIBED') {
			await channel.track({ id: selfId, name: identity.name, avatar: identity.avatar || null, host: asHost, at: Date.now() });
			coActive.set(true);
			coRoomId.set(roomId);
			send('reqstate', {});
			// хост периодически шлёт состояние → коррекция дрейфа у гостей
			if (asHost) {
				clearInterval(heartbeat);
				heartbeat = setInterval(() => hooks.onRequestState?.(), 20000);
			}
		}
	});
}

function send(event, payload) {
	if (!channel) return;
	channel.send({ type: 'broadcast', event, payload: { ...payload, from: selfId } });
}

/** Разослать состояние плеера остальным. */
export function sendSync(payload) {
	send('sync', payload);
}

/** Включить/выключить режим «только хост управляет» (только хост). */
export function setHostOnly(val) {
	if (!get(isHost)) return;
	hostOnly.set(!!val);
	send('meta', { hostOnly: !!val });
}

/** Отправить сообщение в чат комнаты. */
export function sendChat(text, identity) {
	const msg = { from: selfId, name: identity.name, text, ts: Date.now() };
	chat.update((c) => [...c, msg]);
	send('chat', msg);
}

export function leaveRoom() {
	clearInterval(heartbeat);
	heartbeat = null;
	if (channel) {
		supabase?.removeChannel(channel);
		channel = null;
	}
	participants.set([]);
	chat.set([]);
	coActive.set(false);
	coRoomId.set(null);
	isHost.set(false);
	hostOnly.set(false);
	hostId.set(null);
}
