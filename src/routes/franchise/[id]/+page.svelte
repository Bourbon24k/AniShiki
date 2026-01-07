<script>
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { getApi } from '$lib/api';
    import Preloader from '$lib/components/Preloader.svelte';
    import AnimeCard from '$lib/components/AnimeCard.svelte';

    $: franchiseId = $page.params.id;

    let franchise = null;
    let releases = [];
    let isLoading = true;
    let currentPage = 0;
    let isLoadingMore = false;
    let hasMore = true;
    let api = null;

    onMount(async () => {
        if (browser) {
            api = getApi();
            await loadFranchise();
        }
    });

    async function loadFranchise() {
        if (!api) return;
        isLoading = true;
        try {
            const data = await api.release.getRelatedReleases(franchiseId, 0);
            releases = data.content || [];
            
            if (data.related && (data.related.name_ru || data.related.title_ru)) {
                franchise = data.related;
            } else if (releases.length > 0) {
                franchise = {
                    id: franchiseId,
                    name_ru: releases[0].title_ru,
                    name: releases[0].title_original,
                    description: releases[0].description,
                    image: releases[0].image
                };
            } else {
                franchise = { id: franchiseId, name_ru: 'Франшиза' };
            }
            
            hasMore = releases.length >= 25;
        } catch (e) {
            console.error('Error loading franchise:', e);
        }
        isLoading = false;
    }

    async function loadMore() {
        if (!api || isLoadingMore || !hasMore) return;
        isLoadingMore = true;
        currentPage++;
        try {
            const data = await api.release.getRelatedReleases(franchiseId, currentPage);
            const newReleases = data.content || [];
            releases = [...releases, ...newReleases];
            hasMore = newReleases.length >= 25;
        } catch (e) {
            console.error('Error loading more:', e);
        }
        isLoadingMore = false;
    }

    function handleScroll(e) {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollHeight - scrollTop - clientHeight < 500 && !isLoadingMore && hasMore) {
            loadMore();
        }
    }
</script>

<svelte:head>
    <title>{franchise?.name_ru || 'Франшиза'} - AniShika</title>
</svelte:head>

<div class="franchise-page" on:scroll={handleScroll}>
    {#if isLoading}
        <Preloader size="large" />
    {:else}
        <div class="franchise-header">
            {#if franchise?.image}
                <img src={franchise.image} alt={franchise.name_ru} class="franchise-cover" />
            {/if}
            <div class="franchise-info">
                <h1>{franchise?.name_ru || franchise?.name || 'Франшиза'}</h1>
                {#if franchise?.description}
                    <p class="franchise-desc">{franchise.description}</p>
                {/if}
                <span class="releases-count">{releases.length} релизов</span>
            </div>
        </div>

        <div class="releases-list">
            {#each releases as anime (anime.id)}
                <AnimeCard {anime} type="full-row" />
            {/each}

            {#if isLoadingMore}
                <Preloader size="small" />
            {/if}
        </div>
    {/if}
</div>

<style>
    .franchise-page {
        width: 100%;
        height: 100%;
        overflow-y: auto;
        padding: 20px;
    }

    .franchise-header {
        margin-bottom: 30px;
    }

    .franchise-cover {
        width: 100%;
        max-height: 300px;
        object-fit: cover;
        border-radius: 16px;
        margin-bottom: 20px;
    }

    .franchise-info h1 {
        font-size: 28px;
        font-weight: 700;
        margin: 0 0 12px;
        color: var(--text-color);
    }

    .franchise-desc {
        font-size: 15px;
        color: var(--secondary-text-color);
        line-height: 1.6;
        margin: 0 0 12px;
    }

    .releases-count {
        font-size: 14px;
        color: var(--secondary-text-color);
    }

    .releases-list {
        display: flex;
        flex-direction: column;
    }

    @media (max-width: 768px) {
        .franchise-page {
            padding: 16px;
        }

        .franchise-info h1 {
            font-size: 22px;
        }

        .franchise-cover {
            max-height: 200px;
        }
    }
</style>
