<script>
    import { page } from '$app/stores';
    import { userToken, notificationCount, mobileMenuOpen } from '$lib/stores';
    import { getApi } from '$lib/api';
    
    $: currentPath = $page.url.pathname;
    $: nCount = $notificationCount;
    $: utoken = $userToken;
    $: isMobileMenuOpen = $mobileMenuOpen;
    
    const menuItems = [
        { path: '/', icon: 'home', label: 'Главная' },
        { path: '/discover', icon: 'discover', label: 'Открыть' },
        { path: '/search', icon: 'search', label: 'Поиск' },
        { path: '/random', icon: 'random', label: 'Случайное' },
        { path: '/feed', icon: 'feed', label: 'Лента' },
        { path: '/collections', icon: 'collection', label: 'Коллекции' },
        { path: '/bookmarks', icon: 'bookmark', label: 'Закладки', requireAuth: true },
        { path: '/history', icon: 'history', label: 'История', requireAuth: true },
        { path: '/friends', icon: 'friends', label: 'Друзья', requireAuth: true },
    ];
    
    const bottomItems = [
        { path: '/notifications', icon: 'notification', label: 'Уведомления', requireAuth: true },
        { path: '/settings', icon: 'settings', label: 'Настройки' },
    ];
    
    function closeMobileMenu() {
        mobileMenuOpen.set(false);
    }
    
    function isActive(path) {
        if (path === '/') return currentPath === '/';
        return currentPath.startsWith(path);
    }
</script>

<aside class="left-menu" class:mobile-open={isMobileMenuOpen}>
    <div class="menu-overlay" on:click={closeMobileMenu} class:visible={isMobileMenuOpen}></div>
    
    <nav class="menu-content">
        <div class="top-menu">
            <!-- Avatar -->
            <a 
                href={utoken ? `/profile/${utoken.id}` : '/login'} 
                class="avatar-link"
                on:click={closeMobileMenu}
            >
                <div class="avatar">
                    {#if utoken?.avatar}
                        <img src={utoken.avatar} alt="Avatar" />
                    {:else}
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                    {/if}
                </div>
            </a>
            
            <!-- Main menu items -->
            {#each menuItems as item}
                {#if !item.requireAuth || utoken}
                    <a 
                        href={item.path} 
                        class="menu-item" 
                        class:active={isActive(item.path)}
                        on:click={closeMobileMenu}
                        title={item.label}
                    >
                        <span class="menu-icon">
                            {#if item.icon === 'home'}
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                                </svg>
                            {:else if item.icon === 'bookmark'}
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
                                </svg>
                            {:else if item.icon === 'friends'}
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                                </svg>
                            {:else if item.icon === 'collection'}
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/>
                                </svg>
                            {:else if item.icon === 'discover'}
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 10.9c-.61 0-1.1.49-1.1 1.1s.49 1.1 1.1 1.1c.61 0 1.1-.49 1.1-1.1s-.49-1.1-1.1-1.1zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z"/>
                                </svg>
                            {:else if item.icon === 'search'}
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                                </svg>
                            {:else if item.icon === 'random'}
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
                                </svg>
                            {:else if item.icon === 'feed'}
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                                </svg>
                            {:else if item.icon === 'history'}
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
                                </svg>
                            {/if}
                        </span>
                        <span class="menu-label">{item.label}</span>
                    </a>
                {/if}
            {/each}
        </div>
        
        <div class="bottom-menu">
            {#each bottomItems as item}
                {#if !item.requireAuth || utoken}
                    <a 
                        href={item.path} 
                        class="menu-item" 
                        class:active={isActive(item.path)}
                        on:click={closeMobileMenu}
                        title={item.label}
                    >
                        <span class="menu-icon" class:has-badge={item.icon === 'notification' && nCount > 0}>
                            {#if item.icon === 'notification'}
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                                </svg>
                                {#if nCount > 0}
                                    <span class="badge">{nCount > 99 ? '99+' : nCount}</span>
                                {/if}
                            {:else if item.icon === 'settings'}
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                                </svg>
                            {/if}
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
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: var(--alt-background-color);
        width: 75px;
        min-width: 75px;
        z-index: 100;
        transition: width 0.3s ease;
    }
    
    .menu-overlay {
        display: none;
    }
    
    .menu-content {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
    }
    
    .top-menu {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding-top: 20px;
        gap: 8px;
    }
    
    .bottom-menu {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-top: auto;
        padding-bottom: 20px;
        gap: 8px;
    }
    
    .avatar-link {
        margin-bottom: 16px;
    }
    
    .avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background-color: var(--background-color);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        transition: transform 0.2s ease;
    }
    
    .avatar:hover {
        transform: scale(1.05);
    }
    
    .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    
    .avatar svg {
        width: 28px;
        height: 28px;
        color: var(--secondary-text-color);
    }
    
    .menu-item {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 50px;
        height: 50px;
        border-radius: 12px;
        color: var(--secondary-text-color);
        text-decoration: none;
        transition: all 0.2s ease;
    }
    
    .menu-item:hover {
        background-color: var(--background-color);
        color: var(--text-color);
    }
    
    .menu-item.active {
        background-color: var(--primary-color);
        color: white;
    }
    
    .menu-icon {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .menu-icon svg {
        width: 24px;
        height: 24px;
    }
    
    .menu-icon.has-badge::after {
        content: '';
        position: absolute;
        top: -2px;
        right: -2px;
        width: 8px;
        height: 8px;
        background-color: var(--primary-color);
        border-radius: 50%;
    }
    
    .badge {
        position: absolute;
        top: -8px;
        right: -8px;
        background-color: var(--primary-color);
        color: white;
        font-size: 10px;
        font-weight: bold;
        padding: 2px 5px;
        border-radius: 10px;
        min-width: 16px;
        text-align: center;
    }
    
    .menu-label {
        display: none;
    }
    
    /* Mobile styles */
    @media (max-width: 768px) {
        .left-menu {
            position: fixed;
            left: -280px;
            top: 0;
            width: 280px;
            height: 100vh;
            z-index: 1000;
            transition: left 0.3s ease;
        }
        
        .left-menu.mobile-open {
            left: 0;
        }
        
        .menu-overlay {
            display: block;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
            z-index: -1;
        }
        
        .menu-overlay.visible {
            opacity: 1;
            visibility: visible;
        }
        
        .menu-item {
            width: 100%;
            justify-content: flex-start;
            padding: 0 20px;
            border-radius: 0;
            height: 56px;
        }
        
        .menu-label {
            display: block;
            margin-left: 16px;
            font-size: 16px;
        }
        
        .avatar-link {
            padding: 20px;
            width: 100%;
            display: flex;
            justify-content: center;
        }
        
        .avatar {
            width: 64px;
            height: 64px;
        }
    }
</style>
