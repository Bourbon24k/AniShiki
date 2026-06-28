<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { getApi } from '$lib/api';
	import { userToken } from '$lib/stores';
	import { siteSession } from '$lib/stores/auth';
	import { listFavorites, listByStatus } from '$lib/sitedata';
	import GridList from '$lib/components/GridList.svelte';

	$: siteOnly = !$userToken && !!$siteSession;
	let siteLoaded = false;
	$: if (siteOnly && !siteLoaded) {
		siteLoaded = true;
		load(true);
	}

	// Категории-статусы важнее «избранного» — они идут первыми.
	const cats = [
		{ key: 1, label: 'Смотрю' },
		{ key: 2, label: 'В планах' },
		{ key: 3, label: 'Просмотрено' },
		{ key: 4, label: 'Отложено' },
		{ key: 5, label: 'Брошено' },
		{ key: 'fav', label: 'Избранное' }
	];

	let active = /** @type {number | 'fav'} */ (1);
	let items = [];
	let pageNum = 0;
	let loading = true;
	let loadingMore = false;
	let hasMore = true;

	async function load(reset = true) {
		if (siteOnly) {
			loading = true;
			items = active === 'fav' ? await listFavorites() : await listByStatus(active);
			hasMore = false;
			loading = false;
			return;
		}
		if (!$userToken) {
			loading = false;
			return;
		}
		if (reset) {
			pageNum = 0;
			items = [];
			hasMore = true;
			loading = true;
		}
		try {
			const api = getApi();
			let data;
			if (active === 'fav') {
				data = await api.profile.getFavorites({ page: pageNum, sort: 1 });
			} else {
				data = await api.profile.getBookmarks({
					id: $userToken.id,
					type: active,
					sort: 1,
					filter_announce: 0,
					page: pageNum
				});
			}
			const list = data?.content || [];
			items = reset ? list : [...items, ...list];
			hasMore = pageNum < (data?.total_page_count ?? 1) - 1;
		} catch (e) {
			console.error('bookmarks', e);
		}
		loading = false;
		loadingMore = false;
	}
	function more() {
		if (!hasMore || loadingMore) return;
		loadingMore = true;
		pageNum++;
		load(false);
	}
	function pick(key) {
		active = key;
		if (browser) goto(`/bookmarks?type=${key}`, { replaceState: true, keepFocus: true, noScroll: true });
		load(true);
	}

	onMount(() => {
		const t = $page.url.searchParams.get('type');
		if (t) active = t === 'fav' ? 'fav' : Number(t);
		load(true);
	});
</script>

<svelte:head><title>Закладки — AniShiki</title></svelte:head>

<div class="page">
	<h1>Закладки</h1>

	{#if siteOnly}
		<div class="tabs no-scrollbar">
			{#each cats as c}
				<button class="tab" class:active={active === c.key} on:click={() => pick(c.key)}>{c.label}</button>
			{/each}
		</div>
		<div class="list">
			<GridList {items} {loading} {loadingMore} onMore={more} empty="Здесь пока пусто" />
		</div>
	{:else if !$userToken}
		<div class="empty">
			<p>Войдите, чтобы видеть закладки</p>
			<a class="btn" href="/login">Войти</a>
		</div>
	{:else}
		<div class="tabs no-scrollbar">
			{#each cats as c}
				<button class="tab" class:active={active === c.key} on:click={() => pick(c.key)}>{c.label}</button>
			{/each}
		</div>
		<div class="list">
			<GridList {items} {loading} {loadingMore} onMore={more} empty="В этой категории пусто" />
		</div>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		height: 100%;
		max-width: 1500px;
		margin: 0 auto;
		padding: 20px 24px 0;
	}
	h1 {
		font-size: 30px;
		font-weight: 800;
		margin-bottom: 16px;
	}
	.tabs {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		margin-bottom: 18px;
		flex-shrink: 0;
	}
	.tab {
		white-space: nowrap;
		padding: 9px 16px;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		color: var(--secondary-text-color);
		border-radius: 11px;
		cursor: pointer;
		font-weight: 600;
		font-size: 13px;
		transition: all 0.2s ease;
	}
	.tab.active {
		background: var(--primary-color);
		color: #fff;
		border-color: transparent;
	}
	.list {
		flex: 1;
		min-height: 0;
		padding-bottom: 24px;
	}
	.empty {
		text-align: center;
		padding: 80px 20px;
		color: var(--secondary-text-color);
	}
	.empty .btn {
		display: inline-block;
		margin-top: 14px;
		padding: 12px 24px;
		background: var(--primary-color);
		color: #fff;
		border-radius: 12px;
		font-weight: 600;
	}
	@media (max-width: 768px) {
		.page {
			padding: 14px 12px 0;
		}
		h1 {
			font-size: 24px;
		}
	}
</style>
