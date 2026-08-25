<script>
	/**
	 * Сетка карточек с догрузкой.
	 *
	 * Догрузка висит на маячке в конце списка, а не на обработчике прокрутки:
	 * так она работает независимо от того, какой контейнер на странице
	 * прокручивается, и не дёргает обработчик на каждый пиксель.
	 */
	import { onDestroy } from 'svelte';
	import { whenNear } from '$lib/lazyload';
	import AnimeCard from './AnimeCard.svelte';
	import Skeleton from './Skeleton.svelte';

	export let items = [];
	export let loading = false;
	export let loadingMore = false;
	export let empty = 'Ничего не найдено';
	export let onMore = null;

	let sentinel;
	let stop;

	$: attach(sentinel);

	function attach(node) {
		stop?.();
		stop = null;
		if (!node) return;
		stop = whenNear(node, () => {
			if (onMore && !loadingMore && !loading) onMore();
		});
	}

	onDestroy(() => stop?.());

	/** Дубли в выдаче ломали ключи и всю отрисовку — см. ReleaseRow. */
	$: unique = dedupe(items);

	function dedupe(list) {
		const seen = new Set();
		return (list || []).filter((item) => {
			const key = item?.id ?? item?.['@id'];
			if (key == null || seen.has(key)) return key == null;
			seen.add(key);
			return true;
		});
	}
</script>

<div class="grid-wrap">
	{#if loading}
		<div class="grid">
			{#each Array(18) as _}
				<Skeleton aspect="2/3" radius="16px" />
			{/each}
		</div>
	{:else if items.length === 0}
		<div class="empty">{empty}</div>
	{:else}
		<div class="grid">
			{#each unique as anime (anime.id ?? anime['@id'])}
				<AnimeCard {anime} type="grid" />
			{/each}
		</div>
		{#if loadingMore}
			<div class="grid more-sk">
				{#each Array(6) as _}<Skeleton aspect="2/3" radius="16px" />{/each}
			</div>
		{/if}
		{#if onMore}<div class="sentinel" bind:this={sentinel}></div>{/if}
	{/if}
</div>

<style>
	.grid-wrap {
		padding-bottom: 8px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 18px;
	}
	.more-sk {
		margin-top: 18px;
	}
	.empty {
		text-align: center;
		padding: 80px 20px;
		color: var(--secondary-text-color);
	}
	.sentinel {
		height: 1px;
	}
	@media (max-width: 768px) {
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
			gap: 12px;
		}
	}
</style>
