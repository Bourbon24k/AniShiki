<script>
	/**
	 * События: уведомления Anixart и аккаунта сайта в одном экране.
	 *
	 * Добавлено то, чего не хватало: фильтры по типу, удаление по одному
	 * (у Anixart для этого нужен ещё и тип события), ручное обновление и
	 * запрос разрешения на системные уведомления, если оно ещё не выдано.
	 */
	import { onMount } from 'svelte';
	import { getApi } from '$lib/api';
	import { userToken, notificationCount, showToast } from '$lib/stores';
	import { authReady, siteSession } from '$lib/stores/auth';
	import {
		listNotifications,
		markAllRead,
		removeNotification,
		syncEpisodeNotifications,
		forceNextSync
	} from '$lib/notifications';
	import { notificationPermission, requestNotifications, standalone } from '$lib/pwa';
	import { timeAgo } from '$lib/utils';
	import { haptic } from '$lib/ios';
	import Icon from '$lib/components/Icon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let items = [];
	let pageNum = 0;
	let loading = true;
	let loadingMore = false;
	let hasMore = true;
	let refreshing = false;
	let filter = 'all';

	// Аккаунт сайта: свои уведомления из Supabase вместо ленты Anixart.
	$: siteOnly = !$userToken && !!$siteSession;

	const filters = [
		{ id: 'all', label: 'Все' },
		{ id: 'episode', label: 'Серии' },
		{ id: 'comment', label: 'Ответы' },
		{ id: 'friend', label: 'Друзья' }
	];

	/** Тип события → группа фильтра. Один справочник на оба источника. */
	function group(n) {
		const type = String(n.type || '');
		if (type === 'episode' || type === 'relatedRelease') return 'episode';
		if (type.toLowerCase().includes('comment')) return 'comment';
		if (type.startsWith('friend')) return 'friend';
		return 'other';
	}

	$: visible = filter === 'all' ? items : items.filter((n) => group(n) === filter);

	/* ── аккаунт сайта ── */

	let siteFor = undefined;
	$: if ($authReady && siteOnly) loadSite($siteSession?.user?.id ?? null);

	async function loadSite(userId, force = false) {
		if (userId === siteFor && !force) return;
		siteFor = userId;
		loading = !force;
		// Заодно проверяем новые серии у тайтлов из «Смотрю» (сама себя троттлит).
		await syncEpisodeNotifications().catch(() => {});
		items = await listNotifications().catch((e) => {
			console.error('notifications', e);
			return [];
		});
		hasMore = false;
		loading = false;
		markAllRead().catch(() => {});
		notificationCount.set(0);
	}

	async function dropSite(id) {
		haptic('light');
		items = items.filter((n) => n.id !== id);
		await removeNotification(id).catch(() => {});
	}

	/* ── аккаунт Anixart ── */

	async function load(reset = true) {
		if (siteOnly) return; // своя ветка выше
		if (!$userToken) {
			loading = false;
			return;
		}
		if (reset) {
			pageNum = 0;
			items = [];
			hasMore = true;
			loading = true;
		}
		try {
			const data = await getApi().notification.getNotifications(pageNum);
			const list = data?.content || [];
			items = reset ? list : [...items, ...list];
			hasMore = pageNum < (data?.total_page_count ?? 1) - 1;
			if (reset) {
				getApi().notification.readNotifications().catch(() => {});
				notificationCount.set(0);
			}
		} catch (e) {
			console.error('notifications', e);
			hasMore = false;
		}
		loading = false;
		loadingMore = false;
	}

	function more() {
		if (!hasMore || loadingMore || loading) return;
		loadingMore = true;
		pageNum++;
		load(false);
	}

	/** Anixart удаляет уведомление по паре «тип + id». */
	function apiType(n) {
		switch (n.type) {
			case 'friend':
				return 'friend';
			case 'relatedRelease':
				return 'related/release';
			case 'releaseComment':
				return 'releaseComment';
			case 'collectionComment':
				return 'collectionComment';
			case 'article':
				return 'article';
			default:
				return 'episode';
		}
	}

	async function drop(n) {
		haptic('light');
		const backup = items;
		items = items.filter((x) => x.id !== n.id);
		try {
			await getApi().notification.removeNotification(apiType(n), n.id);
		} catch (e) {
			console.error('drop notification', e);
			items = backup;
			showToast('Не удалось убрать', 'error');
		}
	}

	async function clearAll() {
		if (!confirm('Очистить все уведомления?')) return;
		if (siteOnly) {
			const ids = items.map((n) => n.id);
			items = [];
			await Promise.all(ids.map((id) => removeNotification(id).catch(() => {})));
			showToast('Уведомления очищены', 'success');
			return;
		}
		try {
			await getApi().notification.removeAllNotifications();
			items = [];
			showToast('Уведомления очищены', 'success');
		} catch (e) {
			console.error('clear notifications', e);
			showToast('Ошибка', 'error');
		}
	}

	async function refresh() {
		refreshing = true;
		haptic('light');
		if (siteOnly) {
			// Ручное обновление обходит троттлинг проверки серий.
			forceNextSync();
			await loadSite($siteSession?.user?.id ?? null, true);
		} else {
			await load(true);
		}
		refreshing = false;
	}

	/** Человекочитаемое описание события Anixart. */
	function describe(n) {
		const who = n.by_profile?.login || n.profile?.login || '';
		switch (n.type) {
			case 'friend':
				return {
					text: `${who} ${n.status === 'request' ? 'отправил заявку в друзья' : 'добавил вас в друзья'}`,
					href: `/profile/${n.by_profile?.id || n.profile?.id}`,
					avatar: n.by_profile?.avatar || n.profile?.avatar
				};
			case 'relatedRelease': {
				const rid = typeof n.release === 'object' ? n.release.id : n.release;
				const title = typeof n.release === 'object' ? n.release.title_ru : 'релиз';
				return {
					text: `Новый связанный релиз: ${title}`,
					href: `/release/${rid}`,
					image: typeof n.release === 'object' ? n.release.image : null
				};
			}
			case 'releaseComment':
				return {
					text: `${who} ответил на ваш комментарий`,
					href: `/release/${n.comment?.release?.id || ''}`,
					avatar: n.profile?.avatar
				};
			case 'collectionComment':
				return {
					text: `${who} ответил в коллекции`,
					href: n.collection?.id ? `/collection/${n.collection.id}` : '/collections',
					avatar: n.profile?.avatar
				};
			case 'article':
				return { text: `${who} опубликовал статью`, href: '/feed', avatar: n.profile?.avatar };
			default: {
				const rid = typeof n.release === 'object' ? n.release.id : n.release;
				const title = typeof n.release === 'object' ? n.release.title_ru : null;
				return {
					text: title ? `Новая серия: ${title}` : 'Новое уведомление',
					href: rid ? `/release/${rid}` : '#',
					image: typeof n.release === 'object' ? n.release.image : null
				};
			}
		}
	}

	function siteIcon(type) {
		if (type === 'friend_request' || type === 'friend_accepted') return 'friends';
		if (type === 'comment') return 'feed';
		if (type === 'episode') return 'play';
		return 'notification';
	}

	function onScroll(event) {
		const el = event.currentTarget;
		if (el.scrollHeight - el.scrollTop - el.clientHeight < 500) more();
	}

	onMount(() => load(true));
