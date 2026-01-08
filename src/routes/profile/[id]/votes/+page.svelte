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
        if (ts === null || ts === undefined) return null;
        if (ts instanceof Date) return Number.isNaN(ts.getTime()) ? null : ts;

        // Accept numeric strings, seconds/ms, and ISO date strings.
        if (typeof ts === 'string') {
            const s = ts.trim();
            if (!s) return null;

            // Numeric string
            if (/^\d+$/.test(s)) {
                const n = Number(s);
                if (!Number.isFinite(n) || n <= 0) return null;
                return new Date(n > 10_000_000_000 ? n : n * 1000);
            }

            const d = new Date(s);
            return Number.isNaN(d.getTime()) ? null : d;
        }

        const n = Number(ts);
        if (!Number.isFinite(n) || n <= 0) return null;
        const d = new Date(n > 10_000_000_000 ? n : n * 1000);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    function getVoteDate(item) {
        const releaseTs =
            item?.release?.timestamp ??
            item?.release?.creation_date ??
            item?.release?.created_at ??
            null;

        const releaseLastUpdateTs = item?.release?.last_update_date ?? null;

        const releaseMs = releaseTs != null ? toDate(releaseTs)?.getTime() ?? null : null;
        const releaseLastUpdateMs =
            releaseLastUpdateTs != null ? toDate(releaseLastUpdateTs)?.getTime() ?? null : null;

        const voteCandidates = [
            item?.vote_timestamp,
            item?.vote_date,
            item?.my_vote_timestamp,
            item?.my_vote_date,
            item?.user_vote_timestamp,
            item?.user_vote_date,
            item?.vote?.timestamp,
            item?.vote?.created_at
        ];

        for (const ts of voteCandidates) {
            if (ts == null) continue;
            const d = toDate(ts);
            if (!d) continue;
            return d;
        }

        const fallbackCandidates = [item?.timestamp, item?.creation_date, item?.created_at, item?.last_update_date];

        for (const ts of fallbackCandidates) {
            if (ts == null) continue;

            const d = toDate(ts);
            if (!d) continue;

            // If backend returns release timestamp on the vote item, avoid showing it as vote date.
            if (releaseMs != null && d.getTime() === releaseMs) continue;
            if (releaseLastUpdateMs != null && d.getTime() === releaseLastUpdateMs) continue;

            // Vote date should not be before release creation (if we know it)
            if (releaseMs != null && d.getTime() <= releaseMs) continue;

            return d;
        }

        return null;
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
        display: block;
        border-radius: 14px;
        transition: transform 0.18s ease, filter 0.18s ease;
    }

    .vote-card:hover {
        transform: translateY(-2px);
        filter: brightness(1.03);
    }

    .vote-poster {
        width: 100%;
        aspect-ratio: 2/3;
        object-fit: cover;
        border-radius: 12px;
        margin-bottom: 8px;
        background: var(--alt-background-color);
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
        backdrop-filter: blur(6px);
    }

    .vote-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 0 2px;
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

    .load-more-btn:hover {
        filter: brightness(1.05);
    }

    @media (max-width: 768px) {
        .votes-page {
            padding: 16px;
        }

        .votes-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
        }

        .vote-score {
            font-size: 13px;
            padding: 6px 9px;
        }
    }
</style>
