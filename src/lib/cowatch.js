import { writable } from 'svelte/store';
import { supabase } from '$lib/supabase';

// Совместный просмотр через Supabase Realtime: presence (кто в комнате),
// broadcast 'sync' (синхронизация плеера) и 'chat' (сообщения).

export const coActive = writable(false);
export const coRoomId = writable(null);
export const participants = writable([]);
export const chat = writable([]);

export const selfId = Math.random().toString(36).slice(2, 10);

let channel = null;
let hooks = {};

export function genRoomId() {
	return Math.random().toString(36).slice(2, 8);
}

/**
 * Подключиться к комнате.
 * @param {string} roomId
 * @param {{name:string, avatar?:string}} identity
 * @param {{onSync?:Function, onRequestState?:Function}} h
 */
export function joinRoom(roomId, identity, h = {}) {
	if (!supabase) throw new Error('Supabase не настроен');
	leaveRoom();
	hooks = h;
	chat.set([]);
	channel = supabase.channel(`cowatch:${roomId}`, {
		config: { presence: { key: selfId } }
	});

	channel.on('broadcast', { event: 'sync' }, ({ payload }) => {
		if (payload?.from !== selfId) hooks.onSync?.(payload);
	});
	channel.on('broadcast', { event: 'reqstate' }, ({ payload }) => {
		if (payload?.from !== selfId) hooks.onRequestState?.();
	});
	channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
		if (payload?.from !== selfId) chat.update((c) => [...c, payload]);
	});
	channel.on('presence', { event: 'sync' }, () => {
		const state = channel.presenceState();
		participants.set(Object.values(state).flat());
	});

	channel.subscribe(async (status) => {
		if (status === 'SUBSCRIBED') {
			await channel.track({ id: selfId, name: identity.name, avatar: identity.avatar || null, at: Date.now() });
			coActive.set(true);
			coRoomId.set(roomId);
			// запросить текущее состояние плеера у тех, кто уже смотрит
			send('reqstate', {});
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

/** Отправить сообщение в чат комнаты. */
export function sendChat(text, identity) {
	const msg = { from: selfId, name: identity.name, text, ts: Date.now() };
	chat.update((c) => [...c, msg]);
	send('chat', msg);
}

export function leaveRoom() {
	if (channel) {
		supabase?.removeChannel(channel);
		channel = null;
	}
	participants.set([]);
	chat.set([]);
	coActive.set(false);
	coRoomId.set(null);
}
