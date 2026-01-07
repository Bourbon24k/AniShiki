<script>
    import { mobileMenuOpen, userToken } from '$lib/stores';
    import { page } from '$app/stores';
    import { slide, fade } from 'svelte/transition';

    $: isOpen = $mobileMenuOpen;
    $: utoken = $userToken;
    $: currentPath = $page.url.pathname;

    function close() {
        mobileMenuOpen.set(false);
    }

    const menuItems = [
        { href: '/', label: 'Главная', icon: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z' },
        { href: '/discover', label: 'Обзор', icon: 'M12 10.9c-.61 0-1.1.49-1.1 1.1s.49 1.1 1.1 1.1c.61 0 1.1-.49 1.1-1.1s-.49-1.1-1.1-1.1zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z' },
        { href: '/search', label: 'Поиск', icon: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z' },
        { href: '/collections', label: 'Коллекции', icon: 'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z' },
        { href: '/bookmarks', label: 'Закладки', icon: 'M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z', auth: true },
        { href: '/history', label: 'История', icon: 'M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z', auth: true },
        { href: '/friends', label: 'Друзья', icon: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z', auth: true },
        { href: '/settings', label: 'Настройки', icon: 'M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z' }
    ];
</script>

{#if isOpen}
    <div class="menu-backdrop" on:click={close} transition:fade={{ duration: 200 }}></div>
    <nav class="slide-menu" transition:slide={{ axis: 'x', duration: 250 }}>
        <div class="menu-header">
            <span class="menu-logo">AniShika</span>
            <button class="close-btn" on:click={close}>
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
        </div>

        {#if utoken}
            <a href="/profile/{utoken.id}" class="user-card" on:click={close}>
                {#if utoken.avatar}
                    <img src={utoken.avatar} alt="" class="user-avatar" referrerpolicy="no-referrer" />
                {:else}
                    <div class="user-avatar placeholder">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                    </div>
                {/if}
                <span class="user-name">{utoken.login}</span>
            </a>
        {:else}
            <a href="/login" class="login-card" on:click={close}>
                <span>Войти в аккаунт</span>
            </a>
        {/if}

        <div class="menu-items">
            {#each menuItems as item}
                {#if !item.auth || utoken}
                    <a href={item.href} class="menu-item" class:active={currentPath === item.href} on:click={close}>
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d={item.icon}/></svg>
                        <span>{item.label}</span>
                    </a>
                {/if}
            {/each}
        </div>
    </nav>
{/if}

<style>
    .menu-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 100;
    }

    .slide-menu {
        position: fixed;
        top: 0;
        left: 0;
        width: 280px;
        height: 100%;
        background: var(--alt-background-color);
        z-index: 101;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
    }

    .menu-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        border-bottom: 1px solid var(--background-color);
    }

    .menu-logo {
        font-size: 20px;
        font-weight: bold;
        color: var(--text-color);
    }

    .close-btn {
        width: 36px;
        height: 36px;
        border: none;
        background: transparent;
        color: var(--text-color);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
    }

    .close-btn:hover {
        background: var(--background-color);
    }

    .close-btn svg {
        width: 24px;
        height: 24px;
    }

    .user-card, .login-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        text-decoration: none;
        color: var(--text-color);
        border-bottom: 1px solid var(--background-color);
    }

    .user-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        object-fit: cover;
    }

    .user-avatar.placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--background-color);
        color: var(--secondary-text-color);
    }

    .user-avatar.placeholder svg {
        width: 24px;
        height: 24px;
    }

    .user-name {
        font-weight: 600;
    }

    .login-card {
        background: var(--primary-color);
        color: white;
        justify-content: center;
        margin: 16px;
        border-radius: 10px;
        border: none;
    }

    .menu-items {
        padding: 8px 0;
    }

    .menu-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 14px 20px;
        text-decoration: none;
        color: var(--text-color);
        transition: background 0.2s;
    }

    .menu-item:hover {
        background: var(--background-color);
    }

    .menu-item.active {
        color: var(--primary-color);
        background: rgba(255, 107, 107, 0.1);
    }

    .menu-item svg {
        width: 24px;
        height: 24px;
        flex-shrink: 0;
    }
</style>
