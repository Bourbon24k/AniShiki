<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { getApi } from '$lib/api';
	import ProfileGrid from '$lib/components/ProfileGrid.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	$: id = Number($page.params.id);
	let friends = [];
	let pageNum = 0;
	let loading = true;
	let hasMore = true;

	async function load(reset = true) {
		if (reset) {
			pageNum = 0;
			friends = [];
			hasMore = true;
			loading = true;
		}
		try {
			const data = await getApi().profile.getFriends({ id, page: pageNum });
			const list = data?.content || [];
			friends = reset ? list : [...friends, ...list];
			hasMore = pageNum < (data?.total_page_count ?? 1) - 1;
		} catch (e) {
			console.error('friends', e);
		}
		loading = false;
	}

	function onScroll(e) {
		const el = e.target;
		if (hasMore && el.scrollHeight - el.scrollTop - el.clientHeight < 500) {
			pageNum++;
			hasMore = false;
			load(false).then(() => (hasMore = pageNum < 999));
		}
	}

	$: if (id) load(true);
</script>

<svelte:head><title>Друзья — AniShiki</title></svelte:head>

<div class="page" on:scroll={onScroll}>
	<div class="inner">
		<h1>Друзья</h1>
		{#if loading}
			<Spinner center label="Загрузка…" />
		{:else}
			<ProfileGrid profiles={friends} empty="Друзей пока нет" />
		{/if}
	</div>
</div>

<style>
	.page {
		height: 100%;
		overflow-y: auto;
	}
	.inner {
		max-width: 1100px;
		margin: 0 auto;
		padding: 24px;
	}
	h1 {
		font-size: 30px;
		font-weight: 800;
		margin-bottom: 22px;
	}
	@media (max-width: 768px) {
		.inner {
			padding: 16px 12px;
		}
		h1 {
			font-size: 24px;
		}
	}
</style>
