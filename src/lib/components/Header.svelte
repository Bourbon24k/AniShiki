<script>
	import { mobileMenuOpen } from '$lib/stores';
	import Icon from './Icon.svelte';
	export let showBack = false;
</script>

<header class="header glass">
	<div class="side">
		{#if showBack}
			<button class="ico-btn" on:click={() => history.back()} aria-label="Назад">
				<Icon name="back" />
			</button>
		{:else}
			<button class="ico-btn" on:click={() => mobileMenuOpen.set(true)} aria-label="Меню">
				<Icon name="menu" />
			</button>
		{/if}
	</div>
	<a href="/" class="logo">
		AniShiki<sup>β</sup>
	</a>
	<div class="side right">
		<a href="/search" class="ico-btn" aria-label="Поиск"><Icon name="search" /></a>
	</div>
</header>

<style>
	.header {
		display: none;
		position: sticky;
		top: 0;
		height: calc(56px + env(safe-area-inset-top, 0));
		padding: env(safe-area-inset-top, 0) 12px 0;
		align-items: center;
		justify-content: space-between;
		z-index: 50;
	}
	.side {
		display: flex;
		align-items: center;
		min-width: 44px;
	}
	.right {
		justify-content: flex-end;
	}
	.ico-btn {
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
		border: none;
		background: transparent;
		color: var(--text-color);
		border-radius: 50%;
		cursor: pointer;
	}
	.ico-btn:active {
		background: var(--background-color);
	}
	.logo {
		font-size: 20px;
		font-weight: 800;
		letter-spacing: -0.3px;
	}
	.logo sup {
		font-size: 10px;
		color: var(--primary-color);
	}
	@media (max-width: 768px) {
		.header {
			display: flex;
		}
	}
</style>
