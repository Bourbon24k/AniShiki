import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Эмуляция serverless-функции /api/kodik на dev-сервере (в проде её отдаёт Vercel).
const devKodikApi = {
	name: 'dev-api-kodik',
	configureServer(server) {
		server.middlewares.use('/api/kodik', async (req, res) => {
			const target = new URL(req.url, 'http://localhost').searchParams.get('url');
			res.setHeader('Content-Type', 'application/json; charset=utf-8');
			try {
				const { extractKodik } = await import('./api/_lib/kodik.mjs');
				const data = await extractKodik(target);
				res.end(JSON.stringify(data));
			} catch (e) {
				res.statusCode = 502;
				res.end(JSON.stringify({ error: String(e?.message || e) }));
			}
		});
	}
};

export default defineConfig({
	plugins: [sveltekit(), devKodikApi],
	server: {
		// Dev-прокси на случай CORS-ограничений Anixart API.
		// Фронт обращается к https://api.anixart.app напрямую; если браузер блокирует —
		// можно переключить endpoint в настройках на путь через этот прокси.
		proxy: {
			'/anixart-proxy': {
				target: 'https://api.anixart.app',
				changeOrigin: true,
				secure: true,
				rewrite: (path) => path.replace(/^\/anixart-proxy/, '')
			}
		}
	}
});
