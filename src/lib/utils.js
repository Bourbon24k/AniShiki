/**
 * Набор всяких вспомогательных функций для AniAnglia
 */

export const seasons = [null, "Зима", "Весна", "Лето", "Осень"];

export const avaliableNotifications = [
    "myCollection",
    "relatedRelease",
    "friend",
];

export const playerDefaultSettings = {
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
};

export const guiDefaultSettings = {
    theme: "dark",
    releaseCardType: "full-row",
};

export const playingDefaultSettings = {
    defaultQuality: 1080,
    defaultSource: null,
    disableHistory: false
};

export const upscaleDefaultSettings = {
    enabled: false,
    mode: 15
};

export const endpointValues = [
    { label: "api-s.anixsekai.com", value: "api-s.anixsekai.com" },
    { label: "api.anixart.app", value: "api.anixart.app" },
    { label: "api.anixart.tv (Заблокирован в РФ)", value: "api.anixart.tv" },
];

export const bookmarkSortValues = [
    { label: "По дате добавления: сначала новые", value: 1 },
    { label: "По дате добавления: сначала старые", value: 2 },
    { label: "По алфавиту: A → Z", value: 5 },
    { label: "По алфавиту: Z → A", value: 6 },
    { label: "По году выхода релиза: сначала новые", value: 3 },
    { label: "По году выхода релиза: сначала старые", value: 4 },
];

export const privacyOptions = [
    { label: "Никто", value: 2 },
    { label: "Только друзья", value: 1 },
    { label: "Все пользователи", value: 0 }
];

export const privacyFriendsOptions = [
    { label: "Никто", value: 1 },
    { label: "Все пользователи", value: 0 }
];

export const sourceValues = [
    { label: "Не выбран", value: null },
    { label: "Kodik", value: 0 },
    { label: "Libria", value: 1 },
    { label: "Sibnet", value: 2 }
];

export const qualityValues = [
    { label: "1080p", value: 1080 },
    { label: "720p", value: 720 },
    { label: "480p", value: 480 },
    { label: "360p", value: 360 }
];

export const aspectRatioValues = [
    { label: "16:9", value: "16-9" },
    { label: "4:3", value: "4-3" },
    { label: "Fit", value: "fit" },
];

export const playerSpeedValues = [
    { label: "0.5x", value: 0.5 },
    { label: "1x", value: 1.0 },
    { label: "1.5x", value: 1.5 },
    { label: "2x", value: 2.0 }
];

export const collectionSortValues = [
    { label: "В закладках", value: 0 },
    { label: "Лидеры рейтинга", value: 1 },
    { label: "Популярные за год", value: 2 },
    { label: "Популярные за сезон", value: 3 },
    { label: "Популярные за неделю", value: 4 },
    { label: "Недавно добавленные", value: 5 },
    { label: "Случайные", value: 6 },
];

export const themeValues = [
    { label: "Темная", value: "dark" },
    { label: "Светлая", value: "light" }
];

export const upscaleValues = [
    { label: "ModeA [Preset]", value: 14, description: "Быстрый пресет с умеренным восстановлением и апскейлом." },
    { label: "ModeB [Preset]", value: 15, description: "Сбалансированный пресет с акцентом на детализацию." },
    { label: "ModeC [Preset]", value: 16, description: "Качественный пресет с более агрессивным улучшением." },
    { label: "ModeA+A [Preset]", value: 17, description: "Расширенный ModeA с дополнительной обработкой." },
    { label: "ModeB+B [Preset]", value: 18, description: "Улучшенный ModeB, обеспечивает более высокое качество." },
    { label: "ModeC+A [Preset]", value: 19, description: "Комбинированный пресет с высокой чёткостью и восстановлением." },
];

export function getStringTime(time) {
    const days = Math.floor(time / 1440);
    const hours = Math.floor((time % 1440) / 60);
    const minutes = time;

    return {
        days,
        hours,
        minutes
    }
}

export function getNumericWord(number, words) {
    const cases = [2, 0, 1, 1, 1, 2];
    return words[(number % 100 > 4 && number % 100 < 20) ? 2 : cases[(number % 10 < 5) ? number % 10 : 5]];
}

export function returnFullStringTime(time) {
    const { days, hours } = getStringTime(time);
    return `${days} ${getNumericWord(days, ['день', 'дня', 'дней'])} ${hours !== 0 ? `${hours} ${getNumericWord(hours, ['час', 'часа', 'часов'])}` : ""}`;
}

export function returnEpisodeString(anime) {
    let released = anime.episodes_released;
    let total = anime.episodes_total;

    if (total == null) total = '?';
    if (released == null) released = '?';
    if (total == null && released == null) return '?';
    if (total == released) return total;

    return `${released} из ${total}`;
}

export function getAgeRate(rate) {
    switch (rate) {
        case 2:
            return "6+";
        case 3:
            return "12+";
        case 4:
            return "16+";
        case 5:
            return "18+";
        case 1:
        default:
            return "0+";
    }
}

export function getShortDate(timestamp) {
    let date = new Date(timestamp * 1000);
    return `${date.getDate() < 10 ? '0' + date.getDate() : date.getDate()}.${date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1}`
}

export function returnTimeString(time, showYear = false) {
    let date = new Date(time);
    return `${date.getDate()} ${date.toLocaleString("default", { month: "short" })} ${showYear ? date.getFullYear() : ""} в ${date.getHours()}:${date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes()}`;
}

export function returnFormatedTime(time) {
    const h = Math.floor(time / 3600);
    const m = Math.floor((time % 3600) / 60);
    const s = Math.floor(time % 60);

    return [h, m, s]
        .map((x, i) => {
            if (x == 0 && i == 0) return null;
            return x >= 0 && x <= 9 ? `0${x}` : x;
        })
        .filter((x) => x !== null)
        .join(":");
}

export async function checkGPUSupport() {
    if (typeof navigator === 'undefined') {
        console.warn("WebGPU не поддерживается в этом браузере.");
        return false;
    }

    const gpu = Reflect.get(navigator, 'gpu');
    if (!gpu) {
        console.warn("WebGPU не поддерживается в этом браузере.");
        return false;
    }

    return gpu
        .requestAdapter()
        .then((adapter) => {
            return adapter !== null;
        })
        .catch(() => {
            return false;
        });
}

export async function fallback(callback, count) {
    let success = false;

    for (let i = 0; i < count && !success; i++) {
        callback(success);
        if (success) return;
        await new Promise(r => setTimeout(r, 500));
    }
}

export function returnSoonText(release) {
    if (release.aired_on_date != 0) {
        const d = new Date(release.aired_on_date * 1000);
        return `${d.getDate()} ${d.toLocaleDateString("ru-RU", { month: "short" })}. ${d.getFullYear()} год.`;
    }

    if (release.year)
        return `${seasons[release.season] !== null ? `${seasons[release.season]}, ` : ""}${release.year} г.`;

    return "Скоро";
}

export default {
    seasons,
    avaliableNotifications,
    playerDefaultSettings,
    guiDefaultSettings,
    playingDefaultSettings,
    upscaleDefaultSettings,
    endpointValues,
    bookmarkSortValues,
    privacyOptions,
    privacyFriendsOptions,
    sourceValues,
    qualityValues,
    aspectRatioValues,
    playerSpeedValues,
    collectionSortValues,
    themeValues,
    upscaleValues,
    getStringTime,
    getNumericWord,
    returnFullStringTime,
    returnEpisodeString,
    getAgeRate,
    getShortDate,
    returnTimeString,
    returnFormatedTime,
    checkGPUSupport,
    fallback,
    returnSoonText
};
