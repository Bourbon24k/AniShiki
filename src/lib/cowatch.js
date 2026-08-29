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
export const coStatus = writable('idle'); // idle | connecting | connected | reconnecting | error

export const selfId = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 10);

let channel = null;
let hooks = {};
let heartbeat = null;
let presence = null;

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
	coStatus.set('connecting');
	presence = { id: selfId, name: identity.name, avatar: identity.avatar || null, host: asHost, at: Date.now() };

	channel = supabase.channel(`cowatch:${roomId}`, {
		config: { presence: { key: selfId } }
	});
	const roomChannel = channel;

	roomChannel.on('broadcast', { event: 'sync' }, ({ payload }) => {
		if (channel !== roomChannel) return;
		if (payload?.from === selfId) return;
		// при hostOnly слушаем только хоста
		if (get(hostOnly) && payload.from !== get(hostId)) return;
		hooks.onSync?.(payload);
	});
	roomChannel.on('broadcast', { event: 'reqstate' }, ({ payload }) => {
		if (channel !== roomChannel) return;
		// Иначе все гости отвечают одновременно и скачут между своими позициями.
		if (payload?.from !== selfId && get(isHost)) hooks.onRequestState?.();
	});
	roomChannel.on('broadcast', { event: 'chat' }, ({ payload }) => {
		if (channel !== roomChannel) return;
		if (payload?.from !== selfId) chat.update((c) => [...c, payload]);
	});
	roomChannel.on('broadcast', { event: 'meta' }, ({ payload }) => {
		if (channel !== roomChannel) return;
		// Метаданные комнаты принимает только от актуального хоста.
		if (payload?.from !== selfId && payload?.from === get(hostId)) hostOnly.set(!!payload.hostOnly);
	});
	roomChannel.on('presence', { event: 'sync' }, () => {
		if (channel !== roomChannel) return;
		const list = /** @type {any[]} */ (Object.values(roomChannel.presenceState()).flat());
		participants.set(list);
		// Хост = участник с флагом host, иначе самый ранний по времени входа.
		// Если создатель ушёл, первый оставшийся становится новым хостом и
		// продолжает ресинкать комнату вместо «зависшей» сессии.
		const host = list.find((p) => p.host) || [...list].sort((a, b) => (a.at || 0) - (b.at || 0))[0];
		hostId.set(host?.id || null);
		const amHost = host?.id === selfId;
		if (amHost && !get(isHost)) {
			isHost.set(true);
			presence = { ...presence, host: true };
			roomChannel.track(presence);
			startHeartbeat();
		} else if (!amHost && get(isHost)) {
			isHost.set(false);
			clearInterval(heartbeat);
			heartbeat = null;
		}
		// хост рассылает текущие настройки комнаты новоприбывшим
		if (get(isHost)) send('meta', { hostOnly: get(hostOnly) });
	});

	roomChannel.subscribe(async (status) => {
		if (channel !== roomChannel) return;
		if (status === 'SUBSCRIBED') {
			await roomChannel.track(presence);
			coActive.set(true);
			coRoomId.set(roomId);
			coStatus.set('connected');
			send('reqstate', {});
			// хост периодически шлёт состояние → коррекция дрейфа у гостей
			if (asHost) startHeartbeat();
		} else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
			coStatus.set('reconnecting');
		} else if (status === 'CLOSED') {
			coStatus.set('error');
		}
	});
}

function startHeartbeat() {
	clearInterval(heartbeat);
	heartbeat = setInterval(() => {
		if (get(isHost)) hooks.onRequestState?.();
	}, 20000);
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
	coStatus.set('idle');
	presence = null;
}
