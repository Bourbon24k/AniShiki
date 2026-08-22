<script>
	import { onMount, tick } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { getApi } from '$lib/api';
	import { userToken } from '$lib/stores';
	import { thumb } from '$lib/utils';
	import { GENRE_GROUPS, FEATURED_GENRES, canonicalGenre } from '$lib/genres';
	import {
		buildFilter,
		SORT_OPTIONS,
		STATUS_OPTIONS,
		CATEGORY_OPTIONS,
		SEASON_OPTIONS,
		AGE_RATING_OPTIONS,
		EPISODE_OPTIONS,
		DURATION_OPTIONS,
		COUNTRY_OPTIONS,
		LIST_EXCLUSIONS
	} from '$lib/filters';
	import { smartSearch, rank, readHistory, pushHistory, clearHistory, normalize } from '$lib/search';
	import { haptic } from '$lib/ios';
	import GridList from '$lib/components/GridList.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Sheet from '$lib/components/Sheet.svelte';

	/* ───────────── состояние ───────────── */

	let query = '';
	let items = [];
	let franchise = null;
	let pageNum = 0;
	let loading = true;
	let loadingMore = false;
	let hasMore = true;
	let debounce;
	let reqId = 0;

	let inputEl;
	let suggestOpen = false;
	let history = [];

	let filtersOpen = false;

	/** Сортировка по умолчанию — по популярности: так выдача полезнее «последних». */
	const DEFAULT_SORT = 3;

	/** Живой фильтр каталога. null = «любой». */
	let f = {
		sort: DEFAULT_SORT,
		status_id: null,
		category_id: null,
		season: null,
		start_year: null,
		end_year: null,
		country: null,
		studio: null,
		genres: [],
		is_genres_exclude_mode_enabled: false,
		age_ratings: [],
		episodes_from: null,
		episodes_to: null,
		episode_duration_from: null,
		episode_duration_to: null,
		profile_list_exclusions: []
	};

	/** Размер страницы каталога Anixart. */
	const PAGE_SIZE = 25;

	const thisYear = new Date().getFullYear();
	const years = Array.from({ length: thisYear - 1959 }, (_, i) => thisYear - i);

	/** Быстрые пресеты — те же, что и в ссылках с главной (?type=N). */
	const presets = [
		{ id: 5, label: 'Популярные', patch: { sort: 3, status_id: null, category_id: null } },
		{ id: 0, label: 'Последние', patch: { sort: 0, status_id: null, category_id: null } },
		{ id: 1, label: 'Онгоинги', patch: { sort: 0, status_id: 2, category_id: null } },
		{ id: 2, label: 'Анонсы', patch: { sort: 0, status_id: 3, category_id: null } },
		{ id: 3, label: 'Завершённые', patch: { sort: 0, status_id: 1, category_id: null } },
		{ id: 4, label: 'Фильмы', patch: { sort: 0, status_id: null, category_id: 2 } }
	];
	let activePreset = 5;

	$: isSearch = query.trim().length > 0;
	$: activeCount =
		(f.sort !== DEFAULT_SORT ? 1 : 0) +
		(f.status_id ? 1 : 0) +
		(f.category_id ? 1 : 0) +
		(f.season ? 1 : 0) +
		(f.start_year ? 1 : 0) +
		(f.end_year ? 1 : 0) +
		(f.country ? 1 : 0) +
		(f.studio ? 1 : 0) +
		f.genres.length +
		f.age_ratings.length +
		f.profile_list_exclusions.length +
		(f.episodes_from || f.episodes_to ? 1 : 0) +
		(f.episode_duration_from || f.episode_duration_to ? 1 : 0);

	/** Подсказки: совпавшие жанры + недавние запросы. */
	$: suggestions = buildSuggestions(query, history);

	function buildSuggestions(value, recent) {
		const q = normalize(value);
		if (!q) {
			return {
				genres: FEATURED_GENRES.slice(0, 10),
				recent: recent.slice(0, 6),
				label: 'Популярные жанры'
			};
		}
		const genres = GENRE_GROUPS.flatMap((g) => g.items)
			.filter((name) => normalize(name).includes(q))
			.slice(0, 8);
		return {
			genres,
			recent: recent.filter((r) => normalize(r).includes(q)).slice(0, 4),
			label: 'Жанры'
		};
	}

	/* ───────────── загрузка ───────────── */

	async function run(reset = true) {
		const api = getApi();
		if (!api) return;
		const searching = query.trim().length > 0;
		const myReq = ++reqId;
		if (reset) {
			pageNum = 0;
			items = [];
			franchise = null;
			hasMore = true;
			loading = true;
		}
		try {
			if (searching) {
				const result = await smartSearch(query, { page: pageNum });
				if (myReq !== reqId) return;
				items = reset ? result.items : rank([...items, ...result.items], query);
				if (reset) franchise = result.franchise;
				hasMore = result.hasMore;
			} else {
				const data = await api.release.filter(pageNum, buildFilter(f), true);
				if (myReq !== reqId) return;
				const list = data?.content || [];
				items = reset ? list : [...items, ...list];
				// Для фильтра по жанрам сервер отдаёт total_page_count = 0, хотя
				// страниц много: тогда ориентируемся на полноту страницы.
				const pages = Number(data?.total_page_count) || 0;
				hasMore = pages > 0 ? pageNum < pages - 1 : list.length >= PAGE_SIZE;
			}
		} catch (e) {
			console.error('search', e);
			if (myReq === reqId) hasMore = false;
		}
		if (myReq === reqId) {
			loading = false;
			loadingMore = false;
		}
	}

	function more() {
		if (!hasMore || loadingMore || loading) return;
		loadingMore = true;
		pageNum++;
		run(false);
	}

	function onInput() {
		suggestOpen = true;
		clearTimeout(debounce);
		// Одна буква почти всегда даёт мусор — ждём осмысленного запроса.
		if (query.trim().length === 1) return;
		debounce = setTimeout(() => run(true), 320);
	}

	function submitQuery() {
		clearTimeout(debounce);
		suggestOpen = false;
		inputEl?.blur();
		if (query.trim()) history = pushHistory(query);
		run(true);
	}

	function clearQuery() {
		query = '';
		clearTimeout(debounce);
		run(true);
	}

	/* ───────────── жанры и фильтры ───────────── */

	function toggleGenre(name) {
		haptic('select');
		f.genres = f.genres.includes(name)
			? f.genres.filter((g) => g !== name)
			: [...f.genres, name];
		applyFilters();
	}

	function pickGenreFromSuggest(name) {
		query = '';
		suggestOpen = false;
		inputEl?.blur();
		if (!f.genres.includes(name)) f.genres = [...f.genres, name];
		syncUrl();
		run(true);
	}

	function pickRecent(value) {
		query = value;
		submitQuery();
	}

	function toggleIn(list, value) {
		return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
	}

	function applyPreset(preset) {
		activePreset = preset.id;
		f = { ...f, ...preset.patch };
		query = '';
		syncUrl();
		run(true);
	}

	function applyFilters() {
		activePreset = -1;
		syncUrl();
		run(true);
	}

	function resetFilters() {
		f = {
			sort: DEFAULT_SORT,
			status_id: null,
			category_id: null,
			season: null,
			start_year: null,
			end_year: null,
			country: null,
			studio: null,
			genres: [],
			is_genres_exclude_mode_enabled: false,
			age_ratings: [],
			episodes_from: null,
			episodes_to: null,
			episode_duration_from: null,
			episode_duration_to: null,
			profile_list_exclusions: []
		};
		activePreset = 5;
		syncUrl();
		run(true);
	}

	function setEpisodes(option) {
		f.episodes_from = option.episodes_from;
		f.episodes_to = option.episodes_to;
		applyFilters();
	}

	function setDuration(option) {
		f.episode_duration_from = option.episode_duration_from;
		f.episode_duration_to = option.episode_duration_to;
		applyFilters();
	}

	/** Отражаем жанры и запрос в адресе — ссылкой можно поделиться. */
	function syncUrl() {
		if (!browser) return;
		const params = new URLSearchParams();
		if (query.trim()) params.set('query', query.trim());
		for (const g of f.genres) params.append('genre', g);
		if (activePreset > 0) params.set('type', String(activePreset));
		const search = params.toString();
		goto(search ? `/search?${search}` : '/search', {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	/* ───────────── инициализация ───────────── */

	onMount(async () => {
		history = readHistory();
		const url = $page.url.searchParams;

		const genres = url.getAll('genre').map((g) => canonicalGenre(g) || g).filter(Boolean);
		if (genres.length) f.genres = [...new Set(genres)];

		const type = url.get('type');
		if (type != null) {
			const preset = presets.find((p) => p.id === Number(type));
			if (preset) {
				activePreset = preset.id;
				f = { ...f, ...preset.patch };
			}
		}

		const season = url.get('season');
		if (season) f.season = Number(season);
		const year = url.get('year');
		if (year) {
			f.start_year = Number(year);
			f.end_year = Number(year);
		}
		if (f.genres.length || season || year) activePreset = -1;

		const q = url.get('query');
		if (q) query = q;

		await tick();
		run(true);
	});
</script>

<svelte:head><title>{isSearch ? `${query} — поиск` : 'Поиск'} — AniShiki</title></svelte:head>

<div class="search-page">
	<div class="bar-wrap">
		<div class="bar glass">
			<Icon name="search" size={20} />
			<input
				bind:this={inputEl}
				type="search"
				enterkeyhint="search"
				autocomplete="off"
				autocorrect="off"
				spellcheck="false"
				placeholder="Название, жанр, студия…"
				bind:value={query}
				on:input={onInput}
				on:focus={() => (suggestOpen = true)}
				on:keydown={(e) => e.key === 'Enter' && submitQuery()}
			/>
			{#if query}
				<button class="icon-btn" on:click={clearQuery} aria-label="Очистить">
					<Icon name="close" size={18} />
				</button>
			{/if}
			<button
				class="icon-btn filters"
				class:on={activeCount > 0}
				on:click={() => (filtersOpen = true)}
				aria-label="Фильтры"
			>
				<Icon name="discover" size={19} />
				{#if activeCount}<span class="fbadge">{activeCount}</span>{/if}
			</button>
		</div>

		{#if suggestOpen}
			<button class="suggest-scrim" on:click={() => (suggestOpen = false)} aria-label="Скрыть подсказки"></button>
			<div class="suggest glass">
				{#if suggestions.recent.length}
					<div class="sug-head">
						<span>Недавнее</span>
						<button on:click={() => (history = clearHistory())}>Очистить</button>
					</div>
					{#each suggestions.recent as item}
						<button class="sug-row" on:click={() => pickRecent(item)}>
							<Icon name="history" size={16} /> {item}
						</button>
					{/each}
				{/if}
				{#if suggestions.genres.length}
					<div class="sug-head"><span>{suggestions.label}</span></div>
					<div class="sug-chips">
						{#each suggestions.genres as g}
							<button class="chip small" class:active={f.genres.includes(g)} on:click={() => pickGenreFromSuggest(g)}>
								{g}
							</button>
						{/each}
					</div>
				{/if}
				{#if !suggestions.recent.length && !suggestions.genres.length}
					<p class="sug-empty">Нажмите Enter, чтобы искать «{query}»</p>
				{/if}
			</div>
		{/if}
	</div>

	{#if !isSearch}
		<div class="presets no-scrollbar">
			{#each presets as p}
				<button class="chip" class:active={activePreset === p.id} on:click={() => applyPreset(p)}>{p.label}</button>
			{/each}
		</div>
	{/if}

	{#if f.genres.length}
		<div class="active-genres no-scrollbar">
			<span class="ag-label">{f.is_genres_exclude_mode_enabled ? 'Кроме' : 'Жанры'}:</span>
			{#each f.genres as g}
				<button class="chip small active" on:click={() => toggleGenre(g)}>
					{g} <Icon name="close" size={13} />
				</button>
			{/each}
			<button class="chip small ghost" on:click={() => { f.genres = []; applyFilters(); }}>Сбросить</button>
		</div>
	{/if}

	<div class="content">
		{#if isSearch && franchise}
			<a class="franchise" href={`/franchise/${franchise.id}`}>
				<div class="fr-cover">
					{#if franchise.image}
						<img src={thumb(franchise.image, { w: 320 })} alt="" referrerpolicy="no-referrer" loading="lazy" decoding="async" />
					{/if}
				</div>
				<div class="fr-body">
					<span class="fr-kicker">Франшиза</span>
					<span class="fr-name">{franchise.name_ru || franchise.name}</span>
					<span class="fr-cnt">{franchise.release_count} тайтлов</span>
				</div>
				<Icon name="chevronRight" size={20} />
			</a>
		{/if}

		<GridList
			{items}
			{loading}
			{loadingMore}
			onMore={more}
			empty={isSearch ? 'Ничего не нашлось. Попробуйте короче или по-другому.' : 'Под фильтры ничего не подошло'}
		/>
	</div>
</div>

<Sheet open={filtersOpen} title="Фильтры" tall on:close={() => (filtersOpen = false)}>
	<div class="fgroup">
		<h3>Сортировка</h3>
		<div class="chips">
			{#each SORT_OPTIONS as o}
				<button class="chip small" class:active={f.sort === o.value} on:click={() => { f.sort = o.value; applyFilters(); }}>{o.label}</button>
			{/each}
		</div>
	</div>

	<div class="fgroup">
		<div class="fgroup-head">
			<h3>Жанры</h3>
			<label class="exclude">
				<input
					type="checkbox"
					bind:checked={f.is_genres_exclude_mode_enabled}
					on:change={applyFilters}
				/>
				Исключить выбранные
			</label>
		</div>
		{#each GENRE_GROUPS as group}
			<h4>{group.name}</h4>
			<div class="chips">
				{#each group.items as g}
					<button class="chip small" class:active={f.genres.includes(g)} on:click={() => toggleGenre(g)}>{g}</button>
				{/each}
			</div>
		{/each}
	</div>

	<div class="fgroup">
		<h3>Статус</h3>
		<div class="chips">
			{#each STATUS_OPTIONS as o}
				<button class="chip small" class:active={f.status_id === o.value} on:click={() => { f.status_id = o.value; applyFilters(); }}>{o.label}</button>
			{/each}
		</div>
	</div>

	<div class="fgroup">
		<h3>Тип</h3>
		<div class="chips">
			{#each CATEGORY_OPTIONS as o}
				<button class="chip small" class:active={f.category_id === o.value} on:click={() => { f.category_id = o.value; applyFilters(); }}>{o.label}</button>
			{/each}
		</div>
	</div>

	<div class="fgroup">
		<h3>Сезон</h3>
		<div class="chips">
			{#each SEASON_OPTIONS as o}
				<button class="chip small" class:active={f.season === o.value} on:click={() => { f.season = o.value; applyFilters(); }}>{o.label}</button>
			{/each}
		</div>
	</div>

	<div class="fgroup">
		<h3>Год</h3>
		<div class="row-2">
			<label>
				<span>с</span>
				<select bind:value={f.start_year} on:change={applyFilters}>
					<option value={null}>—</option>
					{#each years as y}<option value={y}>{y}</option>{/each}
				</select>
			</label>
			<label>
				<span>по</span>
				<select bind:value={f.end_year} on:change={applyFilters}>
					<option value={null}>—</option>
					{#each years as y}<option value={y}>{y}</option>{/each}
				</select>
			</label>
		</div>
	</div>

	<div class="fgroup">
		<h3>Возрастной рейтинг</h3>
		<div class="chips">
			{#each AGE_RATING_OPTIONS as o}
				<button
					class="chip small"
					class:active={f.age_ratings.includes(o.value)}
					on:click={() => { f.age_ratings = toggleIn(f.age_ratings, o.value); applyFilters(); }}
				>{o.label}</button>
			{/each}
		</div>
	</div>

	<div class="fgroup">
		<h3>Серий</h3>
		<div class="chips">
			{#each EPISODE_OPTIONS as o}
				<button
					class="chip small"
					class:active={f.episodes_from === o.episodes_from && f.episodes_to === o.episodes_to}
					on:click={() => setEpisodes(o)}
				>{o.label}</button>
			{/each}
		</div>
	</div>

	<div class="fgroup">
		<h3>Длительность серии</h3>
		<div class="chips">
			{#each DURATION_OPTIONS as o}
				<button
					class="chip small"
					class:active={f.episode_duration_from === o.episode_duration_from && f.episode_duration_to === o.episode_duration_to}
					on:click={() => setDuration(o)}
				>{o.label}</button>
			{/each}
		</div>
	</div>

	<div class="fgroup">
		<h3>Страна</h3>
		<div class="chips">
			{#each COUNTRY_OPTIONS as o}
				<button class="chip small" class:active={f.country === o.value} on:click={() => { f.country = o.value; applyFilters(); }}>{o.label}</button>
			{/each}
		</div>
	</div>

	{#if $userToken}
		<div class="fgroup">
			<h3>Скрыть из выдачи</h3>
			<p class="hint">То, что уже лежит в ваших списках.</p>
			<div class="chips">
				{#each LIST_EXCLUSIONS as o}
					<button
						class="chip small"
						class:active={f.profile_list_exclusions.includes(o.value)}
						on:click={() => { f.profile_list_exclusions = toggleIn(f.profile_list_exclusions, o.value); applyFilters(); }}
					>{o.label}</button>
				{/each}
			</div>
		</div>
	{/if}

	<svelte:fragment slot="footer">
		<div class="sheet-actions">
			<button class="btn ghost" on:click={resetFilters}>Сбросить всё</button>
			<button class="btn primary" on:click={() => (filtersOpen = false)}>Показать</button>
		</div>
	</svelte:fragment>
</Sheet>

<style>
	.search-page {
		display: flex;
		flex-direction: column;
		height: 100%;
		max-width: 1500px;
		margin: 0 auto;
		padding: 16px 24px 0;
	}
	.bar-wrap {
		position: relative;
		z-index: 40;
		margin-bottom: 12px;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 10px;
		border-radius: 16px;
		padding: 0 12px;
		color: var(--secondary-text-color);
	}
	.bar input {
		flex: 1;
		min-width: 0;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text-color);
		font-size: 16px; /* меньше 16px — и iOS зумит страницу на фокусе */
		padding: 13px 0;
		font-family: inherit;
	}
	.bar input::-webkit-search-cancel-button {
		display: none;
	}
	.icon-btn {
		position: relative;
		width: 34px;
		height: 34px;
		display: grid;
		place-items: center;
		border: none;
		background: transparent;
		color: var(--secondary-text-color);
		border-radius: 50%;
		cursor: pointer;
		flex-shrink: 0;
	}
	.icon-btn.on {
		color: var(--primary-color);
	}
	.fbadge {
		position: absolute;
		top: -1px;
		right: -3px;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		display: grid;
		place-items: center;
		border-radius: 8px;
		background: var(--primary-color);
		color: #fff;
		font-size: 10px;
		font-weight: 700;
	}

	.suggest-scrim {
		position: fixed;
		inset: 0;
		background: transparent;
		border: none;
		z-index: 1;
	}
	.suggest {
		position: absolute;
		top: calc(100% + 8px);
		left: 0;
		right: 0;
		z-index: 2;
		border-radius: 16px;
		padding: 12px 14px 14px;
		max-height: 58vh;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		box-shadow: 0 18px 44px rgba(0, 0, 0, 0.4);
	}
	.sug-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 12px;
		font-weight: 700;
		color: var(--third-text-color);
		text-transform: uppercase;
		letter-spacing: 0.4px;
		margin: 6px 0 8px;
	}
	.sug-head button {
		border: none;
		background: transparent;
		color: var(--primary-color);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		text-transform: none;
		letter-spacing: 0;
	}
	.sug-row {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 9px 8px;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--text-color);
		font-size: 14px;
		text-align: left;
		cursor: pointer;
	}
	.sug-row:active {
		background: var(--alt-background-color);
	}
	.sug-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
	}
	.sug-empty {
		font-size: 13px;
		color: var(--secondary-text-color);
		padding: 6px 2px;
	}

	.presets {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding-bottom: 12px;
	}
	.active-genres {
		display: flex;
		align-items: center;
		gap: 7px;
		overflow-x: auto;
		padding-bottom: 12px;
	}
	.ag-label {
		font-size: 12px;
		font-weight: 700;
		color: var(--third-text-color);
		white-space: nowrap;
	}

	.chip {
		white-space: nowrap;
		padding: 9px 16px;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		color: var(--secondary-text-color);
		border-radius: 12px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 600;
		transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
	}
	.chip.small {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 7px 12px;
		font-size: 13px;
		font-weight: 500;
		border-radius: 10px;
	}
	.chip.active {
		background: var(--primary-color);
		color: #fff;
		border-color: transparent;
	}
	.chip.ghost {
		background: transparent;
	}

	.content {
		flex: 1;
		min-height: 0;
		padding-bottom: 24px;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.franchise {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 10px 14px 10px 10px;
		margin-bottom: 18px;
		border-radius: 16px;
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		color: var(--text-color);
	}
	.fr-cover {
		width: 92px;
		min-width: 92px;
		aspect-ratio: 16/9;
		border-radius: 11px;
		overflow: hidden;
		background: linear-gradient(135deg, #2a2540, #3a2030);
	}
	.fr-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.fr-body {
		flex: 1;
		min-width: 0;
	}
	.fr-kicker {
		display: block;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--primary-color);
	}
	.fr-name {
		display: block;
		font-weight: 700;
		font-size: 15px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.fr-cnt {
		font-size: 12.5px;
		color: var(--secondary-text-color);
	}

	/* шторка фильтров */
	.fgroup {
		padding: 14px 0;
		border-bottom: 1px solid var(--glass-border);
	}
	.fgroup:last-child {
		border-bottom: none;
	}
	.fgroup-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	.fgroup h3 {
		font-size: 15px;
		font-weight: 700;
		margin-bottom: 10px;
	}
	.fgroup-head h3 {
		margin-bottom: 10px;
	}
	.fgroup h4 {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.4px;
		color: var(--third-text-color);
		margin: 12px 0 8px;
	}
	.exclude {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 13px;
		color: var(--secondary-text-color);
		margin-bottom: 10px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
	}
	.hint {
		font-size: 12.5px;
		color: var(--third-text-color);
		margin: -4px 0 10px;
	}
	.row-2 {
		display: flex;
		gap: 12px;
	}
	.row-2 label {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--secondary-text-color);
	}
	.row-2 select {
		flex: 1;
		min-width: 0;
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid var(--glass-border);
		background: var(--background-color);
		color: var(--text-color);
		font-size: 15px;
	}
	.sheet-actions {
		display: flex;
		gap: 10px;
	}
	.btn {
		flex: 1;
		padding: 13px;
		border-radius: 13px;
		font-weight: 700;
		font-size: 14.5px;
		cursor: pointer;
		border: 1px solid var(--glass-border);
	}
	.btn.ghost {
		background: transparent;
		color: var(--secondary-text-color);
	}
	.btn.primary {
		background: var(--primary-color);
		border-color: transparent;
		color: #fff;
	}

	@media (max-width: 768px) {
		.search-page {
			padding: 12px 14px 0;
		}
	}
</style>
