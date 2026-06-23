<script>
	import { mobileMenuOpen, userToken } from '$lib/stores';
	import { page } from '$app/stores';
	import { slide, fade } from 'svelte/transition';
	import Icon from './Icon.svelte';

	$: open = $mobileMenuOpen;
	$: utoken = $userToken;
	$: path = $page.url.pathname;

	const items = [
		{ href: '/', label: 'Главная', icon: 'home' },
		{ href: '/discover', label: 'Обзор', icon: 'discover' },
		{ href: '/search', label: 'Поиск', icon: 'search' },
		{ href: '/schedule', label: 'Расписание', icon: 'schedule' },
		{ href: '/collections', label: 'Коллекции', icon: 'collection' },
		{ href: '/bookmarks', label: 'Закладки', icon: 'bookmark', auth: true },
		{ href: '/history', label: 'История', icon: 'history', auth: true },
		{ href: '/friends', label: 'Друзья', icon: 'friends', auth: true },
		{ href: '/settings', label: 'Настройки', icon: 'settings' }
	];
	const close = () => mobileMenuOpen.set(false);
</script>

{#if open}
	<div class="backdrop" on:click={close} transition:fade={{ duration: 180 }}></div>
	<nav class="drawer" transition:slide={{ axis: 'x', duration: 240 }}>
		<div class="head">
			<span class="logo">AniShiki<sup>β</sup></span>
			<button class="close" on:click={close} aria-label="Закрыть"><Icon name="close" /></button>
		</div>

		{#if utoken}
			<a href={`/profile/${utoken.id}`} class="user" on:click={close}>
				{#if utoken.avatar}
					<img src={utoken.avatar} alt="" referrerpolicy="no-referrer" />
				{:else}
					<span class="ph"><Icon name="user" /></span>
				{/if}
				<span class="name">{utoken.login}</span>
			</a>
		{:else}
			<a href="/login" class="login" on:click={close}>Войти в аккаунт</a>
		{/if}

		<div class="list">
			{#each items as item}
				{#if !item.auth || utoken}
					<a href={item.href} class="row" class:active={path === item.href} on:click={close}>
						<Icon name={item.icon} size={22} /><span>{item.label}</span>
					</a>
				{/if}
			{/each}
		</div>
	</nav>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		z-index: 1000;
	}
	.drawer {
		position: fixed;
		top: 0;
		left: 0;
		width: 290px;
		max-width: 82vw;
		height: 100%;
		background: var(--alt-background-color);
		z-index: 1001;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		border-right: 1px solid var(--glass-border);
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 18px 16px;
	}
	.logo {
		font-size: 22px;
		font-weight: 800;
	}
	.logo sup {
		font-size: 11px;
		color: var(--primary-color);
	}
	.close {
		width: 38px;
		height: 38px;
		border: none;
		background: transparent;
		color: var(--text-color);
		border-radius: 50%;
		display: grid;
		place-items: center;
	}
	.user,
	.login {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 16px;
		margin: 0 12px 8px;
		border-radius: 14px;
		background: var(--background-color);
	}
	.login {
		justify-content: center;
		background: var(--primary-color);
		color: #fff;
		font-weight: 600;
	}
	.user img,
	.user .ph {
		width: 46px;
		height: 46px;
		border-radius: 50%;
		object-fit: cover;
		display: grid;
		place-items: center;
		color: var(--secondary-text-color);
	}
	.name {
		font-weight: 700;
	}
	.list {
		padding: 6px 12px 24px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 13px 14px;
		border-radius: 12px;
		color: var(--text-color);
	}
	.row:active {
		background: var(--background-color);
	}
	.row.active {
		color: var(--primary-color);
		background: color-mix(in srgb, var(--primary-color) 12%, transparent);
	}
</style>
