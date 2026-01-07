<script>
	import { createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';
	import { slide } from 'svelte/transition';
	import HomePage from '$lib/pages/Home.svelte';
	import Discover from '$lib/pages/Discover.svelte';
	import Bookmarks from '$lib/pages/Bookmarks.svelte';
	import Profile from '$lib/pages/Profile.svelte';
	import Settings from '$lib/pages/Settings.svelte';
	import Login from '$lib/pages/Login.svelte';

	export let isOpen = false;

	const dispatch = createEventDispatcher();

	let userToken = null;

	if (browser) {
		const token = localStorage.getItem('user_token');
		if (token) {
			userToken = JSON.parse(token);
		}
	}

	const menuItems = [
		{ id: 'home', label: 'Главная', icon: '🏠', component: HomePage, args: { typeReleases: 0 } },
		{ id: 'discover', label: 'Обзор', icon: '🧭', component: Discover, args: {} },
		{ id: 'bookmarks', label: 'Закладки', icon: '📚', component: Bookmarks, args: {}, requireAuth: true },
		{ id: 'profile', label: 'Профиль', icon: '👤', component: Profile, args: {}, requireAuth: true },
		{ id: 'settings', label: 'Настройки', icon: '⚙️', component: Settings, args: {} }
	];

	let activeItem = 'home';

	function selectItem(item) {
		if (item.requireAuth && !userToken) {
			dispatch('pageChange', { component: Login, args: {} });
			dispatch('toggle');
			return;
		}
		activeItem = item.id;
		dispatch('pageChange', { component: item.component, args: item.args });
		dispatch('toggle');
	}

	function handleBackdropClick() {
		dispatch('toggle');
	}
</script>

{#if isOpen}
	<div class="mobile-nav-backdrop" on:click={handleBackdropClick} transition:slide></div>
	<nav class="mobile-nav" transition:slide={{ axis: 'x' }}>
		<div class="nav-header">
			<div class="logo">
				<span class="logo-text">AniShika</span>
				<span class="logo-badge">WEB</span>
			</div>
			<button class="close-btn" on:click={handleBackdropClick}>✕</button>
		</div>

		<div class="nav-items">
			{#each menuItems as item}
				{#if !item.requireAuth || userToken}
					<button
						class="nav-item"
						class:active={activeItem === item.id}
						on:click={() => selectItem(item)}
					>
						<span class="nav-icon">{item.icon}</span>
						<span class="nav-label">{item.label}</span>
					</button>
				{/if}
			{/each}
		</div>

		<div class="nav-footer">
			{#if !userToken}
				<button class="login-btn" on:click={() => selectItem({ component: Login, args: {} })}>
					Войти
				</button>
			{/if}
		</div>
	</nav>
{/if}

<style>
	.mobile-nav-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 998;
		backdrop-filter: blur(4px);
	}

	.mobile-nav {
		position: fixed;
		top: 0;
		left: 0;
		bottom: 0;
		width: 80%;
		max-width: 300px;
		background: var(--alt-background-color);
		z-index: 999;
		display: flex;
		flex-direction: column;
		box-shadow: 4px 0 12px rgba(0, 0, 0, 0.3);
	}

	.nav-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.logo-text {
		font-size: 20px;
		font-weight: bold;
		color: var(--primary-color);
	}

	.logo-badge {
		background: var(--primary-color);
		color: white;
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 9px;
		font-weight: bold;
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-color);
		font-size: 24px;
		cursor: pointer;
		padding: 4px;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.nav-items {
		flex: 1;
		padding: 10px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 16px;
		background: transparent;
		border: none;
		border-radius: 8px;
		color: var(--text-color);
		cursor: pointer;
		transition: all 0.2s;
		text-align: left;
		font-size: 16px;
	}

	.nav-item:active {
		transform: scale(0.98);
	}

	.nav-item.active {
		background: var(--primary-color);
		color: white;
	}

	.nav-icon {
		font-size: 20px;
	}

	.nav-footer {
		padding: 20px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.login-btn {
		width: 100%;
		padding: 14px;
		background: var(--primary-color);
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 16px;
		font-weight: 500;
		transition: opacity 0.2s;
	}

	.login-btn:active {
		opacity: 0.8;
	}
</style>
