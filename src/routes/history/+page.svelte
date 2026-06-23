<script>
	import { onMount } from 'svelte';
	import { getApi } from '$lib/api';
	import { userToken, showToast } from '$lib/stores';
	import GridList from '$lib/components/GridList.svelte';

	let items = [];
	let pageNum = 0;
	let loading = true;
	let loadingMore = false;
	let hasMore = true;

	async function load(reset = true) {
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
			const data = await getApi().release.getHistory(pageNum);
			const list = data?.content || [];
			items = reset ? list : [...items, ...list];
			hasMore = pageNum < (data?.total_page_count ?? 1) - 1;
		} catch (e) {
			console.error('history', e);
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
	onMount(() => load(true));
</script>

<svelte:head><title>История — AniShiki</title></svelte:head>
<div class="page">
	<h1>История просмотра</h1>
	{#if !$userToken}
		<div class="empty"><p>Войдите, чтобы видеть историю</p><a class="btn" href="/login">Войти</a></div>
	{:else}
		<div class="list"><GridList {items} {loading} {loadingMore} onMore={more} empty="История пуста" /></div>
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
		margin-bottom: 18px;
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
