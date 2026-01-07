<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { getApi } from '$lib/api';
    import { userToken, notificationCount } from '$lib/stores';
    import { returnTimeString } from '$lib/utils';
    import Preloader from '$lib/components/Preloader.svelte';

    $: utoken = $userToken;

    let notifications = [];
    let isLoading = true;
    let page = 0;
    let isLoadingMore = false;
    let api = null;

    function resolveNotificationText(n) {
        if (!n) return 'Уведомление';

        if (n.by_profile) {
            const who = n.by_profile?.login || 'Пользователь';
            const status = n.status || '';
            if (status) return `${who}: ${status}`;
            return `${who}: заявка в друзья`;
        }

        if (n.release) {
            const rel = typeof n.release === 'object' ? n.release : null;
            const title = rel?.title_ru || rel?.title_original || `релиз #${n.release}`;
            return `Связанный релиз: ${title}`;
        }

        if (n.article) {
            return 'Новая статья';
        }

        return n.text || 'Уведомление';
    }

    function resolveNotificationPoster(n) {
        if (!n) return null;
        if (n.release && typeof n.release === 'object') return n.release.image;
        return null;
    }

    function resolveNotificationHref(n) {
        if (!n) return null;
        if (n.release) {
            const id = typeof n.release === 'object' ? n.release.id : n.release;
            if (id != null) return `/release/${id}`;
        }
        if (n.by_profile?.id != null) return `/profile/${n.by_profile.id}`;
        return null;
    }

    onMount(async () => {
        if (browser) {
            if (!utoken) {
                goto('/login');
                return;
            }
            api = getApi();
            await loadNotifications();
        }
    });

    async function loadNotifications() {
        if (!api) return;
        isLoading = true;
        try {
            const data = await api.notification.getNotifications(page);
            notifications = data.content || [];
            try {
                await api.notification.readNotifications();
            } catch (_) {
            }
            notificationCount.set(0);
        } catch (e) {
            console.error('Error loading notifications:', e);
        }
        isLoading = false;
    }

    async function loadMore() {
        if (!api || isLoadingMore) return;
        isLoadingMore = true;
        page++;
        try {
            const data = await api.notification.getNotifications(page);
            notifications = [...notifications, ...(data.content || [])];
        } catch (e) {
            console.error('Error loading more:', e);
        }
        isLoadingMore = false;
    }

    function getNotificationIcon(type) {
        switch(type) {
            case 'myCollection':
                return `<path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/>`;
            case 'relatedRelease':
                return `<path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9 8l7 4-7 4V8z"/>`;
            case 'friend':
                return `<path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>`;
            default:
                return `<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>`;
        }
    }

    function handleScroll(e) {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollHeight - scrollTop - clientHeight < 500 && !isLoadingMore) {
            loadMore();
        }
    }
</script>

<svelte:head>
    <title>Уведомления - AniShika</title>
</svelte:head>

<div class="notifications-page" on:scroll={handleScroll}>
    <div class="notifications-header">
        <h1>Уведомления</h1>
    </div>

    <div class="notifications-content">
        {#if isLoading}
            <Preloader size="large" />
        {:else if notifications.length === 0}
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
                    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                </svg>
                <p>Нет новых уведомлений</p>
            </div>
        {:else}
            <div class="notifications-list">
                {#each notifications as notification (notification.id)}
                    {@const href = resolveNotificationHref(notification)}
                    {@const poster = resolveNotificationPoster(notification)}
                    <div class="notification-item">
                        <div class="notification-icon">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                {@html getNotificationIcon(notification.type)}
                            </svg>
                        </div>
                        <div class="notification-content">
                            <p class="notification-text">{resolveNotificationText(notification)}</p>
                            {#if notification.timestamp}
                                <span class="notification-time">{returnTimeString(notification.timestamp * 1000)}</span>
                            {/if}
                        </div>
                        {#if href && poster}
                            <a href={href} class="notification-link">
                                <img src={poster} alt="" class="notification-poster" />
                            </a>
                        {:else if href}
                            <a href={href} class="notification-link">
                                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                                    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                                </svg>
                            </a>
                        {/if}
                    </div>
                {/each}
                
                {#if isLoadingMore}
                    <Preloader size="small" />
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    .notifications-page {
        width: 100%;
        height: 100%;
        overflow-y: auto;
    }

    .notifications-header {
        position: sticky;
        top: 0;
        background-color: var(--background-color);
        z-index: 10;
        padding: 20px;
    }

    .notifications-header h1 {
        font-size: 24px;
        margin: 0;
        color: var(--text-color);
    }

    .notifications-content {
        padding: 0 20px 20px;
        max-width: 800px;
    }

    .notifications-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .notification-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        background-color: var(--alt-background-color);
        border-radius: 12px;
        transition: background-color 0.2s;
    }

    .notification-item:hover {
        filter: brightness(1.1);
    }

    .notification-icon {
        flex-shrink: 0;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: var(--background-color);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .notification-icon svg {
        width: 22px;
        height: 22px;
        color: var(--secondary-text-color);
    }

    .notification-content {
        flex: 1;
        min-width: 0;
    }

    .notification-text {
        font-size: 14px;
        color: var(--text-color);
        margin: 0 0 4px;
        line-height: 1.4;
    }

    .notification-time {
        font-size: 12px;
        color: var(--secondary-text-color);
    }

    .notification-link {
        flex-shrink: 0;
    }

    .notification-poster {
        width: 50px;
        height: 70px;
        object-fit: cover;
        border-radius: 6px;
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 20px;
        color: var(--secondary-text-color);
        text-align: center;
    }

    .empty-icon {
        width: 64px;
        height: 64px;
        margin-bottom: 16px;
        opacity: 0.5;
    }

    @media (max-width: 768px) {
        .notifications-header {
            padding: 16px;
        }

        .notifications-header h1 {
            font-size: 20px;
        }

        .notifications-content {
            padding: 0 12px 12px;
        }

        .notification-item {
            padding: 12px;
        }
    }
</style>
