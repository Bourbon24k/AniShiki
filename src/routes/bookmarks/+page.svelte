<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { getApi } from '$lib/api';
    import { userToken } from '$lib/stores';
    import { bookmarkSortValues } from '$lib/utils';
    import Preloader from '$lib/components/Preloader.svelte';
    import AnimeCard from '$lib/components/AnimeCard.svelte';

    $: utoken = $userToken;

    let selectedType = 1;
    let selectedSort = 1;
    let page = 0;
    let allData = [];
    let isLoading = true;
    let isLoadingMore = false;
    let api = null;

    const bookmarkTypes = [
        { id: 0, label: 'Избранное', color: 'var(--primary-color)' },
        { id: 1, label: 'Смотрю', color: 'var(--watching-color)' },
        { id: 2, label: 'В планах', color: 'var(--plan-color)' },
        { id: 3, label: 'Просмотрено', color: 'var(--completed-color)' },
        { id: 4, label: 'Отложено', color: 'var(--hold-on-color)' },
        { id: 5, label: 'Брошено', color: 'var(--dropped-color)' }
    ];

    let totalCount = 0;

    onMount(async () => {
        if (browser) {
            if (!utoken) {
                goto('/login');
                return;
            }
            api = getApi();
            await loadBookmarks();
        }
    });

    async function loadBookmarks() {
        if (!api || !utoken) return;
        isLoading = true;
        page = 0;
        allData = [];
        try {
            let data;
            if (selectedType === 0) {
                // Favorites
                data = await api.profile.getFavorites({
                    page: page,
                    sort: selectedSort,
                    filter_announce: 0
                });
            } else {
                // Bookmarks by type
                data = await api.profile.getBookmarks({
                    type: selectedType,
                    id: null,
                    sort: selectedSort,
                    page: page
                });
            }
            console.log('Bookmarks response:', data);
            allData = data.content || [];
            totalCount = data.total_count || 0;
        } catch (e) {
            console.error('Error loading bookmarks:', e);
        }
        isLoading = false;
    }

    async function loadMore() {
        if (!api || isLoadingMore) return;
        isLoadingMore = true;
        page++;
        try {
            let data;
            if (selectedType === 0) {
                data = await api.profile.getFavorites({
                    page: page,
                    sort: selectedSort,
                    filter_announce: 0
                });
            } else {
                data = await api.profile.getBookmarks({
                    type: selectedType,
                    id: null,
                    sort: selectedSort,
                    page: page
                });
            }
            allData = [...allData, ...(data.content || [])];
        } catch (e) {
            console.error('Error loading more:', e);
        }
        isLoadingMore = false;
    }

    function setType(type) {
        if (selectedType === type) return;
        selectedType = type;
        loadBookmarks();
    }

    function setSort(sort) {
        if (selectedSort === sort) return;
        selectedSort = sort;
        loadBookmarks();
    }

    function handleScroll(e) {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollHeight - scrollTop - clientHeight < 500 && !isLoadingMore) {
            loadMore();
        }
    }
</script>

<svelte:head>
    <title>Закладки - AniShika</title>
</svelte:head>

<div class="bookmarks-page" on:scroll={handleScroll}>
    <div class="bookmarks-header">
        <div class="type-tabs">
            {#each bookmarkTypes as type}
                <button
                    class="type-tab"
                    class:selected={selectedType === type.id}
                    style="--tab-color: {type.color}"
                    on:click={() => setType(type.id)}
                >
                    {type.label}
                </button>
            {/each}
        </div>
        
        <div class="sort-select-wrapper">
            <select 
                class="sort-select"
                bind:value={selectedSort}
                on:change={(e) => setSort(parseInt(e.target.value))}
            >
                {#each bookmarkSortValues as option}
                    <option value={option.value}>{option.label}</option>
                {/each}
            </select>
        </div>
    </div>

    <div class="bookmarks-content">
        {#if isLoading}
            <Preloader size="large" />
        {:else if allData.length === 0}
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
                    <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
                </svg>
                <p>В этой категории пока ничего нет</p>
            </div>
        {:else}
            {#each allData as anime (anime.id)}
                <AnimeCard {anime} type="full-row" />
            {/each}
            
            {#if isLoadingMore}
                <Preloader size="small" />
            {/if}
        {/if}
    </div>
</div>

<style>
    .bookmarks-page {
        width: 100%;
        height: 100%;
        overflow-y: auto;
    }

    .bookmarks-header {
        position: sticky;
        top: 0;
        background-color: var(--background-color);
        z-index: 10;
        padding: 16px 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .type-tabs {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding-bottom: 4px;
    }

    .type-tabs::-webkit-scrollbar {
        display: none;
    }

    .type-tab {
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        background-color: var(--alt-background-color);
        color: var(--secondary-text-color);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
    }

    .type-tab:hover {
        background-color: var(--alt-background-color);
        filter: brightness(1.2);
    }

    .type-tab.selected {
        background-color: var(--tab-color);
        color: white;
    }

    .sort-select-wrapper {
        display: flex;
        justify-content: flex-end;
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

    .bookmarks-content {
        display: flex;
        flex-direction: column;
        padding-bottom: 20px;
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
        .bookmarks-header {
            padding: 12px;
        }

        .type-tab {
            padding: 8px 14px;
            font-size: 13px;
        }
    }
</style>
