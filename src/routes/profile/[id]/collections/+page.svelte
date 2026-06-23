<script>
	import { page } from '$app/stores';
	import { getApi } from '$lib/api';
	import CollectionCard from '$lib/components/CollectionCard.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Icon from '$lib/components/Icon.svelte';

	$: id = Number($page.params.id);
	let items = [];
	let pageNum = 0;
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
			const data = await getApi().collection.getUserCollections(id, pageNum);
			const list = data?.content || [];
			items = reset ? list : [...items, ...list];
			hasMore = pageNum < (data?.total_page_count ?? 1) - 1;
		} catch (e) {
			console.error(e);
		}
		loading = false;
	}
	function onScroll(e) {
		const el = e.target;
		if (hasMore && el.scrollHeight - el.scrollTop - el.clientHeight < 500) {
			hasMore = false;
			pageNum++;
			load(false).then(() => (hasMore = true));
		}
	}
	$: if (id) load(true);
</script>

<svelte:head><title>Коллекции — AniShiki</title></svelte:head>
<div class="page" on:scroll={onScroll}>
	<div class="inner">
		<a class="back" href={`/profile/${id}`}><Icon name="back" size={18} /> Профиль</a>
		<h1>Коллекции</h1>
		{#if loading}
			<Spinner center label="Загрузка…" />
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
		margin-bottom: 18px;
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
			font-size: 22px;
		}
	}
</style>
