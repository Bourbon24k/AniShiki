<script>
    import { mobileMenuOpen, userToken, guiSettings } from '$lib/stores';
    import { page } from '$app/stores';
    import { fly, fade } from 'svelte/transition';
    import Icon from '$lib/components/Icon.svelte';

    $: isOpen = $mobileMenuOpen;
    $: utoken = $userToken;
    $: currentPath = $page.url.pathname;
    $: theme = $guiSettings?.theme || 'dark';

    function close() {
        mobileMenuOpen.set(false);
    }

    function toggleTheme() {
        guiSettings.update(s => ({ ...s, theme: s.theme === 'light' ? 'amoled' : 'light' }));
    }

    function isActive(path) {
        if (path === '/') return currentPath === '/';
        return currentPath.startsWith(path);
    }

    const menuItems = [
        { href: '/', label: 'Главная', icon: 'home' },
        { href: '/discover', label: 'Каталог', icon: 'discover' },
        { href: '/search', label: 'Поиск', icon: 'search' },
        { href: '/schedule', label: 'Расписание', icon: 'calendar' },
        { href: '/random', label: 'Случайное', icon: 'random' },
        { href: '/collections', label: 'Коллекции', icon: 'collection' },
        { href: '/bookmarks', label: 'Закладки', icon: 'bookmark', auth: true },
        { href: '/history', label: 'История', icon: 'history', auth: true },
        { href: '/friends', label: 'Друзья', icon: 'friends', auth: true },
        { href: '/notifications', label: 'Уведомления', icon: 'notification', auth: true },
        { href: '/settings', label: 'Настройки', icon: 'settings' }
    ];
</script>

{#if isOpen}
    <button type="button" class="menu-backdrop" on:click={close} aria-label="Закрыть меню" transition:fade={{ duration: 200 }}></button>
    <nav class="slide-menu glass" transition:fly={{ x: -300, duration: 260 }}>
        <div class="menu-header">
            <a href="/" class="brand" on:click={close}>
                <img class="brand-mark" src="/favicon.png" alt="AniShiki" />
                <span class="brand-text">AniShiki</span>
            </a>
            <button class="close-btn" on:click={close} aria-label="Закрыть">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
        </div>

        {#if utoken}
            <a href="/profile/{utoken.id}" class="user-card" on:click={close}>
                {#if utoken.avatar}
                    <img src={utoken.avatar} alt="" class="user-avatar" referrerpolicy="no-referrer" />
                {:else}
                    <div class="user-avatar placeholder"><Icon name="profile" size={24} /></div>
                {/if}
                <div class="user-meta">
                    <span class="user-name">{utoken.login}</span>
                    <span class="user-sub">Мой профиль</span>
                </div>
            </a>
        {:else}
            <a href="/login" class="login-card btn btn-primary" on:click={close}>Войти в аккаунт</a>
        {/if}

        <div class="menu-items">
            {#each menuItems as item}
                {#if !item.auth || utoken}
                    <a href={item.href} class="menu-item" class:active={isActive(item.href)} on:click={close}>
                        <Icon name={item.icon} size={22} />
                        <span>{item.label}</span>
                    </a>
                {/if}
            {/each}
        </div>

        <button class="menu-item theme-row" on:click={toggleTheme}>
            <Icon name="discover" size={22} />
            <span>{theme === 'light' ? 'AMOLED тема' : 'Светлая тема'}</span>
        </button>
    </nav>
{/if}

<style>
    .menu-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.55);
        border: 0;
        padding: 0;
        z-index: 100;
        -webkit-backdrop-filter: blur(2px);
        backdrop-filter: blur(2px);
        cursor: default;
    }

    .slide-menu {
        position: fixed;
        top: 0;
        left: 0;
        width: min(320px, calc(100vw - 20px));
        height: 100%;
        z-index: 101;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        padding: env(safe-area-inset-top, 0) 0 calc(16px + env(safe-area-inset-bottom, 0));
        border-right: 1px solid var(--glass-border);
        box-shadow: var(--shadow-lg);
    }

    .menu-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        border-bottom: 1px solid var(--border-color);
    }

    .brand { display: flex; align-items: center; gap: 12px; text-decoration: none; }
    .brand-mark {
        width: 34px; height: 34px; border-radius: 10px;
        object-fit: cover; display: block;
    }
    .brand-text { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: var(--text-color); }

    .close-btn {
        width: 36px; height: 36px; border: none; background: transparent;
        color: var(--text-color); cursor: pointer; display: flex;
        align-items: center; justify-content: center; border-radius: 50%;
    }
    .close-btn:hover { background: var(--surface-hover); }
    .close-btn svg { width: 24px; height: 24px; }

    .user-card {
        display: flex; align-items: center; gap: 12px;
        margin: 0 12px 8px; padding: 12px;
        text-decoration: none; color: var(--text-color);
        border-radius: var(--radius-md);
        background: var(--surface-2);
        border: 1px solid var(--border-color);
    }

    .user-avatar { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; }
    .user-avatar.placeholder {
        display: flex; align-items: center; justify-content: center;
        background: var(--surface-3); color: var(--secondary-text-color);
    }
    .user-meta { display: flex; flex-direction: column; }
    .user-name { font-weight: 700; }
    .user-sub { font-size: 12px; color: var(--secondary-text-color); }

    .login-card { margin: 0 16px 8px; }

    .menu-items { padding: 6px 12px; display: flex; flex-direction: column; gap: 2px; }

    .menu-item {
        display: flex; align-items: center; gap: 14px;
        padding: 12px 14px; text-decoration: none;
        color: var(--secondary-text-color);
        border-radius: var(--radius-sm);
        transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
        font-size: 15px; font-weight: 600;
        background: transparent; border: none; cursor: pointer;
        width: calc(100% - 0px); text-align: left; font-family: inherit;
    }
    .menu-item:hover { background: var(--surface-hover); color: var(--text-color); }
    .menu-item:focus-visible,
    .close-btn:focus-visible,
    .brand:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
    }
    .menu-item.active {
        color: var(--accent-strong);
        background: var(--accent-soft);
        box-shadow: inset 4px 0 0 var(--accent);
    }

    .theme-row { margin: auto 12px 0; }
</style>
