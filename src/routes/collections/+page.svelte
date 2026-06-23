<script>
	import { onMount } from 'svelte';
	import { getApi } from '$lib/api';
	import { collectionSortValues } from '$lib/utils';
	import CollectionCard from '$lib/components/CollectionCard.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';

	let items = [];
	let pageNum = 0;
	let sort = 1;
	let loading = true;
	let hasMore = true;

	async function load(reset = true) {
		if (reset) {
			pageNum = 0;
			items = [];
			hasMore = true;
			loading = true;
		}
		try {
			const data = await getApi().collection.all(pageNum, sort);
			const list = data?.content || [];
			items = reset ? list : [...items, ...list];
			hasMore = pageNum < (data?.total_page_count ?? 1) - 1;
		} catch (e) {
			console.error('collections', e);
		}
		loading = false;
	}
	function pickSort(v) {
		sort = v;
		load(true);
	}
	function onScroll(e) {
		const el = e.target;
		if (hasMore && el.scrollHeight - el.scrollTop - el.clientHeight < 500) {
			hasMore = false;
			pageNum++;
			load(false).then(() => (hasMore = true));
		}
	}
	onMount(() => load(true));
</script>

<svelte:head><title>Коллекции — AniShiki</title></svelte:head>
<div class="page" on:scroll={onScroll}>
	<div class="inner">
		<h1>Коллекции</h1>
		<div class="tabs no-scrollbar">
			{#each collectionSortValues as s}
				<button class="tab" class:active={sort === s.value} on:click={() => pickSort(s.value)}>{s.label}</button>
			{/each}
		</div>
		{#if loading}
			<div class="grid">{#each Array(9) as _}<Skeleton aspect="16/10" radius="16px" />{/each}</div>
		{:else if items.length === 0}
			<p class="empty">Нет коллекций</p>
		{:else}
			<div class="grid">{#each items as c (c.id)}<CollectionCard collection={c} />{/each}</div>
		{/if}
	</div>
</div>

<style>
	.page {
		height: 100%;
		overflow-y: auto;
	}
	.inner {
		max-width: 1400px;
		margin: 0 auto;
		padding: 20px 24px 40px;
	}
	h1 {
		font-size: 30px;
		font-weight: 800;
		margin-bottom: 18px;
	}
	.tabs {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		margin-bottom: 20px;
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
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 18px;
	}
	.empty {
		text-align: center;
		padding: 60px;
		color: var(--secondary-text-color);
	}
	@media (max-width: 768px) {
		.inner {
			padding: 14px 12px 32px;
		}
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
			gap: 12px;
		}
		h1 {
			font-size: 24px;
		}
	}
</style>
