import { extractSource } from './_lib/source.mjs';

// Известные внешние плееры: AniLibria, RuTube, VK, OK и Sibnet.
// См. _lib/source.mjs — там же проверка доменов, чтобы не превратить
// endpoint в открытый прокси.
export default async function handler(req, res) {
	const url = new URL(req.url, 'http://localhost').searchParams.get('url');
	res.setHeader('Content-Type', 'application/json; charset=utf-8');
	if (!url) {
		res.statusCode = 400;
		res.end(JSON.stringify({ error: 'url required' }));
		return;
	}
	try {
		const data = await extractSource(url);
		res.statusCode = 200;
		res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600');
		res.end(JSON.stringify(data));
	} catch (error) {
		res.statusCode = 502;
		res.end(JSON.stringify({ error: String(error?.message || error) }));
	}
}
