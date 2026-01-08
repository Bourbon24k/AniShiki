<script>
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { getApi } from '$lib/api';
    import Preloader from '$lib/components/Preloader.svelte';

    $: profileId = $page.params.id;

    let profile = null;
    let votes = [];
    let isLoading = true;
    let isLoadingMore = false;
    let hasMore = true;
    let currentPage = 0;
    let api = null;
    let loadedProfileId = null;

    function toDate(ts) {
        const n = Number(ts);
        if (!Number.isFinite(n) || n <= 0) return null;
        return new Date(n > 10_000_000_000 ? n : n * 1000);
    }

    function getVoteDate(item) {
        return (
            toDate(item?.timestamp) ||
            toDate(item?.creation_date) ||
            toDate(item?.created_at) ||
            toDate(item?.last_update_date) ||
            null
        );
    }

    onMount(async () => {
        if (browser) {
            api = getApi();
            await loadProfile();
            await loadVotes();
        }
    });

    $: if (browser && api && profileId && loadedProfileId !== profileId) {
        loadProfile();
        loadVotes();
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

    async function loadVotes() {
        if (!api) return;
        const id = Number(profileId);
        if (!Number.isFinite(id)) return;

        isLoading = true;
        currentPage = 0;
        
        try {
            const data = await api.profile.getVotedReleases(id, 0);
            votes = data.content || [];
            hasMore = votes.length >= 25;
        } catch (e) {
            console.error('Error loading votes:', e);
            votes = [];
        }
        isLoading = false;
    }

    async function loadMore() {
        if (!api || isLoadingMore || !hasMore) return;
        const id = Number(profileId);
        if (!Number.isFinite(id)) return;

        isLoadingMore = true;
        currentPage++;
        
        try {
            const data = await api.profile.getVotedReleases(id, currentPage);
            const newItems = data.content || [];
            votes = [...votes, ...newItems];
            hasMore = newItems.length >= 25;
        } catch (e) {
            console.error('Error loading more:', e);
            hasMore = false;
        }
        isLoadingMore = false;
    }
</script>

<svelte:head>
    <title>Оценки {profile?.login || ''} - AniShika</title>
</svelte:head>

<div class="votes-page">
    <div class="page-header">
        <a href="/profile/{profileId}" class="back-link">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            {profile?.login || 'Профиль'}
        </a>
        <h1>Оценки релизов</h1>
    </div>

    <div class="votes-content">
        {#if isLoading}
            <Preloader size="large" />
        {:else if votes.length === 0}
            <div class="empty-state">
                <p>Нет оценённых релизов</p>
            </div>
        {:else}
            <div class="votes-grid">
                {#each votes as item (item.release?.id || item.id)}
                    {@const voteDate = getVoteDate(item)}
                    <a href="/release/{item.release?.id || item.id}" class="vote-card">
                        <img src={item.release?.image || item.image} alt="" class="vote-poster" />
                        <div class="vote-badge">
                            <span class="vote-score">★ {item.my_vote || item.vote || 0}</span>
                        </div>
                        <div class="vote-info">
                            <span class="vote-title">{item.release?.title_ru || item.title_ru}</span>
                            {#if item.release?.description || item.description}
                                <span class="vote-desc">{(item.release?.description || item.description).slice(0, 90)}{(item.release?.description || item.description).length > 90 ? '...' : ''}</span>
                            {/if}
                            {#if voteDate}
                                <span class="vote-date">{voteDate.toLocaleDateString('ru-RU')}</span>
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
    .votes-page {
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

    .votes-content {
        max-width: 1400px;
    }

    .votes-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 20px;
    }

    .vote-card {
        text-decoration: none;
        color: inherit;
        position: relative;
    }

    .vote-poster {
        width: 100%;
        aspect-ratio: 2/3;
        object-fit: cover;
        border-radius: 12px;
        margin-bottom: 8px;
    }

    .vote-badge {
        position: absolute;
        top: 8px;
        left: 8px;
    }

    .vote-score {
        background: rgba(0,0,0,0.8);
        color: #ffc107;
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
    }

    .vote-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .vote-title {
        font-size: 13px;
        color: var(--text-color);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .vote-date {
        font-size: 11px;
        color: var(--secondary-text-color);
    }

    .vote-desc {
        font-size: 11px;
        color: var(--secondary-text-color);
        opacity: 0.9;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
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
        .votes-page {
            padding: 16px;
        }

        .votes-grid {
            grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
            gap: 12px;
        }
    }
</style>
