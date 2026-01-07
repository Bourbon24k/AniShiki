import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Helper function to create localStorage-backed store
function createLocalStorageStore(key, defaultValue) {
    const storedValue = browser ? localStorage.getItem(key) : null;
    const initial = storedValue ? JSON.parse(storedValue) : defaultValue;
    
    const store = writable(initial);
    
    if (browser) {
        store.subscribe(value => {
            localStorage.setItem(key, JSON.stringify(value));
        });
    }
    
    return store;
}

// User token store
export const userToken = createLocalStorageStore('user_token', null);

// GUI settings store
export const guiSettings = createLocalStorageStore('guiSettings', {
    theme: 'dark',
    releaseCardType: 'full-row'
});

// Endpoint URL store
export const endpointUrl = createLocalStorageStore('endpointUrl', 'api-s.anixsekai.com');

// Player settings store
export const playerSettings = createLocalStorageStore('playerSettings', {
    autoplayEpisode: true,
    defaultAspectRatio: "16-9",
    saveUserVolume: {
        enabled: false,
        lastValue: null
    },
    defaultVolume: 50,
    opacityInterface: 50,
    timeHideInterface: 5000,
    hotkeys: {
        hotkeyPlayPause: ["Space"],
        hotkeyNextEpisode: ["KeyN"],
        hotkeyPrevEpisode: ["KeyB"],
        hotkeySkipOpening: ["KeyS"],
        hotkeyForward: ["ArrowRight"],
        hotkeyBackward: ["ArrowLeft"],
        hotkeyMute: ["KeyM"],
        hotkeyFullscreen: ["KeyF"]
    },
});

// Playing settings store
export const playingSettings = createLocalStorageStore('playingSettings', {
    defaultQuality: 1080,
    defaultSource: null,
    disableHistory: false
});

// Upscale settings store
export const upscaleSettings = createLocalStorageStore('upscaleSettings', {
    enabled: false,
    mode: 15
});

// First run store
export const firstRun = createLocalStorageStore('first_run', true);

// Notification count store
export const notificationCount = writable(0);

// Page history store
export const pageHistory = writable([]);

// Current page store for navigation
export const currentPage = writable('home');

// Mobile menu open state
export const mobileMenuOpen = writable(false);

// Modal state
export const modalState = writable({
    isOpen: false,
    component: null,
    props: {}
});

// Profile info store
export const profileInfo = writable(null);

// API instance store
export const anixApiStore = writable(null);
