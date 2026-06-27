<script>
	import { onMount } from 'svelte';
	import { getApi } from '$lib/api';
	import { userToken } from '$lib/stores';
	import ReleaseRow from '$lib/components/ReleaseRow.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let interesting = [];
	let discussing = [];
	let recommendations = [];
	let watching = [];
	let topRated = [];
	let films = [];
	let randomList = [];
	let loading = true;
	let randomLoading = false;

	async function safe(p) {
		try {
			const r = await p;
			return (r?.content || []).map((x) => x.release || x);
		} catch (e) {
			console.error('discover', e);
			return [];
		}
	}

	// «Интересное» — промо-баннеры (title/image/action), не релизы.
	// action — id релиза для перехода; приводим к форме, понятной AnimeCard.
	async function safeInteresting(p) {
		try {
			const r = await p;
			return (r?.content || [])
				.map((x) => ({
					id: Number(x.action) || x.id,
					title_ru: x.title,
					image: x.image,
					description: x.description
				}))
				.filter((x) => x.id && x.image);
		} catch (e) {
			console.error('discover interesting', e);
			return [];
		}
	}

	async function loadRandom() {
		randomLoading = true;
		try {
			const api = getApi();
			const results = await Promise.all(
				Array.from({ length: 12 }, () => api.release.getRandomRelease(true).then((d) => d?.release).catch(() => null))
			);
			const seen = new Set();
			randomList = results.filter((r) => r && r.id && !seen.has(r.id) && seen.add(r.id));
		} catch (e) {
			console.error('random', e);
		}
		randomLoading = false;
	}

	onMount(async () => {
		const api = getApi();
		if (!api) return;
		loadRandom();
		[interesting, discussing, topRated, films] = await Promise.all([
			safeInteresting(api.discover.getInteresting(0)),
			safe(api.discover.getDiscussing()),
			safe(api.release.filter(0, { sort: 1 }, true)),
			safe(api.release.filter(0, { sort: 1, category_id: 2 }, true))
		]);
		if ($userToken) {
			[recommendations, watching] = await Promise.all([
				safe(api.discover.getRecommendations(0)),
				safe(api.discover.getWatching(0))
			]);
		}
		loading = false;
	});
</script>

<svelte:head><title>Обзор — AniShiki</title></svelte:head>

<div class="page">
	<h1>Обзор</h1>

	<div class="row-head">
		<h2 class="row-title">Случайная подборка</h2>
		<button class="reroll" on:click={loadRandom} disabled={randomLoading}>
			<Icon name="random" size={16} /> Обновить
		</button>
	</div>
	<ReleaseRow title="" items={randomList} loading={randomLoading} />

	{#if $userToken && (loading || watching.length)}
		<ReleaseRow title="Продолжить просмотр" items={watching} loading={loading && !watching.length} />
	{/if}
	{#if $userToken && (loading || recommendations.length)}
		<ReleaseRow title="Рекомендации для вас" items={recommendations} loading={loading && !recommendations.length} />
	{/if}

	<ReleaseRow title="Интересное" items={interesting} {loading} numbered />
	<ReleaseRow title="Высокий рейтинг" items={topRated} {loading} href="/search?type=5" />
	<ReleaseRow title="Сейчас обсуждают" items={discussing} {loading} />
	<ReleaseRow title="Популярные фильмы" items={films} {loading} href="/search?type=4" />
</div>

<style>
	.page {
		max-width: 1500px;
		margin: 0 auto;
		padding: 24px;
	}
	h1 {
		font-size: 30px;
		font-weight: 800;
		margin-bottom: 24px;
	}
	.row-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 14px;
		padding: 0 4px;
	}
	.row-title {
		font-size: 20px;
		font-weight: 700;
	}
	.reroll {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		color: var(--text-color);
		border-radius: 11px;
		cursor: pointer;
		font-weight: 600;
		font-size: 13px;
	}
	.reroll:hover {
		border-color: var(--primary-color);
	}
	.reroll:disabled {
		opacity: 0.5;
	}
	@media (max-width: 768px) {
		.page {
			padding: 16px 12px;
		}
		h1 {
			font-size: 24px;
		}
	}
</style>
