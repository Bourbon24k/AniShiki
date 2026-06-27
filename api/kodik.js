import { extractKodik } from './_lib/kodik.mjs';

// Vercel serverless function: /api/kodik?url=<kodik embed>
export default async function handler(req, res) {
	const url = new URL(req.url, 'http://localhost').searchParams.get('url');
	res.setHeader('Content-Type', 'application/json; charset=utf-8');
	if (!url) {
		res.statusCode = 400;
		res.end(JSON.stringify({ error: 'url required' }));
		return;
	}
	try {
		const data = await extractKodik(url);
		res.statusCode = 200;
		// результат живёт ~сутки (в ссылке свой срок годности), кэшируем умеренно
		res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=3600');
		res.end(JSON.stringify(data));
	} catch (e) {
		res.statusCode = 502;
		res.end(JSON.stringify({ error: String(e?.message || e) }));
	}
}
