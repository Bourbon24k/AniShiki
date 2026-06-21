<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { guiSettings, userToken, notificationCount, installPrompt } from '$lib/stores';
	import { getApi } from '$lib/api';
	import LeftMenu from '$lib/components/LeftMenu.svelte';
	import Header from '$lib/components/Header.svelte';
	import SlideMenu from '$lib/components/SlideMenu.svelte';

	let isMobile = false;
	let viewportEl;
	let showTop = false;
	let lastScroller = null;
	let canInstall = false;
	let installDismissed = false;

	$: pwaPrompt = $installPrompt;
	$: canInstall = !!pwaPrompt && !installDismissed;

	async function doInstall() {
		if (!pwaPrompt) return;
		pwaPrompt.prompt();
		try { await pwaPrompt.userChoice; } catch (e) { /* ignore */ }
		installPrompt.set(null);
		installDismissed = true;
	}

	$: currentPath = $page.url.pathname;
	$: isAuthRoute = currentPath === '/login' || currentPath === '/register';

	onMount(() => {
		if (browser) {
			isMobile = window.innerWidth <= 768;
			window.addEventListener('resize', () => {
				isMobile = window.innerWidth <= 768;
			});

			const settings = $guiSettings;
			document.body.classList.add(`${settings.theme}-theme`);

			window.addEventListener('beforeinstallprompt', (e) => {
				e.preventDefault();
				installPrompt.set(e);
			});

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

	$: if (browser && $guiSettings) {
		document.body.className = `${$guiSettings.theme}-theme`;
	}

	function onViewportScroll(e) {
		const el = e.target;
		if (el && typeof el.scrollTop === 'number') {
			lastScroller = el;
			showTop = el.scrollTop > 600;
		}
	}

	function scrollTop() {
		const el = lastScroller || viewportEl;
		el?.scrollTo({ top: 0, behavior: 'smooth' });
	}
</script>

<div class="app-container" class:mobile={isMobile}>
	{#if !isAuthRoute}
		<Header />
		{#if isMobile}
			<SlideMenu />
		{/if}
	{/if}
	<div class="main-content">
		{#if !isMobile && !isAuthRoute}
			<LeftMenu />
		{/if}
		<main class="viewport" class:auth={isAuthRoute} bind:this={viewportEl} on:scroll|capture={onViewportScroll}>
			<slot />

			{#if showTop && !isAuthRoute}
				<button class="scroll-top" on:click={scrollTop} aria-label="Наверх">
					<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
				</button>
			{/if}

			{#if canInstall && !isAuthRoute}
				<div class="install-banner glass">
					<div class="install-mark">A</div>
					<div class="install-text">
						<strong>Установить AniShiki</strong>
						<span>Быстрый доступ с домашнего экрана</span>
					</div>
					<button class="btn btn-primary install-btn" on:click={doInstall}>Установить</button>
					<button class="install-close" on:click={() => installDismissed = true} aria-label="Закрыть">✕</button>
				</div>
			{/if}
		</main>
	</div>
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
		padding-bottom: env(safe-area-inset-bottom, 0);
	}

	.scroll-top {
		position: fixed;
		right: 22px;
		bottom: 22px;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		border: 1px solid var(--glass-border);
		background: var(--glass-bg);
		-webkit-backdrop-filter: blur(14px);
		backdrop-filter: blur(14px);
		color: var(--text-color);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: var(--shadow-md);
		z-index: 90;
		animation: fade-in-up var(--dur) var(--ease) both;
	}

	.scroll-top:hover {
		background: var(--surface-hover);
	}

	.scroll-top svg { width: 26px; height: 26px; }

	.install-banner {
		position: fixed;
		left: 50%;
		bottom: 22px;
		transform: translateX(-50%);
		width: min(440px, calc(100vw - 32px));
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		z-index: 95;
		animation: fade-in-up var(--dur) var(--ease) both;
	}

	.install-mark {
		flex-shrink: 0;
		width: 38px; height: 38px;
		border-radius: 10px;
		background: var(--accent-gradient);
		color: #fff; font-weight: 900;
		display: flex; align-items: center; justify-content: center;
	}

	.install-text { display: flex; flex-direction: column; flex: 1; min-width: 0; }
	.install-text strong { font-size: 14px; }
	.install-text span { font-size: 12px; color: var(--secondary-text-color); }

	.install-btn { padding: 9px 16px; font-size: 13px; }

	.install-close {
		background: transparent; border: none; color: var(--secondary-text-color);
		cursor: pointer; font-size: 14px; padding: 4px;
	}

	.app-container.mobile .install-banner { bottom: calc(16px + env(safe-area-inset-bottom, 0)); }

	.app-container.mobile .scroll-top {
		bottom: calc(22px + env(safe-area-inset-bottom, 0));
	}

	:global(body) {
		touch-action: pan-y;
	}
</style>
