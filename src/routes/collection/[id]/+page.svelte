<script>
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { getApi } from '$lib/api';
    import Preloader from '$lib/components/Preloader.svelte';
    import AnimeCard from '$lib/components/AnimeCard.svelte';

    $: collectionId = $page.params.id;

    let collection = null;
    let releases = [];
    let isLoading = true;
    let error = null;
    let api = null;

    onMount(async () => {
        if (browser) {
            api = getApi();
            await loadCollection();
        }
    });

    async function loadCollection() {
        if (!api) return;
        isLoading = true;
        error = null;
        try {
            const data = await api.collection.info(collectionId);
            console.log('Collection data:', data);
            if (data.collection) {
                collection = data.collection;
                // Load releases separately
                await loadReleases();
            } else {
                error = 'Коллекция не найдена';
            }
        } catch (e) {
            console.error('Error loading collection:', e);
            error = 'Ошибка загрузки коллекции';
        }
        isLoading = false;
    }

    async function loadReleases() {
        try {
            const releasesData = await api.collection.getCollectionReleases(collectionId, 0);
            console.log('Collection releases:', releasesData);
            releases = releasesData.content || [];
        } catch (e) {
            console.error('Error loading collection releases:', e);
            releases = [];
        }
    }
</script>

<svelte:head>
    <title>{collection?.title || 'Коллекция'} - AniShika</title>
</svelte:head>

<div class="collection-page">
    {#if isLoading}
        <Preloader size="large" />
    {:else if error}
        <div class="error-state">
            <h2>😔 {error}</h2>
            <a href="/collections" class="back-btn">Назад к коллекциям</a>
        </div>
    {:else if collection}
        <div class="collection-header">
            {#if collection.image}
                <div class="collection-cover">
                    <img src={collection.image} alt={collection.title} />
                    <div class="cover-overlay"></div>
                </div>
            {/if}
            <div class="collection-info">
                <h1 class="collection-title">{collection.title}</h1>
                {#if collection.description}
                    <p class="collection-description">{collection.description}</p>
                {/if}
                <div class="collection-meta">
                    <span class="meta-item">{releases.length} релизов</span>
                    {#if collection.creator}
                        <span class="meta-item">от {collection.creator.login}</span>
                    {/if}
                </div>
            </div>
        </div>

        <div class="collection-releases">
            <h2>Релизы в коллекции</h2>
            {#if releases.length === 0}
                <div class="empty-state">
                    <p>В этой коллекции пока нет релизов</p>
                </div>
            {:else}
                <div class="releases-list">
                    {#each releases as anime (anime.id)}
                        <AnimeCard {anime} type="full-row" />
                    {/each}
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .collection-page {
        width: 100%;
        min-height: 100%;
    }

    .collection-header {
        position: relative;
        padding: 40px 20px;
        background-color: var(--alt-background-color);
        margin-bottom: 20px;
    }

    .collection-cover {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        overflow: hidden;
    }

    .collection-cover img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        filter: blur(20px);
        opacity: 0.3;
    }

    .cover-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(transparent, var(--background-color));
    }

    .collection-info {
        position: relative;
        z-index: 1;
        max-width: 800px;
    }

    .collection-title {
        font-size: 32px;
        font-weight: bold;
        margin: 0 0 16px;
        color: var(--text-color);
    }

    .collection-description {
        font-size: 15px;
        line-height: 1.6;
        color: var(--secondary-text-color);
        margin: 0 0 16px;
    }

    .collection-meta {
        display: flex;
        gap: 16px;
        font-size: 14px;
        color: var(--secondary-text-color);
    }

    .collection-releases {
        padding: 0 20px 20px;
    }

    .collection-releases h2 {
        font-size: 20px;
        margin: 0 0 16px;
        color: var(--text-color);
    }

    .releases-list {
        display: flex;
        flex-direction: column;
    }

    .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        text-align: center;
    }

    .error-state h2 {
        color: var(--secondary-text-color);
        margin-bottom: 20px;
    }

    .back-btn {
        padding: 12px 24px;
        background: var(--primary-color);
        color: white;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 500;
    }

    .empty-state {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 40px;
        color: var(--secondary-text-color);
    }

    @media (max-width: 768px) {
        .collection-header {
            padding: 30px 16px;
        }

        .collection-title {
            font-size: 24px;
        }

        .collection-releases {
            padding: 0 12px 12px;
        }
    }
</style>
