<script>
	/**
	 * Обзор: витрина подборок.
	 *
	 * Раньше это был просто набор рядов из /discover. Теперь сверху идут
	 * собранные под человека подборки (см. $lib/picks), затем коллекции
	 * Anixart, а глобальные ряды грузятся по мере прокрутки.
	 */
	import { onMount } from 'svelte';
	import { getApi } from '$lib/api';
	import { userToken } from '$lib/stores';
	import { authReady, siteSession } from '$lib/stores/auth';
	import { getContinueWatching } from '$lib/personal';
	import { buildPicks, popularCollections } from '$lib/picks';
	import { catalogPageLive } from '$lib/catalog';
	import { FEATURED_GENRES } from '$lib/genres';
	import ReleaseRow from '$lib/components/ReleaseRow.svelte';
	import LazyRow from '$lib/components/LazyRow.svelte';
	import CollectionCard from '$lib/components/CollectionCard.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let picks = [];
	let picksLoading = true;
	let watching = [];
	let watchingLoading = false;

	let collections = [];
	let collectionsLoading = true;

	let randomList = [];
	let randomLoading = false;

	let personalFor = undefined;
	$: if ($authReady) syncPersonal(($userToken && 'anixart') || $siteSession?.user?.id || null);

	async function syncPersonal(key) {
		if (key === personalFor) return;
		personalFor = key;
		picksLoading = true;
		watchingLoading = !!key;
		const [rows, cont] = await Promise.all([
			buildPicks({ max: 6 }).catch((e) => {
				console.error('picks', e);
				return [];
			}),
			key
				? getContinueWatching().catch((e) => {
						console.error('continue watching', e);
						return [];
					})
				: Promise.resolve([])
		]);
		picks = rows;
		watching = cont;
		picksLoading = false;
		watchingLoading = false;
	}

	async function loadRandom() {
		randomLoading = true;
		try {
			const api = getApi();
			const results = await Promise.all(
				Array.from({ length: 12 }, () =>
					api.release
						.getRandomRelease(true)
						.then((d) => d?.release)
						.catch(() => null)
				)
			);
			const seen = new Set();
			randomList = results.filter((r) => r && r.id && !seen.has(r.id) && seen.add(r.id));
		} catch (e) {
			console.error('random', e);
		}
		randomLoading = false;
	}

	/** «Интересное» — промо-баннеры (title/image/action), не релизы. */
	async function loadInteresting() {
		try {
			const data = await getApi()?.discover.getInteresting(0);
			return (data?.content || [])
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

	async function loadFrom(promise) {
		try {
			const data = await promise;
			return (data?.content || []).map((x) => x.release || x);
		} catch (e) {
			console.error('discover', e);
			return [];
		}
	}

	onMount(async () => {
		loadRandom();
		try {
			collections = await popularCollections(12);
		} catch (e) {
			console.error('collections', e);
		}
		collectionsLoading = false;
	});
</script>

<svelte:head><title>Обзор — AniShiki</title></svelte:head>

<div class="page">
	<h1>Обзор</h1>

	<div class="genre-strip no-scrollbar">
		{#each FEATURED_GENRES as g}
			<a class="gchip" href={`/search?genre=${encodeURIComponent(g)}`}>{g}</a>
		{/each}
	</div>

	{#if ($userToken || $siteSession) && (watchingLoading || watching.length)}
		<ReleaseRow
			title="Продолжить просмотр"
			items={watching}
			loading={watchingLoading && !watching.length}
			href="/history"
		/>
	{/if}

	{#if picksLoading}
		{#each Array(2) as _}
			<div class="row-sk">
				<Skeleton h="24px" w="200px" radius="8px" />
			</div>
		{/each}
	{:else}
		{#each picks as row (row.id)}
			<ReleaseRow title={row.title} subtitle={row.subtitle} items={row.items} href={row.href} />
		{/each}
	{/if}

	<section class="collections">
		<div class="row-head">
			<h2 class="row-title">Коллекции</h2>
			<a class="all" href="/collections">Все <Icon name="chevronRight" size={16} /></a>
		</div>
		<div class="crow no-scrollbar">
			{#if collectionsLoading}
				{#each Array(6) as _}<div class="ccell"><Skeleton aspect="16/9" radius="16px" /></div>{/each}
			{:else}
				{#each collections as c (c.id)}<div class="ccell"><CollectionCard collection={c} /></div>{/each}
			{/if}
		</div>
	</section>

	<div class="row-head">
		<h2 class="row-title">Случайная подборка</h2>
		<button class="reroll" on:click={loadRandom} disabled={randomLoading}>
			<Icon name="random" size={16} /> Обновить
		</button>
	</div>
	<ReleaseRow title="" items={randomList} loading={randomLoading} />

	<LazyRow title="Интересное" numbered load={loadInteresting} />
	<LazyRow title="Сейчас смотрят" load={() => loadFrom(getApi()?.discover.getWatching(0))} />
	<LazyRow title="Сейчас обсуждают" load={() => loadFrom(getApi()?.discover.getDiscussing())} />
	<LazyRow
		title="Высокий рейтинг"
		href="/search?type=5"
		load={() => catalogPageLive({ sort: 1 }, 0)}
	/>
	<LazyRow
		title="Популярные фильмы"
		href="/search?type=4"
		load={() => catalogPageLive({ sort: 3, category_id: 2 }, 0)}
	/>
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
		margin-bottom: 18px;
	}
	.genre-strip {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding-bottom: 22px;
	}
	.gchip {
		white-space: nowrap;
		padding: 8px 15px;
		border-radius: 999px;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		color: var(--secondary-text-color);
		font-size: 13.5px;
		font-weight: 600;
	}
	.gchip:hover {
		border-color: var(--primary-color);
		color: var(--primary-color);
	}
	.row-sk {
		margin-bottom: 34px;
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
	.all {
		display: flex;
		align-items: center;
		gap: 2px;
		font-size: 13px;
		font-weight: 600;
		color: var(--secondary-text-color);
	}
	.collections {
		margin-bottom: 34px;
	}
	.crow {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 260px;
		gap: 14px;
		overflow-x: auto;
		padding: 4px;
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
		.crow {
			grid-auto-columns: 210px;
		}
	}
</style>
