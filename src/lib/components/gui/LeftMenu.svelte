<script>
	import { createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';
	import HomePage from '$lib/pages/Home.svelte';
	import Discover from '$lib/pages/Discover.svelte';
	import Bookmarks from '$lib/pages/Bookmarks.svelte';
	import Profile from '$lib/pages/Profile.svelte';
	import Settings from '$lib/pages/Settings.svelte';
	import Login from '$lib/pages/Login.svelte';

	const dispatch = createEventDispatcher();

	let userToken = null;
	let profileInfo = null;

	if (browser) {
		const token = localStorage.getItem('user_token');
		if (token) {
			userToken = JSON.parse(token);
			profileInfo = userToken;
		}
	}

	const menuItems = [
		{ id: 'home', label: 'Главная', icon: 'home', component: HomePage, args: { typeReleases: 0 } },
		{ id: 'discover', label: 'Обзор', icon: 'compass', component: Discover, args: {} },
		{ id: 'bookmarks', label: 'Закладки', icon: 'bookmark', component: Bookmarks, args: {}, requireAuth: true },
		{ id: 'profile', label: 'Профиль', icon: 'user', component: Profile, args: {}, requireAuth: true },
		{ id: 'settings', label: 'Настройки', icon: 'settings', component: Settings, args: {} }
	];

	let activeItem = 'home';

	function selectItem(item) {
		if (item.requireAuth && !userToken) {
			dispatch('pageChange', { component: Login, args: {} });
			return;
		}
		activeItem = item.id;
		dispatch('pageChange', { component: item.component, args: item.args });
	}
</script>

<aside class="left-menu">
	<div class="menu-header">
		<div class="logo">
			<span class="logo-text">AniShika</span>
			<span class="logo-badge">WEB</span>
		</div>
	</div>

	<nav class="menu-nav">
		{#each menuItems as item}
			{#if !item.requireAuth || userToken}
				<button
					class="menu-item"
					class:active={activeItem === item.id}
					on:click={() => selectItem(item)}
				>
					<span class="menu-icon">{item.icon}</span>
					<span class="menu-label">{item.label}</span>
				</button>
			{/if}
		{/each}
	</nav>

	<div class="menu-footer">
		{#if userToken && profileInfo}
			<div class="user-info">
				<div class="user-avatar">
					{#if profileInfo.avatar}
						<img src={profileInfo.avatar} alt="Avatar" />
					{:else}
						<div class="avatar-placeholder">{profileInfo.login?.[0]?.toUpperCase() || 'U'}</div>
					{/if}
				</div>
				<div class="user-name">{profileInfo.login || 'User'}</div>
			</div>
		{:else}
			<button class="login-btn" on:click={() => selectItem({ component: Login, args: {} })}>
				Войти
			</button>
		{/if}
	</div>
</aside>

<style>
	.left-menu {
		width: 240px;
		height: 100vh;
		background-color: var(--alt-background-color);
		display: flex;
		flex-direction: column;
		border-right: 1px solid rgba(255, 255, 255, 0.1);
		overflow-y: auto;
	}

	.menu-header {
		padding: 20px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.logo-text {
		font-size: 24px;
		font-weight: bold;
		color: var(--primary-color);
	}

	.logo-badge {
		background: var(--primary-color);
		color: white;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 10px;
		font-weight: bold;
	}

	.menu-nav {
		flex: 1;
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		background: transparent;
		border: none;
		border-radius: 8px;
		color: var(--text-color);
		cursor: pointer;
		transition: all 0.2s;
		text-align: left;
		font-size: 14px;
	}

	.menu-item:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.menu-item.active {
		background: var(--primary-color);
		color: white;
	}

	.menu-icon {
		font-size: 18px;
	}

	.menu-footer {
		padding: 20px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.user-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		overflow: hidden;
	}

	.user-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-placeholder {
		width: 100%;
		height: 100%;
		background: var(--primary-color);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-weight: bold;
	}

	.user-name {
		font-size: 14px;
		font-weight: 500;
	}

	.login-btn {
		width: 100%;
		padding: 12px;
		background: var(--primary-color);
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: opacity 0.2s;
	}

	.login-btn:hover {
		opacity: 0.9;
	}

	@media (max-width: 768px) {
		.left-menu {
			width: 100%;
			max-width: 280px;
		}
	}
</style>
