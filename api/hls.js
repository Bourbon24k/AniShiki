// Прокси HLS-манифеста: /api/hls?url=<m3u8>
//
// CDN Kodik отдаёт плейлист с Content-Type: text/plain, а нативный HLS в Safari
// (iPhone, iPad, macOS) такой манифест не принимает — получается вечная загрузка
// и 0:00 вместо длительности. Здесь плейлист отдаётся с правильным типом.
//
// Через функцию проходит только сам плейлист (пара килобайт): все ссылки на
// сегменты разворачиваются в абсолютные, поэтому видео плеер тянет напрямую с
// CDN, мимо нас.

const MANIFEST_TYPE = 'application/vnd.apple.mpegurl';
const ALLOWED_HOSTS = /(^|\.)(solodcdn\.com|kodik\.info|aniqit\.com|anivod\.com|kodikplayer\.com)$/i;

/** Развернуть относительные ссылки плейлиста относительно его конечного адреса. */
export function rewriteManifest(text, baseUrl) {
	const base = new URL(baseUrl);
	const absolute = (ref) => {
		try {
			return new URL(ref, base).toString();
		} catch {
			return ref;
		}
	};
	return text
		.split('\n')
		.map((line) => {
			const trimmed = line.trim();
			if (!trimmed) return line;
			// Ключи шифрования и вложенные плейлисты прячутся в атрибуте URI="…".
			if (trimmed.startsWith('#')) {
				return line.replace(/URI="([^"]+)"/g, (_, ref) => `URI="${absolute(ref)}"`);
			}
			return absolute(trimmed);
		})
		.join('\n');
}

export default async function handler(req, res) {
	const target = new URL(req.url, 'http://localhost').searchParams.get('url');
	if (!target) {
		res.statusCode = 400;
		res.setHeader('Content-Type', 'application/json; charset=utf-8');
		res.end(JSON.stringify({ error: 'url required' }));
		return;
	}

	let parsed;
	try {
		parsed = new URL(target);
	} catch {
		res.statusCode = 400;
		res.setHeader('Content-Type', 'application/json; charset=utf-8');
		res.end(JSON.stringify({ error: 'bad url' }));
		return;
	}
	// Открытый прокси нам не нужен: пускаем только на CDN плееров.
	if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.test(parsed.hostname)) {
		res.statusCode = 403;
		res.setHeader('Content-Type', 'application/json; charset=utf-8');
		res.end(JSON.stringify({ error: 'host not allowed' }));
		return;
	}

	try {
		const upstream = await fetch(parsed.toString(), {
			headers: { 'User-Agent': 'AniShiki/1.0', Accept: '*/*' },
			redirect: 'follow',
			signal: AbortSignal.timeout(15000)
		});
		if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
		const text = await upstream.text();
		if (!text.includes('#EXTM3U')) throw new Error('not a playlist');

		res.statusCode = 200;
		res.setHeader('Content-Type', MANIFEST_TYPE);
		res.setHeader('Access-Control-Allow-Origin', '*');
		// Ссылки живут ограниченное время, поэтому кэшируем ненадолго.
		res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
		// upstream.url — адрес после редиректов, только он годится как база.
		res.end(rewriteManifest(text, upstream.url || parsed.toString()));
	} catch (e) {
		res.statusCode = 502;
		res.setHeader('Content-Type', 'application/json; charset=utf-8');
		res.end(JSON.stringify({ error: String(e?.message || e) }));
	}
}
