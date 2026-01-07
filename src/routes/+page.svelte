<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page as pageStore } from '$app/stores';
	import { getApi } from '$lib/api';
	import Preloader from '$lib/components/Preloader.svelte';
	import AnimeCard from '$lib/components/AnimeCard.svelte';
	
	let typeReleases = 0;
	let page = 0;
	let filterArgs = { sort: 0, status_id: null, category_id: null };
	let allData = [];
	let isLoading = true;
	let isLoadingMore = false;
	let api = null;

	const releaseTypes = [
		{ id: 0, label: 'Последние' },
		{ id: 1, label: 'Онгоинги' },
		{ id: 2, label: 'Анонсы' },
		{ id: 3, label: 'Завершенные' },
		{ id: 4, label: 'Фильмы' },
		{ id: 5, label: 'Популярные' }
	];

	onMount(async () => {
		if (browser) {
			api = getApi();
			const t = $pageStore?.url?.searchParams?.get('type');
			const parsed = t !== null ? Number(t) : null;
			if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 5) {
				setReleasesType(parsed);
			} else {
				await loadReleases();
			}
		}
	});

	$: if (browser && api) {
		const t = $pageStore?.url?.searchParams?.get('type');
		const parsed = t !== null ? Number(t) : null;
		if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 5 && parsed !== typeReleases) {
			setReleasesType(parsed);
		}
	}

	async function loadReleases() {
		if (!api) return;
		isLoading = true;
		try {
			console.log('Loading releases with filter:', JSON.stringify(filterArgs), 'page:', page);
			const data = await api.release.filter(page, filterArgs, true);
			console.log('Received data:', data?.content?.length, 'releases');
			allData = data.content || [];
		} catch (e) {
			console.error('Error loading releases:', e);
		}
		isLoading = false;
	}

	async function loadMore() {
		if (!api || isLoadingMore) return;
		isLoadingMore = true;
		page++;
		try {
			const data = await api.release.filter(page, filterArgs, true);
			allData = [...allData, ...(data.content || [])];
		} catch (e) {
			console.error('Error loading more:', e);
		}
		isLoadingMore = false;
	}

	function setReleasesType(type) {
		if (typeReleases === type) return;
		
		typeReleases = type;
		page = 0;
		allData = [];
		
		switch (type) {
			case 0:
				filterArgs = { sort: 0, status_id: null, category_id: null };
				break;
			case 1:
				filterArgs = { sort: 0, status_id: 2, category_id: null };
				break;
			case 2:
				filterArgs = { sort: 0, status_id: 3, category_id: null };
				break;
			case 3:
				filterArgs = { sort: 0, status_id: 1, category_id: null };
				break;
			case 4:
				filterArgs = { sort: 0, status_id: null, category_id: 2 };
				break;
			case 5:
				filterArgs = { sort: 1, status_id: null, category_id: null };
				break;
		}
		
		loadReleases();
	}

	function handleScroll(e) {
		const { scrollTop, scrollHeight, clientHeight } = e.target;
		if (scrollHeight - scrollTop - clientHeight < 500 && !isLoadingMore) {
			loadMore();
		}
	}
</script>

<svelte:head>
	<title>AniShika Web - Главная</title>
	<meta name="description" content="AniShika - Неофициальный веб-клиент Anixart" />
</svelte:head>

<div class="home-page" on:scroll={handleScroll}>
	<div class="releases-type">
		{#each releaseTypes as type}
			<button
				class="type-btn"
				class:selected={typeReleases === type.id}
				on:click={() => setReleasesType(type.id)}
			>
				{type.label}
			</button>
		{/each}
	</div>

	<div class="releases-container">
		{#if isLoading}
			<Preloader size="large" />
		{:else if allData.length === 0}
			<div class="empty-state">
				<p>Нет релизов для отображения</p>
			</div>
		{:else}
			{#each allData as anime (anime.id)}
				<AnimeCard {anime} type="full-row" />
			{/each}
			
			{#if isLoadingMore}
				<Preloader size="small" />
			{/if}
		{/if}
	</div>
</div>

<style>
	.home-page {
		width: 100%;
		height: 100%;
		overflow-y: auto;
	}

	.releases-type {
		display: flex;
		justify-content: center;
		align-items: center;
		position: sticky;
		top: 0;
		background-color: var(--background-color);
		z-index: 10;
		padding: 10px 0;
		gap: 8px;
		flex-wrap: wrap;
	}

	.type-btn {
		padding: 10px 20px;
		border: none;
		background: transparent;
		color: var(--secondary-text-color);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		position: relative;
		border-radius: 8px;
	}

	.type-btn:hover {
		background-color: var(--alt-background-color);
		color: var(--text-color);
	}

	.type-btn.selected {
		color: var(--text-color);
		font-weight: bold;
	}

	.type-btn.selected::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 60%;
		height: 2px;
		background-color: var(--primary-color);
		border-radius: 2px;
	}

	.releases-container {
		display: flex;
		flex-direction: column;
		padding-bottom: 20px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 60px 20px;
		color: var(--secondary-text-color);
	}

	@media (max-width: 768px) {
		.releases-type {
			padding: 8px 12px;
			gap: 4px;
		}

		.type-btn {
			padding: 8px 12px;
			font-size: 12px;
		}
	}
</style>
