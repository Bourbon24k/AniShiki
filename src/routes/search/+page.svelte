<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { getApi } from '$lib/api';
	import { releaseTypes, thumb, seasons } from '$lib/utils';
	import GridList from '$lib/components/GridList.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let query = '';
	let activeType = 0;
	let items = [];
	let franchises = [];
	let pageNum = 0;
	let loading = true;
	let loadingMore = false;
	let hasMore = true;
	let debounce;
	let reqId = 0;

	// Расширенные фильтры
	let filtersOpen = false;
	let fSort = 0; // 0 дата обновления, 1 оценка, 2 год, 3 популярность
	let fStatus = 0; // 0 любой, 1 завершён, 2 онгоинг, 3 анонс
	let fSeason = 0; // 0 любой, 1-4
	let fYearFrom = '';
	let fYearTo = '';
	const sortOpts = [
		{ v: 0, label: 'По обновлению' },
		{ v: 3, label: 'По популярности' },
		{ v: 1, label: 'По оценке' },
		{ v: 2, label: 'По году' }
	];
	const statusOpts = [
		{ v: 0, label: 'Любой' },
		{ v: 2, label: 'Онгоинг' },
		{ v: 1, label: 'Завершён' },
		{ v: 3, label: 'Анонс' }
	];
	const thisYear = new Date().getFullYear();
	const years = Array.from({ length: thisYear - 1989 }, (_, i) => thisYear - i);

	$: typeFilter = releaseTypes.find((t) => t.id === activeType)?.filter || {};
	$: activeFilters =
		(fStatus ? 1 : 0) + (fSeason ? 1 : 0) + (fYearFrom ? 1 : 0) + (fYearTo ? 1 : 0) + (fSort ? 1 : 0);
	function buildFilter() {
		/** @type {Record<string, any>} */
		const f = { ...typeFilter, sort: fSort };
		if (fStatus) f.status_id = fStatus;
		if (fSeason) f.season = fSeason;
		if (fYearFrom) f.start_year = Number(fYearFrom);
		if (fYearTo) f.end_year = Number(fYearTo);
		return f;
	}
	function applyFilters() {
		run(true);
	}
	function resetFilters() {
		fSort = 0;
		fStatus = 0;
		fSeason = 0;
		fYearFrom = '';
		fYearTo = '';
		run(true);
	}
	$: isSearch = query.trim().length > 0;

	async function run(reset = true) {
		const api = getApi();
		if (!api) return;
		const searching = query.trim().length > 0; // локально: реактивный isSearch может отставать
		const myReq = ++reqId;
		if (reset) {
			pageNum = 0;
			items = [];
			franchises = [];
			hasMore = true;
			loading = true;
		}
		try {
			let data, list;
			if (searching) {
				// v2-поиск отдаёт результаты в `releases` и одну франшизу в `related`.
				data = await api.search.releases({ query: query.trim(), searchBy: 0, page: pageNum });
				list = data?.releases || data?.content || [];
				if (reset) {
					const fr = data?.related;
					franchises = fr && fr.id && (fr.release_count || 0) > 1 ? [fr] : [];
				}
			} else {
				data = await api.release.filter(pageNum, buildFilter(), true);
				list = data?.content || [];
			}
			if (myReq !== reqId) return; // устаревший ответ
			items = reset ? list : [...items, ...list];
			// v2-поиск не возвращает total_page_count — пагинируем, пока страница полная.
			hasMore = searching ? list.length >= 20 : pageNum < (data?.total_page_count ?? 1) - 1;
		} catch (e) {
			console.error('search', e);
		}
		if (myReq === reqId) {
			loading = false;
			loadingMore = false;
		}
	}

	function more() {
		if (!hasMore || loadingMore) return;
		loadingMore = true;
		pageNum++;
		run(false);
	}

	function onInput() {
		clearTimeout(debounce);
		debounce = setTimeout(() => run(true), 350);
	}

	function pickType(id) {
		activeType = id;
		query = '';
		if (browser) goto(`/search?type=${id}`, { replaceState: true, keepFocus: true, noScroll: true });
		run(true);
	}

	onMount(() => {
		const t = $page.url.searchParams.get('type');
		const q = $page.url.searchParams.get('query');
		const g = $page.url.searchParams.get('genre');
		if (q) query = q;
		if (g) query = g;
		if (t != null) activeType = Number(t);
		run(true);
	});
</script>

<svelte:head><title>Поиск — AniShiki</title></svelte:head>

