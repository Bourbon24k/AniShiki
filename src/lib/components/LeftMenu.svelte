<script>
	/**
	 * Боковая панель на десктопе.
	 *
	 * В покое это узкая полоса из одних иконок, при наведении она разворачивается
	 * и показывает подписи. Разворот происходит поверх страницы: место в раскладке
	 * панель занимает всегда одно и то же, поэтому контент не дёргается.
	 * Прежние всплывающие подсказки не нужны — подпись теперь и есть подсказка.
	 */
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

	$: accountHref = utoken ? `/profile/${utoken.id}` : site ? `/u/${site.user.id}` : '/login';
	$: accountName = utoken?.login || $siteProfile?.username || 'Войти';
	$: accountAvatar = utoken?.avatar || $siteProfile?.avatar_url || null;

	const topItems = [
		{ path: '/', icon: 'home', label: 'Главная' },
		{ path: '/discover', icon: 'discover', label: 'Обзор' },
		{ path: '/search', icon: 'search', label: 'Поиск' },
		{ path: '/schedule', icon: 'schedule', label: 'Расписание' },
		{ path: '/collections', icon: 'collection', label: 'Коллекции' },
		{ path: '/bookmarks', icon: 'bookmark', label: 'Закладки', auth: true, site: true },
		{ path: '/history', icon: 'history', label: 'История', auth: true, site: true },
		{ path: '/friends', icon: 'friends', label: 'Друзья', auth: true, site: true }
	];
	const bottomItems = [
		{ path: '/notifications', icon: 'notification', label: 'Уведомления', auth: true, badge: true },
		{ path: '/settings', icon: 'settings', label: 'Настройки' }
	];

	function isActive(p) {
		return p === '/' ? path === '/' : path.startsWith(p);
	}
</script>

<aside class="slot unselectable">
	<div class="rail">
		<a href="/" class="row logo" title="AniShiki">
			<span class="ico"><img src="/favicon.svg" alt="" /></span>
			<span class="label brand">AniShiki</span>
		</a>

		<div class="divider"></div>

		<nav class="group">
			{#each topItems as item}
				{#if ok(item)}
					<a href={item.path} class="row item" class:active={isActive(item.path)} title={item.label}>
						<span class="ico"><Icon name={item.icon} size={22} /></span>
						<span class="label">{item.label}</span>
					</a>
				{/if}
			{/each}
		</nav>

		<nav class="group bottom">
			{#each bottomItems as item}
				<!-- Профиль всегда стоит непосредственно перед настройками. -->
				{#if item.path === '/settings'}
					<a href={accountHref} class="row item account" title={accountName}>
						<span class="ico">
							<span class="avatar">
								{#if accountAvatar}
									<img src={accountAvatar} alt="" referrerpolicy="no-referrer" />
								{:else}
									<Icon name="user" size={20} />
								{/if}
							</span>
						</span>
						<span class="label">{accountName}</span>
					</a>
				{/if}
				{#if !item.auth || utoken}
					<a href={item.path} class="row item" class:active={isActive(item.path)} title={item.label}>
						<span class="ico">
							<Icon name={item.icon} size={22} />
							{#if item.badge && nCount > 0}
								<span class="badge">{nCount > 99 ? '99+' : nCount}</span>
							{/if}
						</span>
						<span class="label">{item.label}</span>
					</a>
				{/if}
			{/each}
		</nav>
	</div>
</aside>

<style>
	/* Место в раскладке: всегда узкое, чтобы разворот не двигал контент. */
	.slot {
		position: relative;
		width: 76px;
		min-width: 76px;
		height: 100%;
		z-index: 100;
	}

	.rail {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		width: 76px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 16px 14px 18px;
		background: var(--alt-background-color);
		border-right: 1px solid var(--glass-border);
		overflow-x: hidden;
		overflow-y: auto;
		scrollbar-width: none;
		transition: width 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.22s ease;
	}
	.rail::-webkit-scrollbar {
		display: none;
	}
	.rail:hover,
	.rail:focus-within {
		width: 232px;
		box-shadow: 18px 0 44px rgba(0, 0, 0, 0.45);
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.bottom {
		margin-top: auto;
	}

	/* Строка: иконка на своём месте, подпись выезжает справа. */
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		height: 48px;
		border-radius: 14px;
		color: var(--secondary-text-color);
		transition: background 0.2s ease, color 0.2s ease;
	}
	.ico {
		position: relative;
		width: 48px;
		min-width: 48px;
		height: 48px;
		display: grid;
		place-items: center;
	}
	.label {
		white-space: nowrap;
		font-size: 14.5px;
		font-weight: 600;
		opacity: 0;
		transform: translateX(-6px);
		transition: opacity 0.18s ease, transform 0.22s ease;
	}
	.rail:hover .label,
	.rail:focus-within .label {
		opacity: 1;
		transform: none;
	}

	.item:hover {
		background: var(--background-color);
		color: var(--text-color);
	}
	.item.active {
		color: #fff;
		background: var(--primary-color);
	}

	.logo {
		color: var(--text-color);
		margin-bottom: 2px;
	}
	.logo .ico img {
		width: 44px;
		height: 44px;
		transition: transform 0.2s ease;
	}
	.logo:hover .ico img {
		transform: scale(1.06);
	}
	.brand {
		font-size: 19px;
		font-weight: 800;
		letter-spacing: -0.3px;
	}

	.avatar {
		width: 38px;
		height: 38px;
		border-radius: 50%;
		overflow: hidden;
		display: grid;
		place-items: center;
		background: var(--background-color);
		border: 1px solid var(--glass-border);
		transition: box-shadow 0.2s ease;
	}
	.account:hover .avatar {
		box-shadow: 0 0 0 2px var(--primary-color);
	}
	.avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.divider {
		height: 1px;
		margin: 4px 10px 6px;
		background: var(--glass-border);
	}

	.badge {
		position: absolute;
		top: 6px;
		right: 4px;
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
</style>
