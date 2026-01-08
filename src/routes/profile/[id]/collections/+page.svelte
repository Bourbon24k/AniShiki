<script>
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { getApi } from '$lib/api';
    import Preloader from '$lib/components/Preloader.svelte';

    $: profileId = $page.params.id;

    let api = null;
    let profile = null;
    let collections = [];
    let isLoading = true;
    let isLoadingMore = false;
    let hasMore = true;
    let currentPage = 0;
    let loadedProfileId = null;

    onMount(async () => {
        if (browser) {
            api = getApi();
            await loadAll();
        }
    });

    $: if (browser && api && profileId && loadedProfileId !== profileId) {
        loadAll();
    }

    async function loadAll() {
        if (!api) return;
        const id = Number(profileId);
        if (!Number.isFinite(id)) return;

        loadedProfileId = profileId;
        isLoading = true;
        isLoadingMore = false;
        hasMore = true;
        currentPage = 0;
        collections = [];

        try {
            const data = await api.profile.info(id);
            profile = data.profile;
        } catch (e) {
            console.error('Error loading profile:', e);
            profile = null;
        }

        try {
            const data = await api.collection.getUserCollections(id, 0);
            collections = data.content || [];
            hasMore = (data.content || []).length >= 25;
        } catch (e) {
            console.error('Error loading collections:', e);
            collections = [];
            hasMore = false;
        }

        isLoading = false;
    }

    async function loadMore() {
        if (!api || isLoadingMore || !hasMore) return;
        const id = Number(profileId);
        if (!Number.isFinite(id)) return;

        isLoadingMore = true;
        currentPage += 1;

        try {
            const data = await api.collection.getUserCollections(id, currentPage);
            const next = data.content || [];
            collections = [...collections, ...next];
            hasMore = next.length >= 25;
        } catch (e) {
            console.error('Error loading more collections:', e);
            hasMore = false;
        }

        isLoadingMore = false;
    }

    function handleScroll(e) {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollHeight - scrollTop - clientHeight < 500) {
            loadMore();
        }
    }
</script>

<svelte:head>
    <title>Коллекции {profile?.login || ''} - AniShika</title>
</svelte:head>

<div class="profile-collections-page" on:scroll={handleScroll}>
    <div class="page-header">
        <a href="/profile/{profileId}" class="back-link">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            {profile?.login || 'Профиль'}
        </a>
        <h1>Коллекции</h1>
    </div>

    {#if isLoading}
        <Preloader size="large" />
    {:else if collections.length === 0}
        <div class="empty-state">
            <p>Коллекций нет</p>
        </div>
    {:else}
        <div class="collections-list">
            {#each collections as c (c.id)}
                <a href="/collection/{c.id}" class="collection-card">
                    <img src={c.image} alt={c.title} class="collection-cover" loading="lazy" />
                    <div class="collection-meta">
                        <div class="collection-title">{c.title}</div>
                        <div class="collection-sub">В избранном {c.favorites_count || 0} • Комментарии {c.comment_count || 0}</div>
                    </div>
                </a>
            {/each}

            {#if isLoadingMore}
                <Preloader size="small" />
            {/if}
        </div>
    {/if}
</div>

<style>
    .profile-collections-page {
        width: 100%;
        height: 100%;
        overflow-y: auto;
        padding: 20px;
    }

    .page-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 24px;
        flex-wrap: wrap;
    }

    .back-link {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--secondary-text-color);
        text-decoration: none;
        font-size: 14px;
    }

    .page-header h1 {
        margin: 0;
        font-size: 24px;
        color: var(--text-color);
    }

    .collections-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 900px;
    }

    .collection-card {
        display: flex;
        gap: 14px;
        padding: 14px;
        background: var(--alt-background-color);
        border-radius: 14px;
        text-decoration: none;
        color: inherit;
        align-items: center;
    }

    .collection-cover {
        width: 120px;
        height: 68px;
        border-radius: 10px;
        object-fit: cover;
        flex-shrink: 0;
        background: var(--background-color);
    }

    .collection-title {
        font-size: 15px;
        font-weight: 700;
        color: var(--text-color);
        margin-bottom: 4px;
    }

    .collection-sub {
        font-size: 12px;
        color: var(--secondary-text-color);
    }

    .empty-state {
        padding: 40px 0;
        color: var(--secondary-text-color);
    }

    @media (max-width: 768px) {
        .profile-collections-page {
            padding: 12px;
        }

        .collection-cover {
            width: 100px;
            height: 56px;
        }
    }
</style>
