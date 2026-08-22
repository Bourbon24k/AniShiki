<script>
	import '../app.css';
	import { onMount, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { goto, afterNavigate, beforeNavigate } from '$app/navigation';
	import { guiSettings, userToken, notificationCount } from '$lib/stores';
	import { getApi } from '$lib/api';
	import LeftMenu from '$lib/components/LeftMenu.svelte';
	import Header from '$lib/components/Header.svelte';
	import MobileNav from '$lib/components/MobileNav.svelte';
	import SlideMenu from '$lib/components/SlideMenu.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import InstallBanner from '$lib/components/InstallBanner.svelte';
	import { initPwa, setAppBadge } from '$lib/pwa';
	import { initShell, swipeBack, rememberScroll, recallScroll, standalone } from '$lib/ios';
	import { authReady, siteSession } from '$lib/stores/auth';
	import { unreadCount, syncEpisodeNotifications } from '$lib/notifications';

	let isMobile = false;
	let viewport;
	/** 'forward' | 'back' — куда идём: от этого зависит направление перехода. */
	let direction = 'forward';

	$: path = $page.url.pathname;
	$: isAuthRoute = path === '/login' || path === '/register';
	$: isPlayer = path.startsWith('/player');
	$: chrome = !isAuthRoute && !isPlayer;

	// Применяем тему на <html>.
	$: if (browser && $guiSettings?.theme) {
		document.documentElement.className = `${$guiSettings.theme}-theme`;
	}

	// Значок на иконке приложения повторяет счётчик уведомлений.
	$: if (browser) setAppBadge($notificationCount);

	function syncMobile() {
		isMobile = window.innerWidth <= 768;
	}

	/* ── переходы и прокрутка ──────────────────────────────────────────
	   Прокручивается не окно, а .viewport, поэтому штатное восстановление
	   позиции SvelteKit до него не достаёт: помним сами, по маршруту. */

	beforeNavigate(({ from, type }) => {
		if (from?.url) rememberScroll(from.url.pathname + from.url.search, viewport?.scrollTop ?? 0);
		direction = type === 'popstate' ? 'back' : 'forward';
	});

	afterNavigate(async ({ from, to, type }) => {
		await tick();
		if (!viewport) return;
		// Смена только query (фильтры поиска) — не экран, прокрутку не трогаем.
		// url у from/to может отсутствовать (первый заход, внешний переход).
		const fromPath = from?.url?.pathname;
		const toPath = to?.url?.pathname;
		if (type !== 'popstate' && fromPath && fromPath === toPath) return;
		// Назад — возвращаем, куда смотрели; вперёд — начинаем сверху.
		viewport.scrollTop =
			type === 'popstate' ? recallScroll($page.url.pathname + $page.url.search) : 0;
	});

	/* ── счётчик уведомлений аккаунта сайта ── */

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
		const disposeShell = initShell();
		const disposePwa = initPwa((url) => goto(url));

		// Заставка держалась, пока грузилось приложение — теперь можно снять.
		const splash = document.getElementById('app-splash');
		if (splash) {
			splash.classList.add('hide');
			setTimeout(() => splash.remove(), 320);
		}

		if ($userToken) {
			const api = getApi();
			api?.notification
				?.countNotifications()
				.then((r) => notificationCount.set(r?.count ?? 0))
				.catch(() => {});
		}
		return () => {
			window.removeEventListener('resize', syncMobile);
			disposeShell();
			disposePwa();
		};
	});
</script>

<div class="app" class:mobile={isMobile} class:standalone={$standalone}>
	{#if chrome && isMobile}
		<Header showBack={path !== '/'} />
		<SlideMenu />
	{/if}

	<div class="body">
		{#if !isMobile && chrome}
			<LeftMenu />
		{/if}
		<main
			class="viewport"
			class:full={!chrome}
			bind:this={viewport}
			use:swipeBack={{ enabled: isMobile && chrome && path !== '/' }}
		>
			{#key path}
				<div class="screen" class:page-enter={direction === 'forward'} class:page-enter-back={direction === 'back'}>
					<slot />
				</div>
			{/key}
		</main>
	</div>

	{#if chrome && isMobile}
		<MobileNav />
	{/if}

	{#if chrome}
		<InstallBanner />
	{/if}

	<Toast />
</div>

<style>
	.app {
		width: 100vw;
		height: 100vh;
		height: 100dvh;
		/* В standalone панели браузера нет, и 100vh сразу равен экрану, тогда
		   как 100dvh на первых кадрах может отдать меньшее значение — снизу
		   оставался зазор. Возвращаем vh там, где он заведомо верный. */
		overflow: hidden;
		display: flex;
		flex-direction: column;
		/* Боковые вырезы в альбомной ориентации */
		padding-left: var(--safe-left);
		padding-right: var(--safe-right);
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
		/* Прокрутка не «протаскивается» на документ — страница не резинит. */
		overscroll-behavior-y: contain;
		background: var(--background-color);
	}
	.screen {
		/* Ровно высота области: страницы со своей внутренней прокруткой
		   считают height: 100% от неё, как раньше от .viewport. */
		height: 100%;
	}
	.app.standalone {
		height: 100vh;
		height: -webkit-fill-available;
	}
	.app.mobile .viewport:not(.full) {
		/* высота .mnav + зона безопасности, плюс небольшой зазор */
		padding-bottom: calc(var(--nav-height) + 12px + var(--safe-bottom, 0px));
	}
</style>
