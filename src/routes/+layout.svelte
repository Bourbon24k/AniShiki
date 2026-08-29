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
	import { initPwa, setAppBadge, showLocalNotification } from '$lib/pwa';
	import { initShell, swipeBack, rememberScroll, recallScroll, standalone } from '$lib/ios';
	import { authReady, siteSession } from '$lib/stores/auth';
	import { touchPresence } from '$lib/sitedata';
	import {
		listNotifications,
		syncEpisodeNotifications,
		watchNotifications,
		notificationCopy,
		anixartNotificationCopy
	} from '$lib/notifications';

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
	let watchedNotificationsFor = undefined;
	let stopWatchingNotifications = () => {};
	let knownSiteNotificationsFor = undefined;
	let knownSiteNotificationIds = new Set();
	$: if ($authReady && !$userToken) refreshBadge($siteSession?.user?.id ?? null);
	$: if ($authReady && !$userToken) watchSiteNotifications($siteSession?.user?.id ?? null);
	// Отметка «был(а) в сети» для профиля сайта: сама себя придерживает, чтобы
	// не писать в базу на каждый переход между страницами.
	$: if ($siteSession) touchPresence().catch(() => {});

	async function refreshBadge(userId) {
		if (userId === badgeFor) return;
		badgeFor = userId;
		if (!userId) {
			notificationCount.set(0);
			return;
		}
		await syncEpisodeNotifications().catch(() => {});
		await pollSiteNotifications(userId, { initial: true });
	}

	/**
	 * Realtime доставляет мгновенно, но не в каждом старом проекте таблица уже
	 * включена в publication. Поллинг — рабочая страховка для таких установок,
	 * а не замена realtime: он не даёт уведомлениям снова «пропасть» молча.
	 */
	async function pollSiteNotifications(userId, { initial = false } = {}) {
		if (!userId || userId !== $siteSession?.user?.id) return;
		const list = await listNotifications(30).catch(() => []);
		const first = knownSiteNotificationsFor !== userId;
		if (first) {
			knownSiteNotificationsFor = userId;
			knownSiteNotificationIds = new Set(list.map((row) => row.id));
		} else {
			for (const row of list) {
				if (knownSiteNotificationIds.has(row.id)) continue;
				knownSiteNotificationIds.add(row.id);
				if (!initial && document.visibilityState !== 'visible') {
					const copy = notificationCopy(row);
					showLocalNotification({
						title: copy.title,
						body: copy.body,
						url: row.url || '/notifications',
						tag: `site-notification-${row.id}`,
						image: row.image
					}).catch(() => {});
				}
			}
		}
		if (knownSiteNotificationIds.size > 120) {
			knownSiteNotificationIds = new Set([...knownSiteNotificationIds].slice(-120));
		}
		notificationCount.set(list.filter((row) => !row.is_read).length);
	}

	function watchSiteNotifications(userId) {
		if (userId === watchedNotificationsFor) return;
		stopWatchingNotifications();
		watchedNotificationsFor = userId;
		if (!userId) {
			stopWatchingNotifications = () => {};
			return;
		}
		stopWatchingNotifications = watchNotifications(userId, (row) => {
			knownSiteNotificationsFor = userId;
			knownSiteNotificationIds.add(row.id);
			notificationCount.update((count) => count + (row.is_read ? 0 : 1));
			// Пока человек уже смотрит на приложение, достаточно бейджа. Шторка
			// ОС нужна именно когда приложение свернули или ушли на другой экран.
			if (document.visibilityState === 'visible') return;
			const copy = notificationCopy(row);
			showLocalNotification({
				title: copy.title,
				body: copy.body,
				url: row.url || '/notifications',
				tag: `site-notification-${row.id}`,
				image: row.image
			}).catch(() => {});
		});
	}

	function readSeenAnixart(id) {
		try {
			return new Set(JSON.parse(localStorage.getItem(`anixart_notifications_${id}`) || '[]'));
		} catch {
			return new Set();
		}
	}

	function hasSeenAnixart(id) {
		try {
			return localStorage.getItem(`anixart_notifications_${id}`) != null;
		} catch {
			return false;
		}
	}

	function writeSeenAnixart(id, seen) {
		try {
			localStorage.setItem(`anixart_notifications_${id}`, JSON.stringify([...seen].slice(-120)));
		} catch {
			/* приватный режим */
		}
	}

	async function pollAnixartNotifications({ initial = false } = {}) {
		if (!$userToken) return;
		try {
			const data = await getApi()?.notification?.getNotifications(0);
			const list = data?.content || [];
			const seen = readSeenAnixart($userToken.id);
			const prime = initial || !hasSeenAnixart($userToken.id);
			for (const row of list) {
				const key = `${row.type || 'event'}:${row.id}`;
				if (!prime && !seen.has(key) && document.visibilityState !== 'visible') {
					const copy = anixartNotificationCopy(row);
					showLocalNotification({ title: copy.title, body: copy.body, url: copy.url, tag: `anixart-${key}` }).catch(() => {});
				}
				seen.add(key);
			}
			writeSeenAnixart($userToken.id, seen);
			if (!initial) notificationCount.set(list.filter((row) => row.is_new).length);
		} catch (e) {
			console.warn('anixart notifications', e);
		}
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

		const anixartPoll = window.setInterval(() => pollAnixartNotifications(), 90_000);
		const sitePoll = window.setInterval(() => {
			if (!$userToken) pollSiteNotifications($siteSession?.user?.id ?? null);
		}, 60_000);
		if ($userToken) {
			const api = getApi();
			api?.notification
				?.countNotifications()
				.then((r) => notificationCount.set(r?.count ?? 0))
				.catch(() => {});
			pollAnixartNotifications({ initial: true });
		}
		return () => {
			window.removeEventListener('resize', syncMobile);
			disposeShell();
			disposePwa();
			stopWatchingNotifications();
			window.clearInterval(anixartPoll);
			window.clearInterval(sitePoll);
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
	}
	.app.mobile .viewport:not(.full) {
		/* высота .mnav + зона безопасности, плюс небольшой зазор */
		padding-bottom: calc(var(--nav-height) + 12px + var(--safe-bottom, 0px));
	}
</style>
