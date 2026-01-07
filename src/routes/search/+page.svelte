<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { getApi } from '$lib/api';
    import Preloader from '$lib/components/Preloader.svelte';
    import AnimeCard from '$lib/components/AnimeCard.svelte';

    let searchQuery = '';
    let genreQuery = '';
    let studioQuery = '';
    let filterType = '';
    let results = [];
    let franchises = [];
    let isLoading = false;
    let isLoadingMore = false;
    let hasSearched = false;
    let hasMore = true;
    let currentPage = 0;
    let api = null;
    let searchTimeout;
    let isLoadingFranchise = false;
    let expandedFranchises = {};
    let franchiseReleases = {};

    $: queryParam = $page.url.searchParams.get('q') || '';
    $: genreParam = $page.url.searchParams.get('genre') || '';
    $: studioParam = $page.url.searchParams.get('studio') || '';

    onMount(() => {
        if (browser) {
            api = getApi();
            if (studioParam) {
                studioQuery = studioParam;
                filterType = 'studio';
                searchByStudio();
            } else if (genreParam) {
                genreQuery = genreParam;
                filterType = 'genre';
                searchByGenre();
            } else if (queryParam) {
                searchQuery = queryParam;
                filterType = 'text';
                performSearch();
            }
        }
    });

    async function searchByGenre() {
        if (!api || !genreQuery) return;
        
        isLoading = true;
        hasSearched = true;
        
        try {
            const genreValue = isNaN(Number(genreQuery)) ? genreQuery : Number(genreQuery);
            const data = await api.release.filter(0, {
                genres: [genreValue]
            }, true);
            console.log('Genre filter result:', data);
            results = data.releases || data.content || [];
        } catch (e) {
            console.error('Genre filter error:', e);
            results = [];
        }
        
        isLoading = false;
    }

    async function searchByStudio() {
        if (!api || !studioQuery) return;
        
        isLoading = true;
        hasSearched = true;
        
        try {
            const studioValue = isNaN(Number(studioQuery)) ? studioQuery : Number(studioQuery);
            const data = await api.release.filter(0, {
                studios: [studioValue]
            }, true);
            console.log('Studio filter result:', data);
            results = data.releases || data.content || [];
        } catch (e) {
            console.error('Studio filter error:', e);
            results = [];
        }
        
        isLoading = false;
    }

    function handleInput(e) {
        searchQuery = e.target.value;
        clearTimeout(searchTimeout);
        
        if (searchQuery.length >= 2) {
            searchTimeout = setTimeout(() => {
                updateUrl();
                performSearch();
            }, 500);
        } else {
            results = [];
            hasSearched = false;
        }
    }

    function updateUrl() {
        if (searchQuery) {
            goto(`/search?q=${encodeURIComponent(searchQuery)}`, { replaceState: true, noScroll: true });
        } else {
            goto('/search', { replaceState: true, noScroll: true });
        }
    }

    async function searchFranchises(releasesForFallback = []) {
        if (!api || searchQuery.length < 2) {
            franchises = [];
            return;
        }

        isLoadingFranchise = true;
        try {
            // Some API builds may not support franchise search.
            if (api.search?.franchises) {
                const franchiseData = await api.search.franchises({
                    query: searchQuery,
                    page: 0
                });
                const found = (franchiseData.franchises || franchiseData.content || []);
                if (found.length > 0) {
                    franchises = found.slice(0, 3);
                    return;
                }
            }

            // Fallback: derive a single "featured" franchise from related releases.
            // This makes the UI work even when api.search.franchises is missing.
            await loadFranchiseFromReleases(releasesForFallback);
        } catch (e) {
            console.error('Franchise search error:', e);
            try {
                await loadFranchiseFromReleases(releasesForFallback);
            } catch (_) {
                franchises = [];
            }
        } finally {
            isLoadingFranchise = false;
        }
    }

    async function loadFranchiseFromReleases(releases) {
        if (!api || !Array.isArray(releases) || releases.length === 0) {
            franchises = [];
            return;
        }

        const candidates = releases.slice(0, 5).filter(r => r && r.id);
        const relatedResults = await Promise.all(
            candidates.map(async (release) => {
                try {
                    const data = await api.release.getRelatedReleases(release.id, 0);
                    return { base: release, franchise: data?.related || null, related: data?.content || [] };
                } catch (e) {
                    return null;
                }
            })
        );

        const best =
            relatedResults.find(r => r && r.related.length > 1) ||
            relatedResults.find(r => r && r.related.length > 0);

        if (!best) {
            franchises = [];
            return;
        }

        const posters = [best.base, ...best.related]
            .filter(x => x && x.image)
            .filter((x, idx, arr) => arr.findIndex(y => y.id === x.id) === idx)
            .slice(0, 3);

        const f = best.franchise || {};
        franchises = [
            {
                // NOTE: /franchise/[id] route expects a release id; it then loads franchise meta via getRelatedReleases(id)
                id: best.base.id,
                name_ru: f.name_ru || f.title_ru || best.base.title_ru,
                name: f.name || best.base.title_original,
                description: f.description || best.base.description,
                image: f.image || best.base.image,
                count: best.related.length + 1,
                releases: posters
            }
        ];
    }

    async function toggleFranchise(franchiseId) {
        if (expandedFranchises[franchiseId]) {
            expandedFranchises[franchiseId] = false;
            expandedFranchises = {...expandedFranchises};
            return;
        }

        if (!franchiseReleases[franchiseId]) {
            try {
                const data = await api.release.getRelatedReleases(franchiseId, 0);
                franchiseReleases[franchiseId] = data.content || [];
                franchiseReleases = {...franchiseReleases};
            } catch (e) {
                console.error('Error loading franchise releases:', e);
                return;
            }
        }

        expandedFranchises[franchiseId] = true;
        expandedFranchises = {...expandedFranchises};
    }

    async function performSearch() {
        if (!api || searchQuery.length < 2) return;
        
        isLoading = true;
        hasSearched = true;
        currentPage = 0;
        hasMore = true;
        franchises = [];
        expandedFranchises = {};
        franchiseReleases = {};
        
        try {
            const releasesData = await api.search.releases({
                query: searchQuery,
                searchBy: 0,
                page: 0
            });
            results = releasesData.releases || releasesData.content || [];

            await searchFranchises(results);
            hasMore = results.length >= 25;
        } catch (e) {
            console.error('Search error:', e);
            results = [];
            franchises = [];
        }
        
        isLoading = false;
    }

    async function loadMore() {
        if (!api || isLoadingMore || !hasMore) return;
        
        isLoadingMore = true;
        currentPage++;
        
        try {
            let data;
            if (genreQuery) {
                const genreValue = isNaN(Number(genreQuery)) ? genreQuery : Number(genreQuery);
                data = await api.release.filter(currentPage, { genres: [genreValue] }, true);
            } else if (studioQuery) {
                const studioValue = isNaN(Number(studioQuery)) ? studioQuery : Number(studioQuery);
                data = await api.release.filter(currentPage, { studios: [studioValue] }, true);
            } else {
                data = await api.search.releases({ query: searchQuery, searchBy: 0, page: currentPage });
            }
            
            const newResults = data.releases || data.content || [];
            results = [...results, ...newResults];
            hasMore = newResults.length >= 25;
        } catch (e) {
            console.error('Load more error:', e);
            hasMore = false;
        }
        
        isLoadingMore = false;
    }

    function handleSubmit(e) {
        e.preventDefault();
        clearTimeout(searchTimeout);
        if (searchQuery.length >= 2) {
            updateUrl();
            performSearch();
        }
    }

    function clearSearch() {
        searchQuery = '';
        results = [];
        hasSearched = false;
        goto('/search', { replaceState: true });
    }
