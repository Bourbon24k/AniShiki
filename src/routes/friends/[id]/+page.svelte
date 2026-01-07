<script>
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { getApi } from '$lib/api';
    import { userToken } from '$lib/stores';
    import Preloader from '$lib/components/Preloader.svelte';

    $: profileId = $page.params.id;
    $: utoken = $userToken;

    let friends = [];
    let profile = null;
    let isLoading = true;
    let currentPage = 0;
    let isLoadingMore = false;
    let hasMore = true;
    let api = null;

    let loadedProfileId = null;

    onMount(async () => {
        if (browser) {
            api = getApi();
            await loadData();
        }
    });

    $: if (browser && api && profileId && loadedProfileId !== profileId) {
        loadData();
    }

    async function loadData() {
        if (!api) return;

        const id = Number(profileId);
        if (!Number.isFinite(id)) return;

        if (loadedProfileId !== profileId) {
            loadedProfileId = profileId;
            friends = [];
            profile = null;
            isLoadingMore = false;
            hasMore = true;
            currentPage = 0;
        }

        isLoading = true;
        try {
            // Load profile info
            const profileData = await api.profile.info(id);
            profile = profileData.profile;
            
            // Load friends
            const friendsData = await api.profile.getFriends({ id, page: 0 });
            friends = friendsData.content || [];
            hasMore = friends.length >= 20;
        } catch (e) {
            console.error('Error loading data:', e);
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
            const data = await api.profile.getFriends({ id, page: currentPage });
            const newFriends = data.content || [];
            friends = [...friends, ...newFriends];
            hasMore = newFriends.length >= 20;
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
    <title>Друзья {profile?.login || ''} - AniShika</title>
</svelte:head>

<div class="friends-page" on:scroll={handleScroll}>
    <div class="page-header">
        <a href="/profile/{profileId}" class="back-link" aria-label="Назад" title="Назад">
            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
        </a>
        <h1>Друзья {profile?.login || ''}</h1>
    </div>

    {#if isLoading}
        <Preloader size="large" />
    {:else if friends.length === 0}
        <div class="empty-state">
            <p>Нет друзей</p>
        </div>
    {:else}
        <div class="friends-grid">
            {#each friends as friend (friend.id)}
                <a href="/profile/{friend.id}" class="friend-card">
                    <img 
                        src={friend.avatar || '/default-avatar.png'} 
                        alt={friend.login} 
                        class="friend-avatar"
                    />
                    <span class="friend-name">{friend.login}</span>
                    {#if friend.is_online}
                        <span class="online-badge"></span>
                    {/if}
                </a>
            {/each}
        </div>

        {#if isLoadingMore}
            <div class="loading-more">
                <Preloader size="small" />
            </div>
        {/if}
    {/if}
</div>

<style>
    .friends-page {
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
    }

    .back-link {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--alt-background-color);
        color: var(--text-color);
        text-decoration: none;
        transition: background 0.2s;
    }

    .back-link:hover {
        background: var(--background-color);
    }

    .page-header h1 {
        font-size: 24px;
        margin: 0;
        color: var(--text-color);
    }

    .friends-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 16px;
    }

    .friend-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 16px;
        background: var(--alt-background-color);
        border-radius: 12px;
        text-decoration: none;
        color: var(--text-color);
        transition: transform 0.2s, background 0.2s;
        position: relative;
    }

    .friend-card:hover {
        transform: translateY(-4px);
        background: var(--background-color);
    }

    .friend-avatar {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        object-fit: cover;
        margin-bottom: 12px;
    }

    .friend-name {
        font-size: 14px;
        font-weight: 500;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
    }

    .online-badge {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 12px;
        height: 12px;
        background: #4ade80;
        border-radius: 50%;
        border: 2px solid var(--alt-background-color);
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        color: var(--secondary-text-color);
    }

    .loading-more {
        display: flex;
        justify-content: center;
        padding: 20px;
    }

    @media (max-width: 768px) {
        .friends-page {
            padding: 16px;
        }

        .friends-grid {
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            gap: 12px;
        }

        .friend-avatar {
            width: 60px;
            height: 60px;
        }
    }
</style>
