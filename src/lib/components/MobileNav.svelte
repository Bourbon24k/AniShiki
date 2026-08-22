<script>
	/**
	 * Нижняя панель — главный способ навигации на телефоне.
	 * Ведёт себя как таб-бар в приложении: пять постоянных вкладок,
	 * отклик на нажатие, подсветка активной, значок на уведомлениях.
	 */
	import { page } from '$app/stores';
	import { userToken, notificationCount } from '$lib/stores';
	import { siteSession } from '$lib/stores/auth';
	import { haptic } from '$lib/ios';
	import Icon from './Icon.svelte';

	$: path = $page.url.pathname;
	$: utoken = $userToken;
	$: loggedIn = !!utoken || !!$siteSession;

	$: tabs = [
		{ href: '/', icon: 'home', label: 'Главная', exact: true },
		{ href: '/discover', icon: 'discover', label: 'Обзор' },
		{ href: '/search', icon: 'search', label: 'Поиск' },
		loggedIn
			? { href: '/bookmarks', icon: 'bookmark', label: 'Списки' }
			: { href: '/schedule', icon: 'schedule', label: 'Календарь' },
		loggedIn
			? { href: '/notifications', icon: 'notification', label: 'События', badge: $notificationCount }
			: { href: '/login', icon: 'user', label: 'Войти' }
	];

	function isActive(tab) {
		if (tab.exact) return path === tab.href;
		if (tab.href === '/notifications') return path.startsWith('/notifications');
		return path.startsWith(tab.href);
	}
</script>

<nav class="mnav">
	{#each tabs as tab (tab.href)}
		<a
			href={tab.href}
			class="item"
			class:active={isActive(tab)}
			on:click={() => haptic('select')}
		>
			<span class="ico">
				<Icon name={tab.icon} size={23} />
				{#if tab.badge > 0}
					<span class="badge">{tab.badge > 99 ? '99+' : tab.badge}</span>
				{/if}
			</span>
			<span class="label">{tab.label}</span>
		</a>
	{/each}
</nav>

<style>
	.mnav {
		display: none;
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		height: calc(var(--nav-height) + var(--safe-bottom, 0px));
		padding-bottom: var(--safe-bottom, 0px);
		/* Фон ровно как у страницы, а не отдельный оттенок: в standalone на iPhone
		   под панелью остаётся полоса (её рисует фон окна, за пределами вёрстки).
		   Совпадающий цвет делает стык невидимым, чем бы полоса ни рисовалась. */
		background: var(--background-color);
		border-top: 1px solid var(--glass-border);
		z-index: 100;
	}
	/* Продолжение фона вниз — на случай, если полоса внутри вёрстки. */
	.mnav::after {
		content: '';
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		height: 90px;
		background: var(--background-color);
		pointer-events: none;
	}
	.item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		color: var(--secondary-text-color);
		transition: color 0.18s ease, transform 0.12s ease;
		-webkit-tap-highlight-color: transparent;
	}
	.item:active {
		transform: scale(0.92);
	}
	.label {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: -0.1px;
	}
	.item.active {
		color: var(--primary-color);
	}
	.ico {
		position: relative;
		display: grid;
		place-items: center;
		height: 24px;
	}
	.badge {
		position: absolute;
		top: -5px;
		left: 55%;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		display: grid;
		place-items: center;
		border-radius: 8px;
		background: var(--primary-color);
		color: #fff;
		font-size: 9.5px;
		font-weight: 800;
		line-height: 1;
		border: 2px solid var(--background-color);
	}
	@media (max-width: 768px) {
		.mnav {
			display: flex;
		}
	}
</style>
