// Полностью клиентское приложение (SPA): без SSR и без пререндера —
// все данные грузятся с API Anixart в браузере, маршруты [id] динамические.
// adapter-static с fallback: index.html обслуживает все пути.
export const ssr = false;
export const prerender = false;
export const trailingSlash = 'ignore';