<div class="search-page">
	<div class="bar glass">
		<div class="input">
			<Icon name="search" size={20} />
			<input type="search" placeholder="Поиск аниме, жанров, студий…" bind:value={query} on:input={onInput} />
			{#if query}<button class="clear" on:click={() => { query = ''; run(true); }} aria-label="Очистить"><Icon name="close" size={18} /></button>{/if}
		</div>
	</div>

	{#if !isSearch}
		<div class="tabs-row">
			<div class="tabs no-scrollbar">
				{#each releaseTypes as t}
					<button class="tab" class:active={activeType === t.id} on:click={() => pickType(t.id)}>{t.label}</button>
				{/each}
			</div>
			<button class="filters-toggle" class:on={filtersOpen || activeFilters} on:click={() => (filtersOpen = !filtersOpen)}>
				<Icon name="discover" size={16} /> Фильтры{#if activeFilters}<span class="fbadge">{activeFilters}</span>{/if}
			</button>
		</div>

		{#if filtersOpen}
			<div class="filters glass">
				<div class="f">
					<label>Сортировка</label>
					<select bind:value={fSort} on:change={applyFilters}>
						{#each sortOpts as o}<option value={o.v}>{o.label}</option>{/each}
					</select>
				</div>
				<div class="f">
					<label>Статус</label>
					<select bind:value={fStatus} on:change={applyFilters}>
						{#each statusOpts as o}<option value={o.v}>{o.label}</option>{/each}
					</select>
				</div>
				<div class="f">
					<label>Сезон</label>
					<select bind:value={fSeason} on:change={applyFilters}>
						<option value={0}>Любой</option>
						{#each [1, 2, 3, 4] as s}<option value={s}>{seasons[s]}</option>{/each}
					</select>
				</div>
				<div class="f">
					<label>Год с</label>
					<select bind:value={fYearFrom} on:change={applyFilters}>
						<option value="">—</option>
						{#each years as y}<option value={y}>{y}</option>{/each}
					</select>
				</div>
				<div class="f">
					<label>Год по</label>
					<select bind:value={fYearTo} on:change={applyFilters}>
						<option value="">—</option>
						{#each years as y}<option value={y}>{y}</option>{/each}
					</select>
				</div>
				{#if activeFilters}
					<button class="reset" on:click={resetFilters}>Сбросить</button>
				{/if}
			</div>
		{/if}
	{/if}

	<div class="content">
		{#if isSearch && franchises.length}
			<div class="franchises">
				<h3 class="sec">Франшизы</h3>
				<div class="fr-row no-scrollbar">
					{#each franchises as f (f.id)}
						<a class="fr-card" href={`/franchise/${f.id}`}>
							<div class="fr-cover">
								{#if f.image}<img src={thumb(f.image, { w: 320 })} alt="" referrerpolicy="no-referrer" loading="lazy" decoding="async" />{/if}
								<div class="fr-shade"></div>
							</div>
							<div class="fr-body">
								<span class="fr-name">{f.name_ru || f.name}</span>
								<span class="fr-cnt">{f.release_count} тайтлов</span>
							</div>
						</a>
					{/each}
				</div>
				<h3 class="sec">Релизы</h3>
			</div>
		{/if}
		<GridList {items} {loading} {loadingMore} onMore={more} empty={isSearch ? 'Ничего не найдено' : 'Нет релизов'} />
	</div>
</div>

<style>
	.search-page {
		display: flex;
		flex-direction: column;
		height: 100%;
		max-width: 1500px;
		margin: 0 auto;
		padding: 16px 24px 0;
	}
	.bar {
		border-radius: 16px;
		padding: 6px;
		margin-bottom: 14px;
	}
	.input {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 14px;
		color: var(--secondary-text-color);
	}
	.input input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text-color);
		font-size: 15px;
		padding: 12px 0;
		font-family: inherit;
	}
	.clear {
		border: none;
		background: transparent;
		color: var(--secondary-text-color);
		cursor: pointer;
		display: grid;
		place-items: center;
		padding: 4px;
	}
	.tabs-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding-bottom: 14px;
	}
	.tabs {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		flex: 1;
		min-width: 0;
	}
	.filters-toggle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		white-space: nowrap;
		padding: 9px 16px;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		color: var(--text-color);
		border-radius: 12px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 600;
	}
	.filters-toggle.on {
		border-color: var(--primary-color);
		color: var(--primary-color);
	}
	.fbadge {
		display: inline-grid;
		place-items: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: 9px;
		background: var(--primary-color);
		color: #fff;
		font-size: 11px;
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 14px;
		align-items: flex-end;
		padding: 16px;
		border-radius: 14px;
		margin-bottom: 16px;
	}
	.filters .f {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.filters label {
		font-size: 12px;
		color: var(--secondary-text-color);
		font-weight: 600;
	}
	.filters select {
		padding: 9px 12px;
		border-radius: 10px;
		border: 1px solid var(--glass-border);
		background: var(--background-color);
		color: var(--text-color);
		font-size: 14px;
		cursor: pointer;
		min-width: 130px;
	}
	.reset {
		padding: 9px 16px;
		border-radius: 10px;
		border: 1px solid var(--glass-border);
		background: transparent;
		color: var(--secondary-text-color);
		cursor: pointer;
		font-weight: 600;
	}
	.tab {
		white-space: nowrap;
		padding: 9px 18px;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		color: var(--secondary-text-color);
		border-radius: 12px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 600;
		transition: all 0.2s ease;
	}
	.tab.active {
		background: var(--primary-color);
		color: #fff;
		border-color: transparent;
	}
	.content {
		flex: 1;
		min-height: 0;
		padding-bottom: 24px;
		overflow-y: auto;
	}
	.sec {
		font-size: 16px;
		font-weight: 700;
		margin: 4px 0 14px;
	}
	.fr-row {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 240px;
		gap: 14px;
		overflow-x: auto;
		padding-bottom: 8px;
		margin-bottom: 22px;
	}
	.fr-card {
		border-radius: 14px;
		overflow: hidden;
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		transition: transform 0.18s ease, border-color 0.2s ease;
	}
	.fr-card:hover {
		transform: translateY(-3px);
		border-color: var(--primary-color);
	}
	.fr-cover {
		position: relative;
		aspect-ratio: 16/9;
		background: linear-gradient(135deg, #2a2540, #3a2030);
	}
	.fr-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.fr-shade {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.6), transparent 60%);
	}
	.fr-body {
		padding: 10px 12px;
	}
	.fr-name {
		display: block;
		font-weight: 700;
		font-size: 14px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.fr-cnt {
		font-size: 12px;
		color: var(--secondary-text-color);
	}
	@media (max-width: 768px) {
		.search-page {
			padding: 12px 14px 0;
		}
	}
</style>
