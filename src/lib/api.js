import { Anixart } from 'anixartjs';
import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { userToken, endpointUrl } from './stores';

let anixApi = null;

function getBaseUrl(endpoint) {
    const cleaned = String(endpoint || 'api.anixart.app').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return `https://${cleaned}`;
}

function applyCompatibilityLayer(endpoints, client) {
    if (!endpoints || endpoints.__anishikiCompat) return endpoints;

    const search = endpoints.search;
    if (search) {
        search.profileFavorites ??= (data, options) => search.favorties(data, options);
        search.profileHistory ??= (data, options) => search.history(data, options);
        search.profileFavoriteCollection ??= (data, options) => search.favoriteCollections(data, options);
        search.profileList ??= (statusOrData, dataOrOptions, maybeOptions) => {
            const status = typeof statusOrData === 'number'
                ? statusOrData
                : Number(statusOrData?.status ?? statusOrData?.listStatus ?? statusOrData?.searchBy ?? 0);
            const data = typeof statusOrData === 'number' ? dataOrOptions : statusOrData;
            const page = Number(data?.page ?? 0);
            const query = data?.query ?? '';
            const searchBy = data?.searchBy;

            if (search.releasesInBookmarks) {
                return search.releasesInBookmarks({ type: status, page, query, searchBy }, maybeOptions);
            }

            return client.call({
                path: `/search/profile/list/${status}/${page}`,
                method: 'POST',
                json: { query, searchBy },
                ...maybeOptions
            });
        };
    }

    Object.defineProperty(endpoints, '__anishikiCompat', { value: true });
    return endpoints;
}

function createClient(token, endpoint) {
    return new Anixart({
        token: token?.token || token || null,
        baseUrl: getBaseUrl(endpoint)
    });
}

export function getApi() {
    if (!browser) return null;
    
    if (!anixApi) {
        const token = get(userToken);
        const endpoint = get(endpointUrl);
        
        anixApi = createClient(token, endpoint);
    }
    
    return applyCompatibilityLayer(anixApi.endpoints, anixApi);
}

export function reinitializeApi() {
    const token = get(userToken);
    const endpoint = get(endpointUrl);
    
    anixApi = createClient(token, endpoint);
    
    return applyCompatibilityLayer(anixApi.endpoints, anixApi);
}

export function updateApiToken(newToken) {
    if (anixApi) {
        anixApi.token = newToken?.token || newToken || null;
    }
}

export default {
    getApi,
    reinitializeApi,
    updateApiToken
};
