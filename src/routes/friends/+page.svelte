<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { getApi } from '$lib/api';
    import { userToken } from '$lib/stores';
    import Preloader from '$lib/components/Preloader.svelte';

    $: utoken = $userToken;

    let friends = [];
    let isLoading = true;
    let page = 0;
    let isLoadingMore = false;
    let api = null;
    let selectedTab = 'friends';
    let searchQuery = '';
    let allFriends = [];

    onMount(async () => {
        if (browser) {
            if (!utoken) {
                goto('/login');
                return;
            }
            api = getApi();
            await loadFriends();
        }
    });

    async function loadFriends() {
        if (!api || !utoken) return;
        isLoading = true;
        page = 0;
        try {
            let data;
            if (selectedTab === 'friends') {
                data = await api.profile.getFriends({ id: utoken.id, page: 0 });
            } else {
                data = await api.profile.getFriendRequests({ page: 0 });
            }
            allFriends = data.content || [];
            friends = allFriends;
        } catch (e) {
            console.error('Error loading friends:', e);
        }
        isLoading = false;
    }

    async function loadMore() {
        if (!api || isLoadingMore) return;
        isLoadingMore = true;
        page++;
        try {
            let data;
            if (selectedTab === 'friends') {
                data = await api.profile.getFriends({ id: utoken.id, page });
            } else {
                data = await api.profile.getFriendRequests({ page });
            }
            const newFriends = data.content || [];
            allFriends = [...allFriends, ...newFriends];
            friends = filterFriends(allFriends);
        } catch (e) {
            console.error('Error loading more:', e);
        }
        isLoadingMore = false;
    }

    function switchTab(tab) {
        if (selectedTab === tab) return;
        selectedTab = tab;
        friends = [];
        allFriends = [];
        searchQuery = '';
        loadFriends();
    }

    function filterFriends(list) {
        if (!searchQuery.trim()) return list;
        const query = searchQuery.toLowerCase();
        return list.filter(f => f.login?.toLowerCase().includes(query));
    }

    function handleSearch(e) {
        searchQuery = e.target.value;
        friends = filterFriends(allFriends);
    }

    function handleScroll(e) {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollHeight - scrollTop - clientHeight < 500 && !isLoadingMore) {
            loadMore();
        }
    }
</script>

<svelte:head>
    <title>Друзья - AniShika</title>
</svelte:head>

<div class="friends-page" on:scroll={handleScroll}>
    <div class="friends-header">
        <h1>Друзья</h1>
        <div class="search-wrapper">
            <svg class="search-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <input
                type="text"
                class="search-input"
                placeholder="Поиск друзей..."
                bind:value={searchQuery}
                on:input={handleSearch}
            />
        </div>
        <div class="tabs">
            <button 
                class="tab" 
                class:active={selectedTab === 'friends'}
                on:click={() => switchTab('friends')}
            >
                Друзья
            </button>
            <button 
                class="tab" 
                class:active={selectedTab === 'requests'}
                on:click={() => switchTab('requests')}
            >
                Заявки
            </button>
        </div>
    </div>

    <div class="friends-content">
        {#if isLoading}
            <Preloader size="large" />
        {:else if friends.length === 0}
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                </svg>
                <p>{selectedTab === 'friends' ? 'У вас пока нет друзей' : 'Нет заявок в друзья'}</p>
            </div>
        {:else}
            <div class="friends-list">
                {#each friends as friend (friend.id)}
                    <a href="/profile/{friend.id}" class="friend-card">
                        <div class="friend-avatar">
                            {#if friend.avatar}
                                <img src={friend.avatar} alt={friend.login} />
                            {:else}
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                </svg>
                            {/if}
                        </div>
                        <div class="friend-info">
                            <span class="friend-name">{friend.login}</span>
                            {#if friend.status}
                                <span class="friend-status" class:online={friend.status.includes('онлайн')}>
                                    {friend.status}
                                </span>
                            {/if}
                        </div>
                    </a>
                {/each}
                
                {#if isLoadingMore}
                    <Preloader size="small" />
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    .friends-page {
        width: 100%;
        height: 100%;
        overflow-y: auto;
    }

    .friends-header {
        position: sticky;
        top: 0;
        background-color: var(--background-color);
        z-index: 10;
        padding: 20px;
    }

    .friends-header h1 {
        font-size: 24px;
        margin: 0 0 16px;
        color: var(--text-color);
    }

    .search-wrapper {
        position: relative;
        margin-bottom: 16px;
    }

    .search-icon {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        width: 20px;
        height: 20px;
        color: var(--secondary-text-color);
        pointer-events: none;
    }

    .search-input {
        width: 100%;
        padding: 12px 16px 12px 44px;
        font-size: 15px;
        border: none;
        border-radius: 10px;
        background-color: var(--background-color);
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

    .tabs {
        display: flex;
        gap: 8px;
    }

    .tab {
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        background-color: var(--alt-background-color);
        color: var(--secondary-text-color);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }

    .tab:hover {
        filter: brightness(1.2);
    }

    .tab.active {
        background-color: var(--primary-color);
        color: white;
    }

    .friends-content {
        padding: 0 20px 20px;
        max-width: 600px;
    }

    .friends-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .friend-card {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        background-color: var(--alt-background-color);
        border-radius: 12px;
        text-decoration: none;
        color: inherit;
        transition: transform 0.2s;
    }

    .friend-card:hover {
        transform: translateX(4px);
    }

    .friend-avatar {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        overflow: hidden;
        background-color: var(--background-color);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .friend-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .friend-avatar svg {
        width: 28px;
        height: 28px;
        color: var(--secondary-text-color);
    }

    .friend-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .friend-name {
        font-size: 15px;
        font-weight: 500;
        color: var(--text-color);
    }

    .friend-status {
        font-size: 13px;
        color: var(--secondary-text-color);
    }

    .friend-status.online {
        color: var(--watching-color);
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
        .friends-header {
            padding: 16px;
        }

        .friends-header h1 {
            font-size: 20px;
        }

        .friends-content {
            padding: 0 12px 12px;
        }
    }
</style>
