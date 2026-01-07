<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { getApi } from '$lib/api';
    import { userToken } from '$lib/stores';
    import Preloader from '$lib/components/Preloader.svelte';
    import AnimeCard from '$lib/components/AnimeCard.svelte';

    $: utoken = $userToken;

    let history = [];
    let isLoading = true;
    let page = 0;
    let isLoadingMore = false;
    let hasMore = true;
    let api = null;

    onMount(async () => {
        if (browser) {
            if (!utoken) {
                goto('/login');
                return;
            }
            api = getApi();
            await loadHistory();
        }
    });

    async function loadHistory() {
        if (!api) return;
        isLoading = true;
        try {
            const data = await api.release.getHistory(page);
            console.log('History data:', data);
            history = data.content || [];
            hasMore = history.length >= 20;
        } catch (e) {
            console.error('Error loading history:', e);
        }
        isLoading = false;
    }

    async function loadMore() {
        if (!api || isLoadingMore || !hasMore) return;
        isLoadingMore = true;
        page++;
        try {
            const data = await api.release.getHistory(page);
            const newItems = data.content || [];
            history = [...history, ...newItems];
            hasMore = newItems.length >= 20;
        } catch (e) {
            console.error('Error loading more:', e);
        }
        isLoadingMore = false;
    }

    async function clearHistory() {
        if (!api) return;
        if (!confirm('Вы уверены, что хотите очистить историю?')) return;
        
        try {
            // Clear each item from history
            for (const item of history) {
                await api.release.removeFromHistory(item.id);
            }
            history = [];
        } catch (e) {
            console.error('Error clearing history:', e);
        }
    }

    function handleScroll(e) {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollHeight - scrollTop - clientHeight < 500 && !isLoadingMore && hasMore) {
            loadMore();
        }
    }
</script>

<svelte:head>
    <title>История просмотра - AniShika</title>
</svelte:head>

<div class="history-page" on:scroll={handleScroll}>
    <div class="history-header">
        <h1>История просмотра</h1>
        {#if history.length > 0}
            <button class="clear-btn" on:click={clearHistory}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
                Очистить
            </button>
        {/if}
    </div>

    <div class="history-content">
        {#if isLoading}
            <Preloader size="large" />
        {:else if history.length === 0}
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
                    <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
                </svg>
                <p>История просмотра пуста</p>
                <a href="/discover" class="browse-btn">Начать смотреть</a>
            </div>
        {:else}
            <div class="history-grid">
                {#each history as anime (anime.id)}
                    <AnimeCard {anime} type="grid" />
                {/each}
            </div>
            
            {#if isLoadingMore}
                <Preloader size="small" />
            {/if}
        {/if}
    </div>
</div>

<style>
    .history-page {
        width: 100%;
        height: 100%;
        overflow-y: auto;
        padding: 20px;
    }

    .history-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
    }

    .history-header h1 {
        font-size: 24px;
        margin: 0;
        color: var(--text-color);
    }

    .clear-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        border: none;
        border-radius: 8px;
        background: var(--alt-background-color);
        color: var(--dropped-color);
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .clear-btn:hover {
        background: var(--dropped-color);
        color: white;
    }

    .history-content {
        max-width: 1400px;
    }

    .history-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 20px;
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

    .empty-state p {
        margin-bottom: 20px;
    }

    .browse-btn {
        padding: 12px 24px;
        background: var(--primary-color);
        color: white;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 500;
    }

    @media (max-width: 768px) {
        .history-page {
            padding: 16px;
        }

        .history-header h1 {
            font-size: 20px;
        }

        .history-grid {
            grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
            gap: 12px;
        }
    }
</style>
