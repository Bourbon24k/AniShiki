<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { getApi } from '$lib/api';
	import GridList from '$lib/components/GridList.svelte';
	import Icon from '$lib/components/Icon.svelte';

	$: id = Number($page.params.id);
	const lists = [
		{ type: 1, label: 'Смотрю' },
		{ type: 2, label: 'В планах' },
		{ type: 3, label: 'Просмотрено' },
		{ type: 4, label: 'Отложено' },
		{ type: 5, label: 'Брошено' }
	];
	let activeType = Number($page.url.searchParams.get('type')) || 1;
	let items = [];
	let pageNum = 0;
	let loading = true;
	let loadingMore = false;
	let hasMore = true;

	async function load(reset = true) {
		if (reset) {
			pageNum = 0;
			items = [];
			hasMore = true;
			loading = true;
		}
		try {
			const data = await getApi().profile.getBookmarks({
				id,
				type: activeType,
				sort: 1,
				filter_announce: 0,
				page: pageNum
			});
			const list = data?.content || [];
			items = reset ? list : [...items, ...list];
			hasMore = pageNum < (data?.total_page_count ?? 1) - 1;
		} catch (e) {
			console.error(e);
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
	function pick(t) {
		activeType = t;
		load(true);
	}
	$: if (id) load(true);
</script>

<svelte:head><title>Закладки — AniShiki</title></svelte:head>
<div class="page">
	<a class="back" href={`/profile/${id}`}><Icon name="back" size={18} /> Профиль</a>
	<h1>Закладки</h1>
	<div class="tabs no-scrollbar">
		{#each lists as l}
			<button class="tab" class:active={activeType === l.type} on:click={() => pick(l.type)}>{l.label}</button>
		{/each}
	</div>
	<div class="list"><GridList {items} {loading} {loadingMore} onMore={more} empty="Список пуст" /></div>
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
	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--secondary-text-color);
		font-size: 14px;
		margin-bottom: 12px;
	}
	h1 {
		font-size: 28px;
		font-weight: 800;
		margin-bottom: 16px;
	}
	.tabs {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		margin-bottom: 18px;
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
	@media (max-width: 768px) {
		.page {
			padding: 14px 12px 0;
		}
		h1 {
			font-size: 22px;
		}
	}
</style>
