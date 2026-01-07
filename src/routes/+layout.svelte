<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { guiSettings, userToken, notificationCount } from '$lib/stores';
	import { getApi } from '$lib/api';
	import LeftMenu from '$lib/components/LeftMenu.svelte';
	import Header from '$lib/components/Header.svelte';
	import MobileNav from '$lib/components/MobileNav.svelte';
	import SlideMenu from '$lib/components/SlideMenu.svelte';

	let isMobile = false;

	onMount(() => {
		if (browser) {
			isMobile = window.innerWidth <= 768;
			window.addEventListener('resize', () => {
				isMobile = window.innerWidth <= 768;
			});

			// Apply theme
			const settings = $guiSettings;
			document.body.classList.add(`${settings.theme}-theme`);

			// Load notification count if logged in
			const token = $userToken;
			if (token) {
				const api = getApi();
				if (api) {
					api.notification.countNotifications()
						.then(x => notificationCount.set(x.count))
						.catch(() => {});
				}
			}
		}
	});

	// Subscribe to theme changes
	$: if (browser && $guiSettings) {
		document.body.className = `${$guiSettings.theme}-theme`;
	}
</script>

<div class="app-container" class:mobile={isMobile}>
	<Header />
	{#if isMobile}
		<SlideMenu />
	{/if}
	<div class="main-content">
		{#if !isMobile}
			<LeftMenu />
		{/if}
		<main class="viewport">
			<slot />
		</main>
	</div>
	{#if isMobile}
		<MobileNav />
	{/if}
</div>

<style>
	.app-container {
		width: 100vw;
		height: 100vh;
		overflow: hidden;
		position: relative;
		display: flex;
		flex-direction: column;
	}

	.main-content {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.viewport {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		position: relative;
		-webkit-overflow-scrolling: touch;
		background-color: var(--background-color);
	}

	.app-container.mobile .main-content {
		flex-direction: column;
	}

	.app-container.mobile .viewport {
		padding-bottom: calc(64px + env(safe-area-inset-bottom, 0));
	}

	:global(body) {
		touch-action: pan-y;
	}
</style>
