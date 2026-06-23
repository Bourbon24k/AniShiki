<script>
	import AnimeCard from './AnimeCard.svelte';
	import Skeleton from './Skeleton.svelte';
	import Icon from './Icon.svelte';

	export let title = '';
	export let items = [];
	export let loading = false;
	export let href = null;
	export let numbered = false;

	let scroller;
	function scrollBy(dir) {
		scroller?.scrollBy({ left: dir * scroller.clientWidth * 0.85, behavior: 'smooth' });
	}
</script>

<section class="row">
	{#if title}
		<header>
			<h2>{title}</h2>
			<div class="actions">
				{#if href}<a class="all" {href}>Все <Icon name="chevronRight" size={16} /></a>{/if}
				<button class="nav" on:click={() => scrollBy(-1)} aria-label="Назад"><Icon name="back" size={18} /></button>
				<button class="nav" on:click={() => scrollBy(1)} aria-label="Вперёд"><Icon name="chevronRight" size={18} /></button>
			</div>
		</header>
	{/if}

	<div class="scroller no-scrollbar" bind:this={scroller}>
		{#if loading}
			{#each Array(8) as _}
				<div class="cell"><Skeleton aspect="2/3" radius="16px" /></div>
			{/each}
		{:else}
			{#each items as anime, i (anime.id)}
				<div class="cell">
					<AnimeCard {anime} type="grid" index={numbered ? i : null} />
				</div>
			{/each}
		{/if}
	</div>
</section>

<style>
	.row {
		margin: 0 0 34px;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: 0 0 14px;
		padding: 0 4px;
	}
	h2 {
		font-size: 20px;
		font-weight: 700;
		letter-spacing: -0.3px;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.all {
		display: flex;
		align-items: center;
		gap: 2px;
		font-size: 13px;
		font-weight: 600;
		color: var(--secondary-text-color);
		padding: 6px 8px;
		border-radius: 8px;
	}
	.all:hover {
		color: var(--primary-color);
	}
	.nav {
		width: 34px;
		height: 34px;
		display: grid;
		place-items: center;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		color: var(--text-color);
		border-radius: 10px;
		cursor: pointer;
		transition: background 0.2s ease;
	}
	.nav:hover {
		background: var(--elevated-color);
	}
	.scroller {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 168px;
		gap: 16px;
		overflow-x: auto;
		scroll-snap-type: x proximity;
		padding: 4px;
	}
	.cell {
		scroll-snap-align: start;
	}
	@media (max-width: 768px) {
		.scroller {
			grid-auto-columns: 134px;
			gap: 12px;
		}
		h2 {
			font-size: 17px;
		}
		.nav {
			display: none;
		}
	}
</style>
