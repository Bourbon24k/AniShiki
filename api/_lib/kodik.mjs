// Извлечение прямого .m3u8 из Kodik-эмбеда (без рекламы).
// Должно работать на сервере (CORS не даёт дёрнуть страницу Kodik и /ftor из браузера).
//
// Kodik блокирует дата-центровые IP (Vercel) — /ftor возвращает пусто.
// Поэтому ходим к Kodik через SOCKS5-прокси из переменной окружения
// KODIK_PROXY (формат socks5://user:pass@host:port). Без неё — напрямую (dev).

import tls from 'node:tls';
import { SocksClient } from 'socks';
import { Agent, fetch as undiciFetch } from 'undici';

const UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

let dispatcher = null;
if (process.env.KODIK_PROXY) {
	try {
		const pu = new URL(process.env.KODIK_PROXY);
		/** @type {import('socks').SocksProxy} */
		const proxy = {
			host: pu.hostname,
			port: Number(pu.port) || 1080,
			type: pu.protocol.startsWith('socks4') ? 4 : 5,
			userId: decodeURIComponent(pu.username || '') || undefined,
			password: decodeURIComponent(pu.password || '') || undefined
		};
		dispatcher = new Agent({
			connect: (opts, cb) => {
				SocksClient.createConnection({
					proxy,
					command: 'connect',
					destination: {
						host: opts.hostname,
						port: Number(opts.port) || (opts.protocol === 'https:' ? 443 : 80)
					}
				})
					.then(({ socket }) => {
						if (opts.protocol === 'https:') {
							const t = tls.connect(
								{ socket, servername: opts.servername || opts.hostname },
								() => cb(null, t)
							);
							t.on('error', (e) => cb(e, null));
						} else {
							cb(null, socket);
						}
					})
					.catch((e) => cb(e, null));
			}
		});
	} catch (e) {
		console.error('Некорректный KODIK_PROXY:', e?.message);
	}
}
const proxyOpts = dispatcher ? { dispatcher } : {};

/** Kodik кодирует ссылки сдвигом букв +18 в пределах регистра, затем base64. */
function decodeLink(str) {
	const shifted = String(str).replace(/[a-zA-Z]/g, (c) => {
		const base = c <= 'Z' ? 90 : 122;
		const code = c.charCodeAt(0) + 18;
		return String.fromCharCode(base >= code ? code : code - 26);
	});
	let b64 = shifted.replace(/[^A-Za-z0-9+/=]/g, '');
	while (b64.length % 4) b64 += '=';
	return Buffer.from(b64, 'base64').toString('utf8');
}

/**
 * @param {string} embedUrl — ссылка вида https://kodikplayer.com/seria/<id>/<hash>/<quality>p
 * @returns {Promise<{ qualities: Record<string,string>, default: string }>}
 */
export async function extractKodik(embedUrl) {
	let url = String(embedUrl || '').trim();
	if (!url) throw new Error('empty url');
	if (url.startsWith('//')) url = 'https:' + url;
	if (!/^https?:/i.test(url)) url = 'https://' + url;
	const u = new URL(url);
	const origin = u.origin;

	const pageRes = await undiciFetch(url, {
		...proxyOpts,
		headers: { 'User-Agent': UA, Referer: 'https://anixart.app/' }
	});
	if (!pageRes.ok) throw new Error('embed ' + pageRes.status);
	const html = await pageRes.text();

	const pm = html.match(/urlParams\s*=\s*'([^']+)'/);
	if (!pm) throw new Error('urlParams not found');
	const p = JSON.parse(pm[1]);
	const typeM = html.match(/var\s+type\s*=\s*"([^"]+)"/);

	const parts = u.pathname.split('/').filter(Boolean); // [seria, id, hash, 720p]
	const type = typeM ? typeM[1] : parts[0];
	const id = parts[1];
	const hash = parts[2];
	if (!type || !id || !hash) throw new Error('type/id/hash not found');

	const body = new URLSearchParams({
		d: p.d,
		d_sign: p.d_sign,
		pd: p.pd,
		pd_sign: p.pd_sign,
		ref: decodeURIComponent(p.ref || ''),
		ref_sign: p.ref_sign || '',
		bad_user: 'false',
		cdn_is_working: 'true',
		type,
		hash,
		id
	});

	const ftor = await undiciFetch(origin + '/ftor', {
		...proxyOpts,
		method: 'POST',
		headers: {
			'User-Agent': UA,
			Referer: url,
			Origin: origin,
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body
	});
	if (!ftor.ok) throw new Error('ftor ' + ftor.status);
	const data = /** @type {any} */ (await ftor.json());

	const links = data.links || {};
	/** @type {Record<string, string>} */
	const qualities = {};
	for (const q of Object.keys(links)) {
		const v = links[q];
		const raw = Array.isArray(v) ? v[0]?.src : v?.src;
		if (!raw) continue;
		let link = decodeLink(raw);
		if (link.startsWith('//')) link = 'https:' + link;
		qualities[q] = link;
	}
	if (!Object.keys(qualities).length) throw new Error('no links');

	const best = Object.keys(qualities)
		.map(Number)
		.filter(Boolean)
		.sort((a, b) => b - a)[0];
	const def = qualities[String(data.default)] ? String(data.default) : String(best || Object.keys(qualities)[0]);
	return { qualities, default: def };
}
