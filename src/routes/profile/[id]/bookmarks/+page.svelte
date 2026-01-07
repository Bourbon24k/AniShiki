<script>
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { getApi } from '$lib/api';
    import { userToken } from '$lib/stores';
    import Preloader from '$lib/components/Preloader.svelte';
    import AnimeCard from '$lib/components/AnimeCard.svelte';

    $: profileId = $page.params.id;
    $: utoken = $userToken;

    let profile = null;
    let bookmarks = [];
    let isLoading = true;
    let isLoadingMore = false;
    let hasMore = true;
    let currentPage = 0;
    let api = null;
    let activeStatus = 1; // 1=watching, 2=planned, 3=watched, 4=hold, 5=dropped

    const statuses = [
        { id: 1, name: 'Смотрю', color: 'var(--watching-color)' },
        { id: 2, name: 'В планах', color: 'var(--planned-color)' },
        { id: 3, name: 'Просмотрено', color: 'var(--completed-color)' },
        { id: 4, name: 'Отложено', color: 'var(--hold-on-color)' },
        { id: 5, name: 'Брошено', color: 'var(--dropped-color)' }
    ];

    onMount(async () => {
        if (browser) {
            api = getApi();
            await loadProfile();
            await loadBookmarks();
        }
    });

    async function loadProfile() {
        if (!api) return;
        try {
            const data = await api.profile.info(profileId);
            profile = data.profile;
        } catch (e) {
            console.error('Error loading profile:', e);
        }
    }

    async function loadBookmarks() {
        if (!api) return;
        isLoading = true;
        currentPage = 0;
        hasMore = true;
        
        try {
            const data = await api.profile.getBookmarks({
                id: profileId,
                type: activeStatus,
                page: 0,
                sort: 1
            });
            bookmarks = data.content || [];
            hasMore = bookmarks.length >= 25;
        } catch (e) {
            console.error('Error loading bookmarks:', e);
            bookmarks = [];
        }
        isLoading = false;
    }

    async function loadMore() {
        if (!api || isLoadingMore || !hasMore) return;
        isLoadingMore = true;
        currentPage++;
        
        try {
            const data = await api.profile.getBookmarks({
                id: profileId,
                type: activeStatus,
                page: currentPage,
                sort: 1
            });
            const newItems = data.content || [];
            bookmarks = [...bookmarks, ...newItems];
            hasMore = newItems.length >= 25;
        } catch (e) {
            console.error('Error loading more:', e);
            hasMore = false;
        }
        isLoadingMore = false;
    }

    function switchStatus(status) {
        if (status === activeStatus) return;
        activeStatus = status;
        loadBookmarks();
    }
</script>

<svelte:head>
    <title>Закладки {profile?.login || ''} - AniShika</title>
</svelte:head>

<div class="bookmarks-page">
    <div class="page-header">
        <a href="/profile/{profileId}" class="back-link">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            {profile?.login || 'Профиль'}
        </a>
        <h1>Закладки</h1>
    </div>

    <div class="status-tabs">
        {#each statuses as status}
            <button 
                class="status-tab" 
                class:active={activeStatus === status.id}
                style="--status-color: {status.color}"
                on:click={() => switchStatus(status.id)}
            >
                {status.name}
            </button>
        {/each}
    </div>

    <div class="bookmarks-content">
        {#if isLoading}
            <Preloader size="large" />
        {:else if bookmarks.length === 0}
            <div class="empty-state">
                <p>Нет аниме в этой категории</p>
            </div>
        {:else}
            <div class="bookmarks-grid">
                {#each bookmarks as anime (anime.id)}
                    <AnimeCard {anime} type="grid" />
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
    .bookmarks-page {
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

    .status-tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 24px;
        flex-wrap: wrap;
    }

    .status-tab {
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        background: var(--alt-background-color);
        color: var(--secondary-text-color);
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .status-tab.active {
        background: var(--status-color);
        color: white;
    }

    .status-tab:hover:not(.active) {
        background: var(--background-color);
    }

    .bookmarks-content {
        max-width: 1400px;
    }

    .bookmarks-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 20px;
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
        .bookmarks-page {
            padding: 16px;
        }

        .bookmarks-grid {
            grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
            gap: 12px;
        }

        .status-tabs {
            overflow-x: auto;
            flex-wrap: nowrap;
            padding-bottom: 8px;
        }

        .status-tab {
            flex-shrink: 0;
        }
    }
</style>
