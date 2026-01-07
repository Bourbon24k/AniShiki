<script>
    import { mobileMenuOpen } from '$lib/stores';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    
    export let showBack = false;
    export let title = 'AniShika';
    
    function toggleMobileMenu() {
        mobileMenuOpen.update(v => !v);
    }
    
    function goBack() {
        history.back();
    }
</script>

<header class="header">
    <div class="header-left">
        <!-- Mobile menu button -->
        <button class="menu-toggle" on:click={toggleMobileMenu} aria-label="Открыть меню">
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
        </button>
        
        <!-- Back button -->
        {#if showBack}
            <button class="back-btn" on:click={goBack} aria-label="Назад">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                </svg>
            </button>
        {/if}
    </div>
    
    <div class="header-center">
        <a href="/" class="logo">
            <span class="logo-text">{title}</span>
            <sup class="beta-badge">β</sup>
        </a>
    </div>
    
    <div class="header-right">
        <a href="/search" class="search-btn" aria-label="Поиск">
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
        </a>
    </div>
</header>

<style>
    .header {
        display: none;
        position: sticky;
        top: 0;
        left: 0;
        right: 0;
        height: calc(56px + env(safe-area-inset-top, 0));
        background-color: var(--alt-background-color);
        z-index: 50;
        padding: 0 16px;
        padding-top: env(safe-area-inset-top, 0);
        align-items: center;
        justify-content: space-between;
    }
    
    .header-left,
    .header-right {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 48px;
    }
    
    .header-center {
        flex: 1;
        display: flex;
        justify-content: center;
    }
    
    .menu-toggle,
    .back-btn,
    .search-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: transparent;
        border: none;
        color: var(--text-color);
        cursor: pointer;
        transition: background-color 0.2s;
    }
    
    .menu-toggle:hover,
    .back-btn:hover,
    .search-btn:hover {
        background-color: var(--background-color);
    }
    
    .menu-toggle svg,
    .back-btn svg,
    .search-btn svg {
        width: 24px;
        height: 24px;
    }
    
    .logo {
        display: flex;
        align-items: center;
        text-decoration: none;
        color: var(--text-color);
    }
    
    .logo-text {
        font-size: 20px;
        font-weight: bold;
    }
    
    .beta-badge {
        font-size: 10px;
        color: var(--primary-color);
        margin-left: 2px;
    }
    
    @media (max-width: 768px) {
        .header {
            display: flex;
        }
    }
</style>
