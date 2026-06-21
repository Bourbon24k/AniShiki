<script>
    import { page } from '$app/stores';
    import { userToken } from '$lib/stores';
    import Icon from '$lib/components/Icon.svelte';

    $: currentPath = $page.url.pathname;
    $: utoken = $userToken;

    const menuItems = [
        { path: '/', icon: 'home', label: 'Главная' },
        { path: '/discover', icon: 'discover', label: 'Открыть' },
        { path: '/search', icon: 'search', label: 'Поиск' },
        { path: '/bookmarks', icon: 'bookmark', label: 'Закладки' },
        { path: '/history', icon: 'history', label: 'История' },
    ];

    const bottomItems = [
        { path: '/settings', icon: 'settings', label: 'Настройки' },
    ];

    function isActive(path) {
        if (path === '/') return currentPath === '/';
        return currentPath.startsWith(path);
    }

</script>

<aside class="left-menu" aria-label="Основная навигация">
    <nav class="menu-content">
        <a href="/" class="brand" title="AniShiki" aria-label="AniShiki">
            <span class="brand-mark">A</span>
            <span class="brand-text">AniShiki</span>
        </a>

        <a href={utoken ? `/profile/${utoken.id}` : '/login'} class="profile-link" title={utoken ? 'Профиль' : 'Войти'} aria-label={utoken ? 'Профиль' : 'Войти'}>
            <div class="avatar">
                {#if utoken?.avatar}
                    <img src={utoken.avatar} alt="" />
                {:else}
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                {/if}
            </div>
            <span class="profile-name">{utoken?.login || 'Войти'}</span>
        </a>

        <div class="menu-group">
            {#each menuItems as item}
                {#if !item.requireAuth || utoken}
                    <a href={item.path} class="menu-item" class:active={isActive(item.path)} title={item.label}>
                        <span class="menu-icon"><Icon name={item.icon} /></span>
                        <span class="menu-label">{item.label}</span>
                    </a>
                {/if}
            {/each}
        </div>

        <div class="menu-group bottom">
            {#each bottomItems as item}
                {#if !item.requireAuth || utoken}
                    <a href={item.path} class="menu-item" class:active={isActive(item.path)} title={item.label}>
                        <span class="menu-icon">
                            <Icon name={item.icon} />
                        </span>
                        <span class="menu-label">{item.label}</span>
                    </a>
                {/if}
            {/each}
        </div>
    </nav>
</aside>

<style>
    .left-menu {
        --rail-width: 80px;
        --rail-open-width: 260px;
        height: 100%;
        width: var(--rail-width);
        min-width: var(--rail-width);
        z-index: 100;
        position: relative;
    }

    .menu-content {
        position: absolute;
        inset: 0;
        width: var(--rail-width);
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 20px 0;
        gap: 0;
        background: #141416;
        border-right: 1px solid rgba(255, 255, 255, 0.06);
        overflow: hidden;
        transition: width var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
    }

    .left-menu:hover .menu-content,
    .left-menu:focus-within .menu-content {
        width: var(--rail-open-width);
        box-shadow: 18px 0 42px rgba(0, 0, 0, 0.38);
    }

    .brand {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 14px;
        width: 44px;
        height: 44px;
        text-decoration: none;
        color: #fff;
        margin-left: 18px;
        overflow: hidden;
        transition: width var(--dur) var(--ease);
    }

    .left-menu:hover .brand,
    .left-menu:focus-within .brand {
        width: calc(var(--rail-open-width) - 36px);
    }

    .brand-mark {
        width: 44px;
        height: 44px;
        flex: 0 0 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 13px;
        background: linear-gradient(135deg, #ff3b6b, #cc2e56);
        font-family: "Unbounded", "Inter", system-ui, sans-serif;
        font-size: 21px;
        font-weight: 800;
        box-shadow: 0 10px 22px -6px rgba(204, 46, 86, 0.7);
    }

    .brand-text {
        font-family: "Unbounded", "Inter", system-ui, sans-serif;
        font-size: 18px;
        font-weight: 800;
        color: #fff;
        opacity: 0;
        transform: translateX(-4px);
        transition: opacity var(--dur) var(--ease), transform var(--dur) var(--ease);
    }

    .left-menu:hover .brand-text,
    .left-menu:focus-within .brand-text {
        opacity: 1;
        transform: translateX(0);
    }

    .profile-link {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 14px;
        width: 46px;
        height: 46px;
        text-decoration: none;
        border-radius: 50%;
        margin: 22px 0 20px 17px;
        transition: transform 0.2s ease, width var(--dur) var(--ease), border-radius var(--dur) var(--ease);
        overflow: hidden;
    }

    .profile-link:hover { transform: scale(1.06); }

    .left-menu:hover .profile-link,
    .left-menu:focus-within .profile-link {
        width: calc(var(--rail-open-width) - 34px);
        border-radius: 15px;
    }

    .avatar {
        width: 46px;
        height: 46px;
        border-radius: 50%;
        background-image: linear-gradient(135deg, #3a2a30, #1d1d22);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border: 1.5px solid rgba(255, 255, 255, 0.08);
        flex: 0 0 46px;
    }

    .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        transform: scale(1.18);
    }
    .avatar svg { width: 23px; height: 23px; color: #7d7972; }

    .profile-name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #fff;
        font-size: 14px;
        font-weight: 700;
        opacity: 0;
        transform: translateX(-4px);
        transition: opacity var(--dur) var(--ease), transform var(--dur) var(--ease);
    }

    .left-menu:hover .profile-name,
    .left-menu:focus-within .profile-name {
        opacity: 1;
        transform: translateX(0);
    }

    .menu-group {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        width: 100%;
    }

    .left-menu:hover .menu-group,
    .left-menu:focus-within .menu-group {
        align-items: flex-start;
    }

    .menu-group.bottom {
        margin-top: auto;
        padding-top: 0;
        padding-bottom: 0;
        border-top: 0;
        width: 100%;
        align-items: flex-start;
    }

    .left-menu:hover .menu-group.bottom,
    .left-menu:focus-within .menu-group.bottom {
        width: 100%;
    }

    .menu-item {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        width: 50px;
        height: 50px;
        padding: 0;
        border-radius: 15px;
        margin-left: 15px;
        color: #7d7972;
        text-decoration: none;
        transition: filter 0.2s ease, background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
        background: transparent;
        border: none;
        cursor: pointer;
        font-family: inherit;
        position: relative;
        overflow: hidden;
    }

    .left-menu:hover .menu-item,
    .left-menu:focus-within .menu-item {
        width: calc(var(--rail-open-width) - 30px);
        gap: 14px;
    }

    .menu-item:hover {
        filter: brightness(1.25);
        color: #fff;
    }

    .menu-item:focus-visible,
    .brand:focus-visible,
    .profile-link:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
    }

    .menu-item.active {
        background: linear-gradient(135deg, #cc2e56, #ff3b6b);
        color: #fff;
        box-shadow: 0 8px 20px -6px rgba(204, 46, 86, 0.7);
    }

    .menu-icon {
        position: relative;
        flex-shrink: 0;
        width: 50px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .menu-icon :global(svg) { width: 23px; height: 23px; }

    .menu-label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: inherit;
        font-size: 14px;
        font-weight: 700;
        opacity: 0;
        transform: translateX(-4px);
        transition: opacity var(--dur) var(--ease), transform var(--dur) var(--ease);
    }

    .left-menu:hover .menu-label,
    .left-menu:focus-within .menu-label {
        opacity: 1;
        transform: translateX(0);
    }

    @media (prefers-reduced-motion: reduce) {
        .menu-content,
        .brand,
        .brand-text,
        .profile-link,
        .profile-name,
        .menu-label,
        .menu-item {
            transition: none;
        }
    }

    @media (max-width: 768px) {
        .left-menu {
            display: none;
        }
    }
</style>
