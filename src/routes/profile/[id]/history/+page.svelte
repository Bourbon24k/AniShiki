<script>
	import { page } from '$app/stores';
	import { getApi } from '$lib/api';
	import { userToken } from '$lib/stores';
	import GridList from '$lib/components/GridList.svelte';
	import Icon from '$lib/components/Icon.svelte';

	$: id = Number($page.params.id);
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
			const api = getApi();
			// Своя история — release.getHistory; чужая — превью из профиля.
			if ($userToken?.id === id) {
				const data = await api.release.getHistory(pageNum);
				const list = data?.content || [];
				items = reset ? list : [...items, ...list];
				hasMore = pageNum < (data?.total_page_count ?? 1) - 1;
			} else {
				const data = await api.profile.info(id);
				items = data?.profile?.history || [];
				hasMore = false;
			}
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
	$: if (id) load(true);
</script>

<svelte:head><title>История — AniShiki</title></svelte:head>
<div class="page">
	<a class="back" href={`/profile/${id}`}><Icon name="back" size={18} /> Профиль</a>
	<h1>История просмотра</h1>
	<div class="list"><GridList {items} {loading} {loadingMore} onMore={more} empty="История пуста" /></div>
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
		margin-bottom: 18px;
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
