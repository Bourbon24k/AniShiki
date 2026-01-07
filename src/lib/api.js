import { Anixart } from 'anixartjs';
import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { userToken, endpointUrl } from './stores';

let anixApi = null;

export function getApi() {
    if (!browser) return null;
    
    if (!anixApi) {
        const token = get(userToken);
        const endpoint = get(endpointUrl);
        
        anixApi = new Anixart({
            token: token?.token || null,
            baseUrl: `https://${endpoint}`
        });
    }
    
    return anixApi.endpoints;
}

export function reinitializeApi() {
    const token = get(userToken);
    const endpoint = get(endpointUrl);
    
    anixApi = new Anixart({
        token: token?.token || null,
        baseUrl: `https://${endpoint}`
    });
    
    return anixApi.endpoints;
}

export function updateApiToken(newToken) {
    if (anixApi) {
        anixApi.client.token = newToken;
    }
}

export default {
    getApi,
    reinitializeApi,
    updateApiToken
};
