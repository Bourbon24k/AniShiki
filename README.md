<div align="center">
  <img src="static/favicon.svg" width="96" height="96" alt="AniShiki" />
  <h1>AniShiki — Web</h1>
  <p>Неофициальный веб-клиент <b>Anixart</b> в кинематографичном дизайне «Кинотеатр».<br>
  SvelteKit 5 · Tailwind · данные напрямую из API Anixart.</p>
</div>

> Создано в ознакомительных целях на основе открытых API. Не связано с Anixart. Лицензия GPL-2.0.

---

## ✨ Возможности

- **Главная «Кинотеатр»** — авто-ротация героя «В центре внимания», горизонтальные ряды (популярное с нумерацией, онгоинги, анонсы, завершённые, фильмы), «Продолжить просмотр».
- **Каталог / Поиск** — поиск по релизам, быстрые фильтры по типам, секция **Франшизы** в выдаче, бесконечная прокрутка.
- **Страница релиза** — постер-герой с блюром, оценка звёздами, избранное, списки (Смотрю / В планах / …), **статистика списков**, **кадры** (галерея с лайтбоксом), **трейлеры** (YouTube), **связанные тайтлы** + ссылка на франшизу, комментарии (со спойлерами и голосами), рекомендации.
- **Плеер** — выбор озвучки / источника (Kodik, Libria, Sibnet…) / эпизода, iframe-эмбеды и прямое видео (hls.js), история просмотра, отметка эпизодов, горячие клавиши (N / B / F), фуллскрин.
- **Обзор** — случайная подборка (с обновлением), интересное, высокий рейтинг, обсуждаемое, фильмы, рекомендации.
- **Расписание** по дням, **Случайный релиз**, **Лента** статей, **Франшизы** (`/franchise/[id]`).
- **Профиль** — наглядная статистика (время просмотра, эпизоды, избранное, друзья), распределение по спискам с кликабельной легендой; закладки по статусам, коллекции, история, оценки, друзья.
- **Аккаунт** — вход в реальные аккаунты Anixart (регистрация — в офиц. приложении, API её не отдаёт сторонним клиентам).
- **Соц-функции** — коллекции, закладки, история, уведомления, друзья и заявки.
- **Темы** AMOLED / тёмная / светлая, адаптив, PWA, фирменный анимешный талисман-аватар.

## 🚀 Запуск

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # статическая сборка в ./build (SPA)
npm run preview
```

## 🧱 Стек

SvelteKit 2 / Svelte 5 · Vite 5 · `@sveltejs/adapter-static` (SPA, `ssr=false`) · TailwindCSS 3 · [`anixartjs`](https://www.npmjs.com/package/anixartjs) · `hls.js`.

## 📁 Структура

```
src/lib/
  api.js            — клиент anixartjs + слой совместимости
  stores/index.js   — localStorage-сторы (токен, тема, плеер, эндпоинт)
  utils.js          — справочники и форматтеры
  components/        — Icon, LeftMenu, Hero, AnimeCard, ReleaseRow, GridList,
                       Comments, BookmarkButton, CollectionCard, ProfileGrid, Lightbox …
src/routes/
  +page (главная) · release/[id] · player/[id] · search · discover · random ·
  schedule · feed · collections · collection/[id] · franchise/[id] ·
  bookmarks · history · notifications · login · register · settings ·
  profile/[id] (+ bookmarks/collections/history/votes) · friends · friends/[id]
```

## ☁️ Деплой

Статическая SPA-сборка. Конфиг для Vercel — в [`vercel.json`](vercel.json)
(`outputDirectory: build`, SPA-rewrites на `index.html`).

## 📝 Заметки

- Запросы к API и медиа идут из браузера. При CORS-ограничениях смените сервер в Настройках
  (`api.anixart.app` ↔ `api-s.anixsekai.com`); в `vite.config.js` есть dev-прокси `/anixart-proxy`.