</script>

<svelte:head>
    <title>Поиск{searchQuery ? `: ${searchQuery}` : ''}{genreQuery ? ` по жанру: ${genreQuery}` : ''}{studioQuery ? ` по студии: ${studioQuery}` : ''} - AniShika</title>
</svelte:head>

<div class="search-page">
    <form class="search-form" on:submit={handleSubmit}>
        <div class="search-input-wrapper">
            <svg class="search-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <input
                type="text"
                class="search-input"
                placeholder="Поиск аниме..."
                bind:value={searchQuery}
                on:input={handleInput}
            />
            {#if searchQuery}
                <button type="button" class="clear-btn" on:click={clearSearch} aria-label="Очистить поиск">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
            {/if}
        </div>
    </form>

    <div class="search-results">
        {#if isLoading}
            <Preloader />
        {:else if hasSearched && results.length === 0}
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
                    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <p>По запросу "{searchQuery}" ничего не найдено</p>
            </div>
        {:else if !hasSearched}
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
                    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <p>Введите название аниме для поиска</p>
            </div>
        {:else}
            <div class="results-header">
                {#if studioQuery}
                    <span>Студия: {studioQuery} • Найдено: {results.length}</span>
                {:else if genreQuery}
                    <span>Жанр: {genreQuery} • Найдено: {results.length}</span>
                {:else}
                    <span>Найдено: {results.length}</span>
                {/if}
            </div>
            {#if franchises.length > 0 && searchQuery && !genreQuery && !studioQuery}
                <div class="franchise-section">
                    <div class="franchise-section-title">Франшизы</div>
                    {#each franchises as franchise (franchise.id)}
                        <div class="franchise-card">
                            <div class="franchise-header-row">
                                <a href="/franchise/{franchise.id}" class="franchise-main">
                                    <div class="franchise-posters">
                                        {#if franchise.releases?.length > 0}
                                            {#each franchise.releases.slice(0, 3) as release, i}
                                                <img src={release.image} alt="" class="franchise-poster" style="z-index: {3 - i}" />
                                            {/each}
                                        {:else if franchise.image}
                                            <img src={franchise.image} alt="" class="franchise-poster" />
                                        {:else}
                                            <div class="franchise-poster-placeholder">
                                                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                                                    <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/>
                                                </svg>
                                            </div>
                                        {/if}
                                    </div>
                                    <div class="franchise-info">
                                        <h3 class="franchise-title">{franchise.name_ru || franchise.name}</h3>
                                        <span class="franchise-count">{franchise.count || franchise.releases?.length || 0} релизов</span>
                                        {#if franchise.description}
                                            <p class="franchise-desc">{franchise.description}</p>
                                        {/if}
                                    </div>
                                </a>
                                <button 
                                    class="franchise-expand-btn" 
                                    on:click={() => toggleFranchise(franchise.id)}
                                    aria-label="{expandedFranchises[franchise.id] ? 'Скрыть' : 'Показать'} все релизы"
                                >
                                    <svg viewBox="0 0 24 24" fill="currentColor" class="expand-icon" class:expanded={expandedFranchises[franchise.id]}>
                                        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                                    </svg>
                                    <span>{expandedFranchises[franchise.id] ? 'Скрыть' : 'Показать все'}</span>
                                </button>
                            </div>
                            {#if expandedFranchises[franchise.id] && franchiseReleases[franchise.id]}
                                <div class="franchise-releases-list">
                                    {#each franchiseReleases[franchise.id] as release (release.id)}
                                        <AnimeCard anime={release} type="full-row" />
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}

            <div class="results-list">
                {#each results as anime (anime.id)}
                    <AnimeCard {anime} type="full-row" />
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
    .search-page {
        width: 100%;
        min-height: 100%;
        padding: 20px;
    }

    .search-form {
        max-width: 700px;
        margin: 0 auto 30px;
    }

    .search-input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
    }

    .search-icon {
        position: absolute;
        left: 16px;
        width: 24px;
        height: 24px;
        color: var(--secondary-text-color);
        pointer-events: none;
    }

    .search-input {
        width: 100%;
        padding: 16px 50px 16px 50px;
        font-size: 16px;
        border: none;
        border-radius: 12px;
        background-color: var(--alt-background-color);
        color: var(--text-color);
        outline: none;
        transition: box-shadow 0.2s;
    }

    .search-input:focus {
        box-shadow: 0 0 0 2px var(--primary-color);
    }

    .search-input::placeholder {
        color: var(--secondary-text-color);
    }

    .clear-btn {
        position: absolute;
        right: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: transparent;
        color: var(--secondary-text-color);
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .clear-btn:hover {
        background-color: var(--background-color);
    }

    .clear-btn svg {
        width: 20px;
        height: 20px;
    }

    .search-results {
        max-width: 1200px;
        margin: 0 auto;
    }

    .results-header {
        padding: 0 20px 15px;
        color: var(--secondary-text-color);
        font-size: 14px;
    }

    .results-list {
        display: flex;
        flex-direction: column;
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
        font-size: 16px;
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
        transition: all 0.2s;
    }

    .load-more-btn:hover {
        filter: brightness(1.1);
    }

    .franchise-section {
        margin-bottom: 24px;
    }

    .franchise-section-title {
        font-size: 18px;
        font-weight: 700;
        margin-bottom: 12px;
        color: var(--text-color);
        padding: 0 4px;
    }

    .franchise-card {
        background: var(--alt-background-color);
        border-radius: 12px;
        margin-bottom: 12px;
        overflow: hidden;
    }

    .franchise-header-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
    }

    .franchise-main {
        display: flex;
        gap: 16px;
        flex: 1;
        text-decoration: none;
        color: inherit;
        transition: opacity 0.2s;
        min-width: 0;
    }

    .franchise-main:hover {
        opacity: 0.8;
    }

    .franchise-info {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
        flex: 1;
    }

    .franchise-expand-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        background: var(--background-color);
        border: none;
        border-radius: 8px;
        color: var(--text-color);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        flex-shrink: 0;
    }

    .franchise-expand-btn:hover {
        background: var(--primary-color);
        color: white;
    }

    .expand-icon {
        width: 20px;
        height: 20px;
        transition: transform 0.2s;
    }

    .expand-icon.expanded {
        transform: rotate(180deg);
    }

    .franchise-releases-list {
        border-top: 1px solid var(--background-color);
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .franchise-posters {
        position: relative;
        width: 100px;
        height: 130px;
        flex-shrink: 0;
    }

    .franchise-poster {
        position: absolute;
        width: 65px;
        height: 95px;
        object-fit: cover;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }

    .franchise-poster:nth-child(1) {
        top: 0;
        left: 0;
    }

    .franchise-poster:nth-child(2) {
        top: 15px;
        left: 18px;
    }

    .franchise-poster:nth-child(3) {
        top: 30px;
        left: 36px;
    }

    .franchise-poster-placeholder {
        width: 65px;
        height: 95px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--background-color);
        border-radius: 6px;
        color: var(--secondary-text-color);
    }

    .franchise-title {
        font-size: 16px;
        font-weight: 600;
        margin: 0;
        color: var(--text-color);
    }

    .franchise-count {
        font-size: 12px;
        color: var(--primary-color);
    }

    .franchise-desc {
        font-size: 13px;
        color: var(--secondary-text-color);
        margin: 0;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    @media (max-width: 768px) {
        .search-page {
            padding: 12px;
        }

        .search-form {
            margin-bottom: 20px;
        }

        .search-input {
            padding: 14px 45px 14px 45px;
            font-size: 15px;
        }

        .franchise-header-row {
            flex-direction: column;
            align-items: stretch;
        }

        .franchise-expand-btn {
            width: 100%;
            justify-content: center;
        }

        .franchise-posters {
            width: 90px;
            height: 120px;
        }

        .franchise-poster {
            width: 60px;
            height: 85px;
        }
    }
</style>
