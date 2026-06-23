<script>
	import AnimeCard from './AnimeCard.svelte';
	import Skeleton from './Skeleton.svelte';

	export let items = [];
	export let loading = false;
	export let loadingMore = false;
	export let empty = 'Ничего не найдено';
	export let onMore = null;

	function onScroll(e) {
		if (!onMore || loadingMore) return;
		const el = e.target;
		if (el.scrollHeight - el.scrollTop - el.clientHeight < 600) onMore();
	}
</script>

<div class="grid-wrap" on:scroll={onScroll}>
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
			{#each items as anime (anime.id ?? anime['@id'])}
				<AnimeCard {anime} type="grid" />
			{/each}
		</div>
		{#if loadingMore}
			<div class="more-sk">
				<div class="grid">
					{#each Array(6) as _}<Skeleton aspect="2/3" radius="16px" />{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.grid-wrap {
		height: 100%;
		overflow-y: auto;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 18px;
	}
	.empty {
		text-align: center;
		padding: 80px 20px;
		color: var(--secondary-text-color);
	}
	.more-sk {
		margin-top: 18px;
	}
	@media (max-width: 768px) {
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
			gap: 12px;
		}
	}
</style>