</script>

<svelte:head><title>События — AniShiki</title></svelte:head>

<div class="page" on:scroll={onScroll}>
	<div class="inner">
		<div class="head">
			<h1>События</h1>
			<div class="head-actions">
				<button class="icon" on:click={refresh} disabled={refreshing} aria-label="Обновить">
					<span class:spinning={refreshing}><Icon name="random" size={17} /></span>
				</button>
				{#if items.length}<button class="clear" on:click={clearAll}>Очистить</button>{/if}
			</div>
		</div>

		{#if $notificationPermission === 'default' && ($userToken || $siteSession)}
			<button class="permission" on:click={requestNotifications}>
				<Icon name="notification" size={18} />
				<span>
					<b>Включить системные уведомления</b>
					{#if !$standalone}
						<i>На iPhone работает после установки приложения на экран «Домой»</i>
					{:else}
						<i>Сообщим о новой серии, даже когда приложение закрыто</i>
					{/if}
				</span>
				<Icon name="chevronRight" size={18} />
			</button>
		{/if}

		{#if !$userToken && !$siteSession}
			<div class="empty">
				<p>Войдите, чтобы видеть события</p>
				<a class="btn" href="/login">Войти</a>
			</div>
		{:else}
			{#if items.length}
				<div class="filters no-scrollbar">
					{#each filters as f}
						<button class="chip" class:active={filter === f.id} on:click={() => (filter = f.id)}>
							{f.label}
						</button>
					{/each}
				</div>
			{/if}

			{#if loading}
				<Spinner center label="Загрузка…" />
			{:else if !visible.length}
				<p class="empty">{filter === 'all' ? 'Пока ничего не происходило' : 'В этой группе пусто'}</p>
			{:else if siteOnly}
				<div class="list">
					{#each visible as n (n.id)}
						<a class="notif" class:new={!n.is_read} href={n.url || '#'}>
							<div class="ico">
								{#if n.image}
									<img class="poster" src={n.image} alt="" referrerpolicy="no-referrer" loading="lazy" />
								{:else}
									<Icon name={siteIcon(n.type)} size={20} />
								{/if}
							</div>
							<div class="body">
								<p>{n.title}</p>
								{#if n.body}<p class="sub">{n.body}</p>{/if}
								<span class="time">{timeAgo(new Date(n.created_at).getTime() / 1000)}</span>
							</div>
							<button
								class="drop"
								aria-label="Убрать"
								on:click|preventDefault|stopPropagation={() => dropSite(n.id)}
							>
								<Icon name="close" size={15} />
							</button>
						</a>
					{/each}
				</div>
			{:else}
				<div class="list">
					{#each visible as n (n.id)}
						{@const d = describe(n)}
						<a class="notif" class:new={n.is_new} href={d.href}>
							<div class="ico">
								{#if d.avatar}
									<img src={d.avatar} alt="" referrerpolicy="no-referrer" loading="lazy" />
								{:else if d.image}
									<img class="poster" src={d.image} alt="" referrerpolicy="no-referrer" loading="lazy" />
								{:else}
									<Icon name="notification" size={20} />
								{/if}
							</div>
							<div class="body">
								<p>{d.text}</p>
								<span class="time">{timeAgo(n.timestamp)}</span>
							</div>
							{#if n.is_new}<span class="dot"></span>{/if}
							<button
								class="drop"
								aria-label="Убрать"
								on:click|preventDefault|stopPropagation={() => drop(n)}
							>
								<Icon name="close" size={15} />
							</button>
						</a>
					{/each}
				</div>
				{#if loadingMore}<Spinner size={28} />{/if}
			{/if}
		{/if}
	</div>
</div>

<style>
	.page {
		height: 100%;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}
	.inner {
		max-width: 780px;
		margin: 0 auto;
		padding: 24px;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 18px;
	}
	h1 {
		font-size: 30px;
		font-weight: 800;
	}
	.head-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.icon {
		width: 36px;
		height: 36px;
		display: grid;
		place-items: center;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		color: var(--secondary-text-color);
		border-radius: 11px;
		cursor: pointer;
	}
	.icon span {
		display: grid;
		place-items: center;
	}
	.spinning {
		animation: spin 0.9s linear infinite;
	}
	.clear {
		padding: 8px 14px;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		color: var(--secondary-text-color);
		border-radius: 11px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}

	.permission {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		text-align: left;
		padding: 13px 15px;
		margin-bottom: 18px;
		border-radius: 15px;
		border: 1px solid color-mix(in srgb, var(--primary-color) 40%, var(--glass-border));
		background: var(--alt-background-color);
		color: var(--primary-color);
		cursor: pointer;
	}
	.permission span {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.permission b {
		font-size: 14px;
		color: var(--text-color);
	}
	.permission i {
		font-style: normal;
		font-size: 12px;
		color: var(--secondary-text-color);
	}

	.filters {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		margin-bottom: 16px;
	}
	.chip {
		white-space: nowrap;
		padding: 8px 15px;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		color: var(--secondary-text-color);
		border-radius: 11px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}
	.chip.active {
		background: var(--primary-color);
		color: #fff;
		border-color: transparent;
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.notif {
		display: flex;
		align-items: center;
		gap: 13px;
		padding: 13px 14px;
		border-radius: 15px;
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		color: var(--text-color);
		transition: border-color 0.2s ease;
	}
	.notif:hover {
		border-color: var(--primary-color);
	}
	.notif.new {
		background: color-mix(in srgb, var(--primary-color) 8%, var(--alt-background-color));
	}
	.ico {
		width: 44px;
		height: 44px;
		min-width: 44px;
		border-radius: 12px;
		overflow: hidden;
		display: grid;
		place-items: center;
		background: var(--background-color);
		color: var(--secondary-text-color);
	}
	.ico img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 50%;
	}
	.ico img.poster {
		border-radius: 0;
	}
	.body {
		flex: 1;
		min-width: 0;
	}
	.body p {
		font-size: 14px;
		line-height: 1.4;
	}
	.body .sub {
		font-size: 13px;
		color: var(--secondary-text-color);
	}
	.time {
		font-size: 11.5px;
		color: var(--third-text-color);
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--primary-color);
		flex-shrink: 0;
	}
	.drop {
		flex-shrink: 0;
		width: 28px;
		height: 28px;
		display: grid;
		place-items: center;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--third-text-color);
		cursor: pointer;
	}
	.drop:hover {
		background: var(--background-color);
		color: var(--danger-color);
	}
	.empty {
		text-align: center;
		padding: 70px 20px;
		color: var(--secondary-text-color);
	}
	.btn {
		display: inline-block;
		margin-top: 14px;
		padding: 11px 22px;
		border-radius: 12px;
		background: var(--primary-color);
		color: #fff;
		font-weight: 700;
	}
	@media (max-width: 768px) {
		.inner {
			padding: 16px 12px;
		}
		h1 {
			font-size: 24px;
		}
	}
</style>
