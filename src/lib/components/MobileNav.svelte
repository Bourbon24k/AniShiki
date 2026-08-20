<script>
	import { page } from '$app/stores';
	import { userToken, notificationCount } from '$lib/stores';
	import { siteSession } from '$lib/stores/auth';
	import Icon from './Icon.svelte';

	$: path = $page.url.pathname;
	$: utoken = $userToken;
	$: nCount = $notificationCount;
	$: loggedIn = !!utoken || !!$siteSession;

	function isActive(p) {
		return p === '/' ? path === '/' : path.startsWith(p);
	}
</script>

<nav class="mnav">
	<a href="/" class="item" class:active={isActive('/')}>
		<Icon name="home" size={22} /><span>Главная</span>
	</a>
	<a href="/discover" class="item" class:active={isActive('/discover')}>
		<Icon name="discover" size={22} /><span>Обзор</span>
	</a>
	<a href="/search" class="item" class:active={isActive('/search')}>
		<Icon name="search" size={22} /><span>Поиск</span>
	</a>
	{#if loggedIn}
		<a href="/bookmarks" class="item" class:active={isActive('/bookmarks')}>
			<Icon name="bookmark" size={22} /><span>Закладки</span>
		</a>
		{#if utoken}
			<a href="/notifications" class="item" class:active={isActive('/notifications')}>
				<span class="ico-wrap">
					<Icon name="notification" size={22} />
					{#if nCount > 0}<span class="dot"></span>{/if}
				</span><span>Уведом.</span>
			</a>
		{:else}
			<a href="/history" class="item" class:active={isActive('/history')}>
				<Icon name="history" size={22} /><span>История</span>
			</a>
		{/if}
	{:else}
		<a href="/login" class="item" class:active={isActive('/login')}>
			<Icon name="user" size={22} /><span>Войти</span>
		</a>
	{/if}
</nav>

<style>
	.mnav {
		display: none;
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		height: calc(56px + var(--safe-bottom, 0px));
		padding-bottom: var(--safe-bottom, 0px);
		/* Сплошной фон вместо стекла: за верхней частью панели есть контент, за
		   нижней (зона безопасности) — нет, и backdrop-filter размывал там чистый
		   фон. Одна панель читалась как панель плюс чёрная полоса под ней. */
		background: var(--alt-background-color);
		border-top: 1px solid var(--glass-border);
		z-index: 100;
	}
	.item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		color: var(--secondary-text-color);
		transition: color 0.2s ease;
	}
	.item span:not(.ico-wrap):not(.dot) {
		font-size: 10px;
		font-weight: 600;
	}
	.item.active {
		color: var(--primary-color);
	}
	.ico-wrap {
		position: relative;
		display: grid;
		place-items: center;
	}
	.dot {
		position: absolute;
		top: -2px;
		right: -4px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--primary-color);
	}
	@media (max-width: 768px) {
		.mnav {
			display: flex;
		}
	}
</style>
