// Прямые потоки для источников, отличных от Kodik.
//
// Anixart отдаёт только URL встраиваемого плеера. Браузер не может прочитать
// чужой iframe (same-origin), поэтому извлечение выполняется здесь и только
// для явно известных провайдеров. Это не открытый прокси: адреса и домены
// проверяются до любого сетевого запроса.

import { OKParser, RutubeParser, SibnetParser, VKVideoParser } from 'anixartjs';

const ANI_HOSTS = new Set(['aniliberty.top', 'www.aniliberty.top', 'anilibria.tv', 'www.anilibria.tv']);
const RUTUBE_HOSTS = new Set(['rutube.ru', 'www.rutube.ru']);
const VK_HOSTS = new Set(['vk.com', 'www.vk.com', 'vkvideo.ru', 'www.vkvideo.ru']);
const OK_HOSTS = new Set(['ok.ru', 'www.ok.ru']);
const SIBNET_HOSTS = new Set(['video.sibnet.ru']);

function cleanUrl(value) {
	let valueUrl = String(value || '').trim();
	if (valueUrl.startsWith('//')) valueUrl = `https:${valueUrl}`;
	if (valueUrl && !/^https?:/i.test(valueUrl)) valueUrl = `https://${valueUrl}`;
	const parsed = new URL(valueUrl);
	if (parsed.protocol !== 'https:') throw new Error('only https sources are supported');
	return parsed;
}

function qualityMap(links) {
	const qualities = {};
	for (const [quality, value] of Object.entries(links || {})) {
		const url = typeof value === 'string' ? value : value?.src;
		if (typeof url === 'string' && /^https:\/\//i.test(url)) qualities[String(quality)] = url;
	}
	return qualities;
}

function defaultQuality(qualities) {
	const keys = Object.keys(qualities);
	const numeric = keys.map(Number).filter(Number.isFinite).sort((a, b) => b - a);
	return String(numeric[0] ?? keys[0] ?? '');
}

function timing(part) {
	const start = Number(part?.start);
	const stop = Number(part?.stop);
	return Number.isFinite(stop) && stop > 0
		? { start: Number.isFinite(start) && start >= 0 ? start : 0, stop }
		: null;
}

async function extractAniLiberty(parsed) {
	const id = parsed.searchParams.get('id');
	const ordinal = Number(parsed.searchParams.get('ep'));
	if (!/^\d+$/.test(id || '') || !Number.isInteger(ordinal) || ordinal < 1) {
		throw new Error('AniLibria link does not contain id and episode');
	}
	const response = await fetch(`https://aniliberty.top/api/v1/anime/releases/${id}`, {
		headers: { Accept: 'application/json', 'User-Agent': 'AniShiki/1.0' },
		signal: AbortSignal.timeout(15000)
	});
	if (!response.ok) throw new Error(`AniLibria API ${response.status}`);
	const release = await response.json();
	const episode = (release?.episodes || []).find((item) => Number(item?.ordinal) === ordinal);
	if (!episode) throw new Error('AniLibria episode not found');
	const qualities = qualityMap({ 1080: episode.hls_1080, 720: episode.hls_720, 480: episode.hls_480 });
	if (!Object.keys(qualities).length) throw new Error('AniLibria stream not found');
	return {
		provider: 'AniLibria',
		qualities,
		default: defaultQuality(qualities),
		intro: timing(episode.opening),
		ending: timing(episode.ending)
	};
}

/**
 * Получить HLS/MP4 для известных внешних плееров.
 * @returns {Promise<{provider: string, qualities: Record<string,string>, default: string, intro: {start:number,stop:number}|null, ending: {start:number,stop:number}|null}>}
 */
export async function extractSource(embedUrl) {
	const parsed = cleanUrl(embedUrl);
	let links;
	let provider;
	if (ANI_HOSTS.has(parsed.hostname)) return extractAniLiberty(parsed);
	if (RUTUBE_HOSTS.has(parsed.hostname)) {
		provider = 'RuTube';
		links = await RutubeParser.getDirectLinks(parsed.toString());
	} else if (VK_HOSTS.has(parsed.hostname)) {
		provider = 'VK Видео';
		links = await VKVideoParser.getDirectLinks(parsed.toString());
	} else if (OK_HOSTS.has(parsed.hostname)) {
		provider = 'OK Видео';
		links = await OKParser.getDirectLinks(parsed.toString());
	} else if (SIBNET_HOSTS.has(parsed.hostname)) {
		provider = 'Sibnet';
		const url = await SibnetParser.getDirectLink(parsed.toString());
		links = url ? { auto: url } : null;
	} else {
		throw new Error('unsupported player source');
	}
	const qualities = qualityMap(links);
	if (!Object.keys(qualities).length) throw new Error(`${provider} stream not found`);
	return { provider, qualities, default: defaultQuality(qualities), intro: null, ending: null };
}

export function supportsSource(value) {
	try {
		const host = cleanUrl(value).hostname;
		return ANI_HOSTS.has(host) || RUTUBE_HOSTS.has(host) || VK_HOSTS.has(host) || OK_HOSTS.has(host) || SIBNET_HOSTS.has(host);
	} catch {
		return false;
	}
}
