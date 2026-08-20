<script>
	import { onMount } from 'svelte';
	import { getApi } from '$lib/api';
	import { userToken, notificationCount, showToast } from '$lib/stores';
	import { authReady, siteSession } from '$lib/stores/auth';
	import {
		listNotifications,
		markAllRead,
		removeNotification,
		syncEpisodeNotifications
	} from '$lib/notifications';
	import { returnTimeString } from '$lib/utils';
	import Icon from '$lib/components/Icon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let items = [];
	let pageNum = 0;
	let loading = true;
	let loadingMore = false;
	let hasMore = true;

	// Аккаунт сайта: свои уведомления из Supabase вместо ленты Anixart.
	$: siteOnly = !$userToken && !!$siteSession;
	let siteFor = undefined;
	$: if ($authReady && siteOnly) loadSite($siteSession?.user?.id ?? null);

	async function loadSite(userId) {
		if (userId === siteFor) return;
		siteFor = userId;
		loading = true;
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

	/** Иконка по типу события аккаунта сайта. */
	function siteIcon(type) {
		if (type === 'friend_request' || type === 'friend_accepted') return 'friends';
		if (type === 'comment') return 'feed';
		return 'notification';
	}

	async function dropSite(id) {
		items = items.filter((n) => n.id !== id);
		await removeNotification(id).catch(() => {});
	}

	function describe(n) {
		const who = n.by_profile?.login || n.profile?.login || '';
		switch (n.type) {
			case 'friend':
				return { text: `${who} ${n.status === 'request' ? 'отправил заявку в друзья' : 'добавил вас в друзья'}`, href: `/profile/${n.by_profile?.id || n.profile?.id}`, avatar: n.by_profile?.avatar || n.profile?.avatar };
			case 'relatedRelease': {
				const rid = typeof n.release === 'object' ? n.release.id : n.release;
				const title = typeof n.release === 'object' ? n.release.title_ru : 'релиз';
				return { text: `Новый связанный релиз: ${title}`, href: `/release/${rid}`, image: typeof n.release === 'object' ? n.release.image : null };
			}
			case 'releaseComment':
				return { text: `${who} ответил на ваш комментарий`, href: `/release/${n.comment?.release?.id || ''}`, avatar: n.profile?.avatar };
			case 'collectionComment':
				return { text: `${who} ответил в коллекции`, href: '#', avatar: n.profile?.avatar };
			case 'article':
				return { text: `${who} опубликовал статью`, href: '/feed', avatar: n.profile?.avatar };
			default:
				return { text: 'Уведомление', href: '#' };
		}
	}

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
		}
		loading = false;
		loadingMore = false;
	}
	function more() {
		if (!hasMore || loadingMore) return;
		loadingMore = true;
		pageNum++;
		load(false);
	}
	async function clearAll() {
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
		} catch {
			showToast('Ошибка', 'error');
		}
	}
	function onScroll(e) {
		const el = e.target;
		if (el.scrollHeight - el.scrollTop - el.clientHeight < 500) more();
	}
	onMount(() => load(true));
</script>

<svelte:head><title>Уведомления — AniShiki</title></svelte:head>

<div class="page" on:scroll={onScroll}>
	<div class="inner">
		<div class="head">
			<h1>Уведомления</h1>
			{#if items.length}<button class="clear" on:click={clearAll}>Очистить всё</button>{/if}
		</div>

		{#if siteOnly}
			{#if loading}
				<Spinner center label="Загрузка…" />
			{:else if items.length === 0}
				<p class="empty">Пока ничего не происходило</p>
			{:else}
				<div class="list">
					{#each items as n (n.id)}
						<a class="notif" class:new={!n.is_read} href={n.url || '#'}>
							<div class="ico">
								{#if n.image}<img class="poster" src={n.image} alt="" referrerpolicy="no-referrer" />
								{:else}<Icon name={siteIcon(n.type)} size={20} />{/if}
							</div>
							<div class="body">
								<p>{n.title}</p>
								{#if n.body}<p class="sub">{n.body}</p>{/if}
								<span class="time">{returnTimeString(new Date(n.created_at).getTime())}</span>
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
			{/if}
		{:else if !$userToken}
			<div class="empty"><p>Войдите, чтобы видеть уведомления</p><a class="btn" href="/login">Войти</a></div>
		{:else if loading}
			<Spinner center label="Загрузка…" />
		{:else if items.length === 0}
			<p class="empty">Нет новых уведомлений</p>
		{:else}
			<div class="list">
				{#each items as n (n.id)}
					{@const d = describe(n)}
					<a class="notif" class:new={n.is_new} href={d.href}>
						<div class="ico">
							{#if d.avatar}<img src={d.avatar} alt="" referrerpolicy="no-referrer" />
							{:else if d.image}<img class="poster" src={d.image} alt="" referrerpolicy="no-referrer" />
							{:else}<Icon name="notification" size={20} />{/if}
						</div>
						<div class="body">
							<p>{d.text}</p>
							<span class="time">{returnTimeString(n.timestamp * 1000)}</span>
						</div>
						{#if n.is_new}<span class="dot"></span>{/if}
					</a>
				{/each}
			</div>
			{#if loadingMore}<Spinner size={28} />{/if}
		{/if}
	</div>
</div>

<style>
	.page {
		height: 100%;
		overflow-y: auto;
	}
	.inner {
		max-width: 760px;
		margin: 0 auto;
		padding: 24px;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 20px;
	}
	.sub {
		margin-top: 2px;
		font-size: 13px;
		color: var(--secondary-text-color);
	}
	.drop {
		flex-shrink: 0;
		width: 30px;
		height: 30px;
		display: grid;
		place-items: center;
		border: none;
		background: transparent;
		color: var(--third-text-color, var(--secondary-text-color));
		border-radius: 8px;
		cursor: pointer;
	}
	.drop:hover {
		background: var(--background-color);
		color: var(--text-color);
	}
	h1 {
		font-size: 30px;
		font-weight: 800;
	}
	.clear {
		border: none;
		background: transparent;
		color: var(--primary-color);
		font-weight: 600;
		cursor: pointer;
		font-size: 14px;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.notif {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 16px;
		border-radius: 14px;
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		color: var(--text-color);
		position: relative;
		transition: transform 0.15s ease;
	}
	.notif:hover {
		transform: translateX(2px);
	}
	.notif.new {
		border-color: color-mix(in srgb, var(--primary-color) 40%, transparent);
	}
	.ico {
		width: 46px;
		height: 46px;
		min-width: 46px;
		border-radius: 50%;
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
	}
	.ico .poster {
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
	.time {
		font-size: 12px;
		color: var(--third-text-color);
	}
	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--primary-color);
	}
	.empty {
		text-align: center;
		padding: 70px 20px;
		color: var(--secondary-text-color);
	}
	.empty .btn {
		display: inline-block;
		margin-top: 14px;
		padding: 12px 24px;
		background: var(--primary-color);
		color: #fff;
		border-radius: 12px;
		font-weight: 600;
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
