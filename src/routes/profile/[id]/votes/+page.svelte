<script>
	import { page } from '$app/stores';
	import { getApi } from '$lib/api';
	import GridList from '$lib/components/GridList.svelte';
	import Icon from '$lib/components/Icon.svelte';

	$: id = Number($page.params.id);
	let items = [];
	let pageNum = 0;
	let loading = true;
	let loadingMore = false;
	let hasMore = true;
	let isPrivate = false;

	async function load(reset = true) {
		if (reset) {
			pageNum = 0;
			items = [];
			hasMore = true;
			loading = true;
			isPrivate = false;
		}
		try {
			const data = await getApi().profile.getVotedReleases(id, pageNum);
			// Элемент — это «плоский» релиз; оценка лежит в my_vote.
			const list = (data?.content || []).map((v) => ({
				...(v.release || v),
				your_vote: v.my_vote ?? v.vote ?? 0
			}));
			items = reset ? list : [...items, ...list];
			hasMore = pageNum < (data?.total_page_count ?? 1) - 1;
		} catch (e) {
			// Скрытая история оценок → сервер отвечает Bad Request с пустым телом.
			if (reset && /bad request/i.test(String(e?.message))) isPrivate = true;
			else console.error(e);
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

<svelte:head><title>Оценки — AniShiki</title></svelte:head>
<div class="page">
	<a class="back" href={`/profile/${id}`}><Icon name="back" size={18} /> Профиль</a>
	<h1>Оценки</h1>
	{#if isPrivate}
		<div class="hidden-note">
			<Icon name="bookmark" size={32} />
			<p>История оценок скрыта настройками приватности пользователя.</p>
		</div>
	{:else}
		<div class="list"><GridList {items} {loading} {loadingMore} onMore={more} empty="Нет оценённых релизов" /></div>
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
	.hidden-note {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		text-align: center;
		padding: 70px 20px;
		color: var(--secondary-text-color);
	}
	.hidden-note :global(svg) {
		color: var(--third-text-color);
		opacity: 0.7;
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
