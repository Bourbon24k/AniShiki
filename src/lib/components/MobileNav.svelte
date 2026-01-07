<script>
    import { page } from '$app/stores';
    import { userToken, notificationCount } from '$lib/stores';
    
    $: currentPath = $page.url.pathname;
    $: nCount = $notificationCount;
    $: utoken = $userToken;
    
    function isActive(path) {
        if (path === '/') return currentPath === '/';
        return currentPath.startsWith(path);
    }
</script>

<nav class="mobile-nav">
    <a href="/" class="nav-item" class:active={isActive('/')}>
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
        <span>Главная</span>
    </a>
    
    <a href="/search" class="nav-item" class:active={isActive('/search')}>
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <span>Поиск</span>
    </a>
    
    {#if utoken}
        <a href="/bookmarks" class="nav-item" class:active={isActive('/bookmarks')}>
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
            </svg>
            <span>Закладки</span>
        </a>
        
        <a href="/notifications" class="nav-item" class:active={isActive('/notifications')}>
            <span class="icon-wrapper">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                </svg>
                {#if nCount > 0}
                    <span class="badge"></span>
                {/if}
            </span>
            <span>Уведомления</span>
        </a>
    {/if}
    
    <a href={utoken ? `/profile/${utoken.id}` : '/login'} class="nav-item" class:active={isActive('/profile') || isActive('/login')}>
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
        <span>{utoken ? 'Профиль' : 'Войти'}</span>
    </a>
</nav>

<style>
    .mobile-nav {
        display: none;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: calc(64px + env(safe-area-inset-bottom, 0));
        background-color: var(--alt-background-color);
        border-top: 1px solid var(--background-color);
        z-index: 100;
        padding: 0 8px;
        padding-bottom: env(safe-area-inset-bottom, 0);
    }
    
    .nav-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 1;
        text-decoration: none;
        color: var(--secondary-text-color);
        gap: 4px;
        transition: color 0.2s;
    }
    
    .nav-item:hover,
    .nav-item.active {
        color: var(--primary-color);
    }
    
    .nav-item svg {
        width: 24px;
        height: 24px;
    }
    
    .nav-item span:not(.icon-wrapper):not(.badge) {
        font-size: 10px;
        font-weight: 500;
    }
    
    .icon-wrapper {
        position: relative;
        display: flex;
    }
    
    .badge {
        position: absolute;
        top: -2px;
        right: -4px;
        width: 8px;
        height: 8px;
        background-color: var(--primary-color);
        border-radius: 50%;
    }
    
    @media (max-width: 768px) {
        .mobile-nav {
            display: flex;
        }
    }
</style>
