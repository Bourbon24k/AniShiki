/**
 * То, чего нет в anixartjs 0.1.x.
 *
 * Загрузка аватара: клиент библиотеки собирает multipart через npm-пакет
 * form-data (нодовский стрим) — в браузере это не работает. Здесь тот же
 * запрос, но на родных FormData/fetch.
 */
import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { userToken, endpointUrl } from './stores';

function baseUrl() {
	const cleaned = String(get(endpointUrl) || 'api.anixart.app')
		.trim()
		.replace(/^https?:\/\//, '')
		.replace(/\/+$/, '');
	return `https://${cleaned}`;
}

/** Anixart отвечает 200 даже на ошибку — смотреть надо поле `code` (0 — успех). */
async function unwrap(response) {
	if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { code: response.status });
	const text = await response.text();
	if (!text.trim()) return null;
	const data = JSON.parse(text);
	if (data && typeof data.code === 'number' && data.code !== 0) {
		throw Object.assign(new Error(`API code ${data.code}`), { code: data.code });
	}
	return data;
}

/** Загрузить аватар профиля. @param {Blob|File} file */
export async function uploadAvatar(file) {
	if (!browser) return null;
	const token = get(userToken)?.token;
	if (!token) throw new Error('Нужен вход в аккаунт Anixart');
	const url = new URL('/profile/preference/avatar/edit', baseUrl());
	url.searchParams.set('token', token);
	const form = new FormData();
	form.append('image', file, 'avatar.jpg');
	form.append('name', 'image');
	return unwrap(await fetch(url.toString(), { method: 'POST', body: form }));
}

/** По чему ищем релизы. 4 (тег) — это и есть поиск по жанрам. */
export const SEARCH_BY = { name: 0, studio: 1, director: 2, author: 3, tag: 4 };

/** Уровни приватности профиля (ручки /profile/preference/privacy/*). */
export const PRIVACY = { everyone: 0, friends: 1, nobody: 2 };

export default { uploadAvatar, SEARCH_BY, PRIVACY };
