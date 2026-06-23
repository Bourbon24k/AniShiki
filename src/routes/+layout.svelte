<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { guiSettings, userToken, notificationCount } from '$lib/stores';
	import { getApi } from '$lib/api';
	import LeftMenu from '$lib/components/LeftMenu.svelte';
	import Header from '$lib/components/Header.svelte';
	import MobileNav from '$lib/components/MobileNav.svelte';
	import SlideMenu from '$lib/components/SlideMenu.svelte';
	import Toast from '$lib/components/Toast.svelte';

	let isMobile = false;
	$: path = $page.url.pathname;
	$: isAuthRoute = path === '/login' || path === '/register';
	$: isPlayer = path.startsWith('/player');

	// Применяем тему на <html>.
	$: if (browser && $guiSettings?.theme) {
		document.documentElement.className = `${$guiSettings.theme}-theme`;
	}

	function syncMobile() {
		isMobile = window.innerWidth <= 768;
	}

	onMount(() => {
		syncMobile();
		window.addEventListener('resize', syncMobile);

		if ($userToken) {
			const api = getApi();
			api?.notification
				?.countNotifications()
				.then((r) => notificationCount.set(r?.count ?? 0))
				.catch(() => {});
		}
		return () => window.removeEventListener('resize', syncMobile);
	});
</script>

<div class="app" class:mobile={isMobile}>
	{#if !isAuthRoute && !isPlayer}
		{#if isMobile}
			<Header showBack={path !== '/'} />
			<SlideMenu />
		{/if}
	{/if}

	<div class="body">
		{#if !isMobile && !isPlayer && !isAuthRoute}
			<LeftMenu />
		{/if}
		<main class="viewport" class:full={isPlayer || isAuthRoute}>
			<slot />
		</main>
	</div>

	{#if isMobile && !isAuthRoute && !isPlayer}
		<MobileNav />
	{/if}

	<Toast />
</div>

<style>
	.app {
		width: 100vw;
		height: 100vh;
		height: 100dvh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	.body {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}
	.viewport {
		flex: 1;
		min-width: 0;
		overflow-y: auto;
		overflow-x: hidden;
		position: relative;
		-webkit-overflow-scrolling: touch;
		background: var(--background-color);
	}
	.app.mobile .viewport:not(.full) {
		/* высота .mnav = 62px + safe-area; добавляем комфортный зазор сверху от меню */
		padding-bottom: calc(62px + 28px + env(safe-area-inset-bottom, 0));
	}
</style>
