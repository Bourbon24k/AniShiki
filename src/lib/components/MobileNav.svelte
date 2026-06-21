<script>
    import { page } from '$app/stores';
    import { userToken, notificationCount } from '$lib/stores';
    import Icon from '$lib/components/Icon.svelte';

    $: currentPath = $page.url.pathname;
    $: nCount = $notificationCount;
    $: utoken = $userToken;

    function isActive(path) {
        if (path === '/') return currentPath === '/';
        return currentPath.startsWith(path);
    }

    $: items = [
        { path: '/', icon: 'home', label: 'Главная' },
        { path: '/discover', icon: 'discover', label: 'Каталог' },
        { path: '/search', icon: 'search', label: 'Поиск' },
        ...(utoken ? [{ path: '/bookmarks', icon: 'bookmark', label: 'Закладки' }] : []),
        { path: utoken ? `/profile/${utoken.id}` : '/login', icon: 'profile', label: utoken ? 'Профиль' : 'Войти', match: utoken ? '/profile' : '/login' }
    ];
</script>

<nav class="mobile-nav glass">
    {#each items as item}
        <a href={item.path} class="nav-item" class:active={isActive(item.match || item.path)}>
            <span class="icon-wrapper">
                <Icon name={item.icon} size={24} />
                {#if item.path === '/notifications' && nCount > 0}<span class="badge"></span>{/if}
            </span>
            <span class="label">{item.label}</span>
        </a>
    {/each}
</nav>

<style>
    .mobile-nav {
        display: none;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: calc(64px + env(safe-area-inset-bottom, 0));
        border-top: 1px solid var(--glass-border);
        z-index: 100;
        padding: 6px 6px env(safe-area-inset-bottom, 0);
        justify-content: space-around;
    }

    .nav-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 1;
        text-decoration: none;
        color: var(--secondary-text-color);
        gap: 3px;
        border-radius: var(--radius-sm);
        padding: 6px 0;
        transition: color var(--dur) var(--ease), transform var(--dur-fast) var(--ease);
        position: relative;
    }

    .nav-item.active { color: var(--accent-strong); }
    .nav-item:active { transform: scale(0.92); }

    .nav-item.active::before {
        content: '';
        position: absolute;
        top: 0;
        width: 22px;
        height: 3px;
        border-radius: 0 0 3px 3px;
        background: var(--accent);
    }

    .icon-wrapper {
        position: relative;
        display: flex;
    }

    .label {
        font-size: 10.5px;
        font-weight: 600;
    }

    .badge {
        position: absolute;
        top: -2px;
        right: -4px;
        width: 8px;
        height: 8px;
        background: var(--accent);
        border-radius: 50%;
    }

    @media (max-width: 768px) {
        .mobile-nav { display: flex; }
    }
</style>
