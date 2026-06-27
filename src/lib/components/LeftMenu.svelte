<script>
	import { page } from '$app/stores';
	import { userToken, notificationCount } from '$lib/stores';
	import { siteSession, siteProfile } from '$lib/stores/auth';
	import Icon from './Icon.svelte';

	$: path = $page.url.pathname;
	$: utoken = $userToken;
	$: nCount = $notificationCount;
	$: site = $siteSession;
	// доступ к закладкам/истории: аккаунт Anixart ИЛИ аккаунт сайта
	$: ok = (item) => !item.auth || utoken || (item.site && site);

	const topItems = [
		{ path: '/', icon: 'home', label: 'Главная' },
		{ path: '/discover', icon: 'discover', label: 'Обзор' },
		{ path: '/search', icon: 'search', label: 'Поиск' },
		{ path: '/schedule', icon: 'schedule', label: 'Расписание' },
		{ path: '/collections', icon: 'collection', label: 'Коллекции' },
		{ path: '/bookmarks', icon: 'bookmark', label: 'Закладки', auth: true, site: true },
		{ path: '/history', icon: 'history', label: 'История', auth: true, site: true },
		{ path: '/friends', icon: 'friends', label: 'Друзья', auth: true }
	];
	const bottomItems = [
		{ path: '/notifications', icon: 'notification', label: 'Уведомления', auth: true, badge: true },
		{ path: '/settings', icon: 'settings', label: 'Настройки' }
	];

	function isActive(p) {
		return p === '/' ? path === '/' : path.startsWith(p);
	}
</script>

<aside class="rail unselectable">
	<a href="/" class="logo" aria-label="AniShiki">
		<img src="/favicon.svg" alt="AniShiki" />
	</a>

	<a
		href={utoken ? `/profile/${utoken.id}` : site ? '/settings' : '/login'}
		class="avatar"
		title={utoken?.login || $siteProfile?.username || 'Войти'}
	>
		{#if utoken?.avatar}
			<img src={utoken.avatar} alt="" referrerpolicy="no-referrer" />
		{:else if $siteProfile?.avatar_url}
			<img src={$siteProfile.avatar_url} alt="" referrerpolicy="no-referrer" />
		{:else}
			<Icon name="user" size={22} />
		{/if}
	</a>

	<div class="divider"></div>

	<nav class="group">
		{#each topItems as item}
			{#if ok(item)}
				<a href={item.path} class="item" class:active={isActive(item.path)} title={item.label}>
					<Icon name={item.icon} size={22} />
					<span class="tip">{item.label}</span>
				</a>
			{/if}
		{/each}
	</nav>

	<nav class="group bottom">
		{#each bottomItems as item}
			{#if !item.auth || utoken}
				<a href={item.path} class="item" class:active={isActive(item.path)} title={item.label}>
					<span class="ico-wrap">
						<Icon name={item.icon} size={22} />
						{#if item.badge && nCount > 0}
							<span class="badge">{nCount > 99 ? '99+' : nCount}</span>
						{/if}
					</span>
					<span class="tip">{item.label}</span>
				</a>
			{/if}
		{/each}
	</nav>
</aside>

<style>
	.rail {
		display: flex;
		flex-direction: column;
		align-items: center;
		height: 100%;
		width: 76px;
		min-width: 76px;
		padding: 16px 0 18px;
		gap: 8px;
		background: var(--alt-background-color);
		border-right: 1px solid var(--glass-border);
		z-index: 100;
		overflow-y: auto;
	}
	.rail::-webkit-scrollbar {
		display: none;
	}

	.logo {
		width: 46px;
		height: 46px;
		border-radius: 14px;
		overflow: hidden;
		display: grid;
		place-items: center;
		box-shadow: 0 6px 20px var(--primary-glow);
		transition: transform 0.2s ease;
	}
	.logo img {
		width: 100%;
		height: 100%;
	}
	.logo:hover {
		transform: translateY(-2px) scale(1.04);
	}

	.avatar {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		overflow: hidden;
		display: grid;
		place-items: center;
		background: var(--background-color);
		color: var(--secondary-text-color);
		border: 1px solid var(--glass-border);
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}
	.avatar:hover {
		transform: scale(1.06);
		box-shadow: 0 0 0 2px var(--primary-color);
	}
	.avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.divider {
		width: 28px;
		height: 1px;
		background: var(--glass-border);
		margin: 2px 0;
	}

	.group {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		width: 100%;
	}
	.bottom {
		margin-top: auto;
	}

	.item {
		position: relative;
		width: 48px;
		height: 48px;
		display: grid;
		place-items: center;
		border-radius: 14px;
		color: var(--secondary-text-color);
		transition: background 0.2s ease, color 0.2s ease, transform 0.15s ease;
	}
	.item:hover {
		background: var(--background-color);
		color: var(--text-color);
		transform: translateY(-1px);
	}
	.item.active {
		color: #fff;
		background: var(--primary-color);
		box-shadow: 0 6px 18px var(--primary-glow);
	}

	.ico-wrap {
		position: relative;
		display: grid;
		place-items: center;
	}
	.badge {
		position: absolute;
		top: -8px;
		right: -10px;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		font-size: 10px;
		font-weight: 700;
		line-height: 16px;
		text-align: center;
		color: #fff;
		background: var(--primary-color);
		border-radius: 9px;
		border: 2px solid var(--alt-background-color);
	}

	.tip {
		position: absolute;
		left: calc(100% + 10px);
		top: 50%;
		transform: translateY(-50%) translateX(-4px);
		white-space: nowrap;
		padding: 6px 10px;
		font-size: 12px;
		font-weight: 500;
		color: var(--text-color);
		background: var(--elevated-color);
		border: 1px solid var(--glass-border);
		border-radius: 8px;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.18s ease, transform 0.18s ease;
		z-index: 200;
	}
	.item:hover .tip {
		opacity: 1;
		transform: translateY(-50%) translateX(0);
	}
</style>
