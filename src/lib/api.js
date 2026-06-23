import { Anixart } from 'anixartjs';
import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { userToken, endpointUrl } from './stores';

let client = null;

function getBaseUrl(endpoint) {
	const cleaned = String(endpoint || 'api.anixart.app')
		.trim()
		.replace(/^https?:\/\//, '')
		.replace(/\/+$/, '');
	return `https://${cleaned}`;
}

function createClient(token, endpoint) {
	return new Anixart({
		token: token?.token || token || null,
		baseUrl: getBaseUrl(endpoint)
	});
}

/**
 * Слой совместимости: добавляет недостающие в anixartjs 0.1.x методы поиска
 * через прямой client.call(...) — как в исходном AniShiki.
 */
function applyCompat(endpoints, anix) {
	if (!endpoints || endpoints.__compat) return endpoints;
	const search = endpoints.search;
	if (search) {
		search.profileFavorites ??= (data, options) => search.favorties(data, options);
		search.profileHistory ??= (data, options) => search.history(data, options);
		search.profileList ??= (status, data = {}, options) => {
			const page = Number(data.page ?? 0);
			return anix.call({
				path: `/search/profile/list/${status}/${page}`,
				method: 'POST',
				json: { query: data.query ?? '', searchBy: data.searchBy },
				...options
			});
		};
	}
	Object.defineProperty(endpoints, '__compat', { value: true });
	return endpoints;
}

/** Получить (лениво созданный) клиент endpoints. Только в браузере. */
export function getApi() {
	if (!browser) return null;
	if (!client) client = createClient(get(userToken), get(endpointUrl));
	return applyCompat(client.endpoints, client);
}

/** Низкоуровневый клиент (для helper-методов getReleaseById/login и т.п.). */
export function getClient() {
	if (!browser) return null;
	if (!client) client = createClient(get(userToken), get(endpointUrl));
	return client;
}

/** Пересоздать клиента (после смены токена/эндпоинта). */
export function reinitApi() {
	client = createClient(get(userToken), get(endpointUrl));
	return applyCompat(client.endpoints, client);
}

/** Обновить токен без пересоздания клиента. */
export function setApiToken(token) {
	if (client) client.token = token?.token || token || null;
}

export default { getApi, getClient, reinitApi, setApiToken };
