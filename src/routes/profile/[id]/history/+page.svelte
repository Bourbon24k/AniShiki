<script>
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { getApi } from '$lib/api';
    import Preloader from '$lib/components/Preloader.svelte';

    $: profileId = $page.params.id;

    let profile = null;
    let history = [];
    let isLoading = true;
    let isLoadingMore = false;
    let hasMore = true;
    let currentPage = 0;
    let api = null;
    let loadedProfileId = null;
    let supportsPaging = true;

    onMount(async () => {
        if (browser) {
            api = getApi();
            await loadProfile();
            await loadHistory();
        }
    });

    $: if (browser && api && profileId && loadedProfileId !== profileId) {
        loadProfile();
        loadHistory();
    }

    async function loadProfile() {
        if (!api) return;
        try {
            const id = Number(profileId);
            if (!Number.isFinite(id)) return;

            loadedProfileId = profileId;
            const data = await api.profile.info(id);
            profile = data.profile;
        } catch (e) {
            console.error('Error loading profile:', e);
        }
    }

    async function loadHistory() {
        if (!api) return;
        const id = Number(profileId);
        if (!Number.isFinite(id)) return;

        isLoading = true;
        currentPage = 0;
        supportsPaging = true;
        
        try {
            if (api.profile.getHistory) {
                const data = await api.profile.getHistory(id, 0);
                history = data.content || [];
                hasMore = history.length >= 25;
            } else {
                const data = await api.profile.info(id);
                history = data?.profile?.history || [];
                hasMore = false;
                supportsPaging = false;
            }
        } catch (e) {
            console.error('Error loading history:', e);
            history = [];
        }
        isLoading = false;
    }

    async function loadMore() {
        if (!api || isLoadingMore || !hasMore || !supportsPaging) return;
        const id = Number(profileId);
        if (!Number.isFinite(id)) return;

        isLoadingMore = true;
        currentPage++;
        
        try {
            const data = await api.profile.getHistory(id, currentPage);
            const newItems = data.content || [];
            history = [...history, ...newItems];
            hasMore = newItems.length >= 25;
        } catch (e) {
            console.error('Error loading more:', e);
            hasMore = false;
        }
        isLoadingMore = false;
    }
</script>

<svelte:head>
    <title>История {profile?.login || ''} - AniShika</title>
</svelte:head>

<div class="history-page">
    <div class="page-header">
        <a href="/profile/{profileId}" class="back-link">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            {profile?.login || 'Профиль'}
        </a>
        <h1>История просмотра</h1>
    </div>

    <div class="history-content">
        {#if isLoading}
            <Preloader size="large" />
        {:else if history.length === 0}
            <div class="empty-state">
                <p>История просмотра пуста</p>
            </div>
        {:else}
            <div class="history-list">
                {#each history as item (item.id || item.release?.id)}
                    <a href="/release/{item.release?.id || item.id}" class="history-card">
                        <img src={item.release?.image || item.image} alt="" class="history-poster" />
                        <div class="history-info">
                            <h3 class="history-title">{item.release?.title_ru || item.title_ru}</h3>
                            <div class="history-meta">
                                {#if item.episode}
                                    <span class="history-episode">{item.episode} серия</span>
                                {/if}
                                {#if item.source?.name}
                                    <span class="history-source">{item.source.name}</span>
                                {/if}
                            </div>
                            {#if item.timestamp}
                                <span class="history-date">{new Date(item.timestamp * 1000).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
                            {/if}
                        </div>
                    </a>
                {/each}
            </div>
            
            {#if hasMore}
                <div class="load-more-wrapper">
                    {#if isLoadingMore}
                        <Preloader size="small" />
                    {:else}
                        <button class="load-more-btn" on:click={loadMore}>
                            Загрузить ещё
                        </button>
                    {/if}
                </div>
            {/if}
        {/if}
    </div>
</div>

<style>
    .history-page {
        width: 100%;
        min-height: 100%;
        padding: 20px;
    }

    .page-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 24px;
    }

    .back-link {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--secondary-text-color);
        text-decoration: none;
        font-size: 14px;
    }

    .back-link:hover {
        color: var(--text-color);
    }

    .page-header h1 {
        font-size: 24px;
        margin: 0;
        color: var(--text-color);
    }

    .history-content {
        max-width: 900px;
    }

    .history-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .history-card {
        display: flex;
        gap: 16px;
        padding: 16px;
        background: var(--alt-background-color);
        border-radius: 12px;
        text-decoration: none;
        color: inherit;
        transition: background 0.2s;
    }

    .history-card:hover {
        background: var(--background-color);
    }

    .history-poster {
        width: 80px;
        height: 110px;
        object-fit: cover;
        border-radius: 8px;
        flex-shrink: 0;
    }

    .history-info {
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex: 1;
        min-width: 0;
    }

    .history-title {
        font-size: 16px;
        font-weight: 600;
        margin: 0;
        color: var(--text-color);
    }

    .history-meta {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
    }

    .history-episode {
        padding: 4px 10px;
        background: var(--primary-color);
        color: white;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
    }

    .history-source {
        font-size: 13px;
        color: var(--secondary-text-color);
    }

    .history-date {
        font-size: 12px;
        color: var(--secondary-text-color);
        margin-top: auto;
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 60px 20px;
        color: var(--secondary-text-color);
    }

    .load-more-wrapper {
        display: flex;
        justify-content: center;
        padding: 24px 0;
    }

    .load-more-btn {
        padding: 14px 40px;
        background: var(--primary-color);
        color: white;
        border: none;
        border-radius: 10px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
    }

    @media (max-width: 768px) {
        .history-page {
            padding: 16px;
        }

        .history-poster {
            width: 60px;
            height: 85px;
        }
    }
</style>
