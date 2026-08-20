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
	import InstallBanner from '$lib/components/InstallBanner.svelte';
	import { initPwa } from '$lib/pwa';
	import { authReady, siteSession } from '$lib/stores/auth';
	import { unreadCount, syncEpisodeNotifications } from '$lib/notifications';

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

	// Счётчик уведомлений аккаунта сайта: проверяем новые серии и считаем непрочитанное.
	let badgeFor = undefined;
	$: if ($authReady && !$userToken) refreshBadge($siteSession?.user?.id ?? null);

	async function refreshBadge(userId) {
		if (userId === badgeFor) return;
		badgeFor = userId;
		if (!userId) {
			notificationCount.set(0);
			return;
		}
		await syncEpisodeNotifications().catch(() => {});
		notificationCount.set(await unreadCount().catch(() => 0));
	}

	onMount(() => {
		syncMobile();
		window.addEventListener('resize', syncMobile);
		const disposePwa = initPwa();

		if ($userToken) {
			const api = getApi();
			api?.notification
				?.countNotifications()
				.then((r) => notificationCount.set(r?.count ?? 0))
				.catch(() => {});
		}
		return () => {
			window.removeEventListener('resize', syncMobile);
			disposePwa();
		};
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

	{#if !isPlayer && !isAuthRoute}
		<InstallBanner />
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
		/* высота .mnav = 56px + зона безопасности, плюс небольшой зазор */
		padding-bottom: calc(56px + 12px + var(--safe-bottom, 0px));
	}
</style>
