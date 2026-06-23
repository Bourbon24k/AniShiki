import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
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
