<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { getApi } from '$lib/api';
    import { collectionSortValues } from '$lib/utils';
    import Preloader from '$lib/components/Preloader.svelte';

    let collections = [];
    let isLoading = true;
    let page = 0;
    let selectedSort = 4; // Default to "Popular this week" like original
    let isLoadingMore = false;
    let api = null;

    onMount(async () => {
        if (browser) {
            api = getApi();
            await loadCollections();
        }
    });

    async function loadCollections() {
        if (!api) return;
        isLoading = true;
        page = 0;
        try {
            console.log('Loading collections with sort:', selectedSort, 'page:', page);
            const data = await api.collection.all(page, selectedSort);
            console.log('Collections response:', data);
            collections = data.content || [];
        } catch (e) {
            console.error('Error loading collections:', e);
        }
        isLoading = false;
    }

    async function loadMore() {
        if (!api || isLoadingMore) return;
        isLoadingMore = true;
        page++;
        try {
            const data = await api.collection.all(page, selectedSort);
            collections = [...collections, ...(data.content || [])];
        } catch (e) {
            console.error('Error loading more:', e);
        }
        isLoadingMore = false;
    }

    function setSort(sort) {
        if (selectedSort === sort) return;
        selectedSort = sort;
        loadCollections();
    }

    function handleScroll(e) {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollHeight - scrollTop - clientHeight < 500 && !isLoadingMore) {
            loadMore();
        }
    }
</script>

<svelte:head>
    <title>Коллекции - AniShika</title>
</svelte:head>

<div class="collections-page" on:scroll={handleScroll}>
    <div class="collections-header">
        <h1>Коллекции</h1>
        <div class="sort-wrapper">
            <select 
                class="sort-select"
                bind:value={selectedSort}
                on:change={(e) => setSort(parseInt(/** @type {HTMLSelectElement} */ (e.currentTarget).value))}
            >
                {#each collectionSortValues as option}
                    <option value={option.value}>{option.label}</option>
                {/each}
            </select>
        </div>
    </div>

    <div class="collections-content">
        {#if isLoading}
            <Preloader size="large" />
        {:else if collections.length === 0}
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
                    <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/>
                </svg>
                <p>Коллекции не найдены</p>
            </div>
        {:else}
            <div class="collections-list">
                {#each collections as collection (collection.id)}
                    <a href="/collection/{collection.id}" class="collection-card">
                        <div class="collection-poster">
                            <img src={collection.image} alt={collection.title} />
                        </div>
                        <div class="collection-info">
                            <h3 class="collection-title">{collection.title}</h3>
                            <div class="collection-stats">
                                <span class="stat">
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                                        <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
                                    </svg>
                                    {collection.favorites_count || 0}
                                </span>
                                <span class="stat">
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                                        <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"/>
                                    </svg>
                                    {collection.comment_count || 0}
                                </span>
                            </div>
                            {#if collection.description}
                                <p class="collection-description">
                                    {collection.description.length > 200 ? collection.description.slice(0, 200) + '...' : collection.description}
                                </p>
                            {/if}
                            {#if collection.creator}
                                <p class="collection-author">
                                    от {collection.creator.login}
                                </p>
                            {/if}
                        </div>
                    </a>
                {/each}
            </div>
            
            {#if isLoadingMore}
                <Preloader size="small" />
            {/if}
        {/if}
    </div>
</div>

<style>
    .collections-page {
        width: 100%;
        height: 100%;
        overflow-y: auto;
    }

    .collections-header {
        position: sticky;
        top: 0;
        background-color: var(--background-color);
        z-index: 10;
        padding: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .collections-header h1 {
        font-size: 24px;
        margin: 0;
        color: var(--text-color);
    }

    .sort-select {
        padding: 10px 14px;
        font-size: 13px;
        border: none;
        border-radius: 8px;
        background-color: var(--alt-background-color);
        color: var(--text-color);
        cursor: pointer;
    }

    .collections-content {
        padding: 0 20px 20px;
    }

    .collections-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .collection-card {
        display: flex;
        gap: 20px;
        padding: 16px;
        background-color: var(--alt-background-color);
        border-radius: 16px;
        text-decoration: none;
        color: inherit;
        transition: background-color 0.2s;
    }

    .collection-card:hover {
        background-color: var(--background-color);
        filter: brightness(1.1);
    }

    .collection-poster {
        flex-shrink: 0;
        width: 200px;
        height: 112px;
        border-radius: 12px;
        overflow: hidden;
    }

    .collection-poster img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .collection-info {
        flex: 1;
        min-width: 0;
    }

    .collection-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 8px;
        color: var(--text-color);
    }

    .collection-stats {
        display: flex;
        gap: 16px;
        margin-bottom: 8px;
    }

    .collection-stats .stat {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 13px;
        color: var(--secondary-text-color);
    }

    .collection-stats .stat svg {
        opacity: 0.7;
    }

    .collection-description {
        font-size: 14px;
        color: var(--secondary-text-color);
        margin: 0 0 8px;
        line-height: 1.4;
    }

    .collection-author {
        font-size: 12px;
        color: var(--secondary-text-color);
        margin: 0;
        opacity: 0.7;
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
        .collections-header {
            padding: 16px;
            flex-direction: column;
            gap: 12px;
            align-items: flex-start;
        }

        .collections-header h1 {
            font-size: 20px;
        }

        .collections-content {
            padding: 0 12px 12px;
        }

        .collections-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
