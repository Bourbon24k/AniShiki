<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { getApi } from '$lib/api';
    import { userToken } from '$lib/stores';
    import Preloader from '$lib/components/Preloader.svelte';

    $: utoken = $userToken;

    let friends = [];
    let allFriends = [];
    let requestsIn = [];
    let requestsOut = [];
    let searchResults = [];

    let isLoading = true;
    let isLoadingMore = false;
    let hasMore = true;
    let page = 0;

    let searchPage = 0;
    let searchHasMore = true;
    let searchLoading = false;
    let searchLoadingMore = false;
    let searchDebounce;

    let api = null;
    let selectedTab = 'friends';
    let searchQuery = '';
    let searchUsersQuery = '';
    let searchStatuses = {};

    onMount(async () => {
        if (browser) {
            if (!utoken) {
                goto('/login');
                return;
            }
            api = getApi();
            await loadTab(true);
        }
    });

    async function loadTab(reset) {
        if (!api || !utoken) return;

        if (selectedTab === 'search') {
            isLoading = false;
            return;
        }

        isLoading = true;
        if (reset) {
            page = 0;
            hasMore = true;
        }

        try {
            let data;
            if (selectedTab === 'friends') {
                data = await api.profile.getFriends({ id: utoken.id, page });
                const items = data.content || [];
                if (reset) {
                    allFriends = items;
                } else {
                    allFriends = [...allFriends, ...items];
                }
                friends = filterFriends(allFriends);
                hasMore = items.length >= 25;
            } else if (selectedTab === 'in') {
                data = await api.profile.getFriendRequests('in', page);
                const items = data.content || [];
                requestsIn = reset ? items : [...requestsIn, ...items];
                hasMore = items.length >= 25;
            } else if (selectedTab === 'out') {
                data = await api.profile.getFriendRequests('out', page);
                const items = data.content || [];
                requestsOut = reset ? items : [...requestsOut, ...items];
                hasMore = items.length >= 25;
            }
        } catch (e) {
            console.error('Error loading friends:', e);
            hasMore = false;
        }

        isLoading = false;
    }

    async function loadMore() {
        if (!api || isLoadingMore || !hasMore || selectedTab === 'search') return;
        isLoadingMore = true;
        page++;
        await loadTab(false);
        isLoadingMore = false;
    }

    function switchTab(tab) {
        if (selectedTab === tab) return;
        selectedTab = tab;
        searchQuery = '';
        if (tab === 'friends') {
            friends = [];
            allFriends = [];
        }
        if (tab === 'in') {
            requestsIn = [];
        }
        if (tab === 'out') {
            requestsOut = [];
        }
        if (tab === 'search') {
            searchUsersQuery = '';
            searchResults = [];
            searchStatuses = {};
            searchPage = 0;
            searchHasMore = true;
        }
        loadTab(true);
    }

    function filterFriends(list) {
        if (!searchQuery.trim()) return list;
        const query = searchQuery.toLowerCase();
        return list.filter(f => f.login?.toLowerCase().includes(query));
    }

    function handleSearch(e) {
        const value = e.target.value;
        if (selectedTab === 'search') {
            searchUsersQuery = value;
            clearTimeout(searchDebounce);
            if (searchUsersQuery.trim().length < 2) {
                searchResults = [];
                searchStatuses = {};
                searchPage = 0;
                searchHasMore = true;
                return;
            }
            searchDebounce = setTimeout(() => {
                searchUsers(0);
            }, 400);
            return;
        }

        searchQuery = value;
        friends = filterFriends(allFriends);
    }

    function handleScroll(e) {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollHeight - scrollTop - clientHeight < 500) {
            if (selectedTab === 'search') {
                if (!searchLoadingMore) {
                    loadMoreSearch();
                }
                return;
            }

            if (!isLoadingMore) {
                loadMore();
            }
        }
    }

    async function searchUsers(nextPage) {
        if (!api || !utoken || !api.search?.profiles) return;
        if (searchLoading || searchLoadingMore) return;
        if (nextPage > 0 && !searchHasMore) return;

        if (nextPage === 0) {
            searchLoading = true;
        } else {
            searchLoadingMore = true;
        }

        try {
            const data = await api.search.profiles({ query: searchUsersQuery, page: nextPage });
            const items = data.content || data.profiles || [];
            if (nextPage === 0) {
                searchResults = items;
            } else {
                searchResults = [...searchResults, ...items];
            }

            searchHasMore = items.length >= 25;
            searchPage = nextPage;

            const nextStatuses = { ...searchStatuses };
            for (const p of items) {
                if (p && p.id != null && nextStatuses[p.id] === undefined) {
                    nextStatuses[p.id] = p.friend_status ?? 0;
                }
            }
            searchStatuses = nextStatuses;
        } catch (e) {
            console.error('Error searching users:', e);
            searchHasMore = false;
        }

        searchLoading = false;
        searchLoadingMore = false;
    }

    async function loadMoreSearch() {
        if (!searchUsersQuery.trim() || searchUsersQuery.trim().length < 2) return;
        if (searchLoading || searchLoadingMore || !searchHasMore) return;
        await searchUsers(searchPage + 1);
    }

    async function acceptFriendRequest(profileId) {
        if (!api || !utoken) return;
        try {
            await api.profile.sendFriendRequest(profileId);
            requestsIn = requestsIn.filter(p => p.id !== profileId);
        } catch (e) {
            console.error('Error accepting friend request:', e);
        }
    }

    async function hideFriendRequest(profileId) {
        if (!api || !utoken) return;
        try {
            await api.profile.hideFriendRequest(profileId);
            requestsIn = requestsIn.filter(p => p.id !== profileId);
        } catch (e) {
            console.error('Error hiding friend request:', e);
        }
    }

    async function cancelFriendRequest(profileId) {
        if (!api || !utoken) return;
        try {
            await api.profile.removeFriendRequest(profileId);
            requestsOut = requestsOut.filter(p => p.id !== profileId);
        } catch (e) {
            console.error('Error canceling friend request:', e);
        }
    }

    async function removeFriend(profileId) {
        if (!api || !utoken) return;
        try {
            await api.profile.removeFriendRequest(profileId);
            allFriends = allFriends.filter(p => p.id !== profileId);
            friends = filterFriends(allFriends);
        } catch (e) {
            console.error('Error removing friend:', e);
        }
    }

    async function toggleSearchFriend(profileId) {
        if (!api || !utoken) return;
        const prev = searchStatuses[profileId] ?? 0;

        try {
            if (prev === 1 || prev === 2) {
                await api.profile.removeFriendRequest(profileId);
                searchStatuses = { ...searchStatuses, [profileId]: 0 };
                return;
            }

            await api.profile.sendFriendRequest(profileId);
            searchStatuses = { ...searchStatuses, [profileId]: 1 };
        } catch (e) {
            console.error('Error toggling friend request:', e);
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
                placeholder={selectedTab === 'search' ? 'Поиск пользователей...' : 'Поиск друзей...'}
                value={selectedTab === 'search' ? searchUsersQuery : searchQuery}
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
                class:active={selectedTab === 'in'}
                on:click={() => switchTab('in')}
            >
                Входящие
            </button>
            <button 
                class="tab" 
                class:active={selectedTab === 'out'}
                on:click={() => switchTab('out')}
            >
                Исходящие
            </button>
            <button 
                class="tab" 
                class:active={selectedTab === 'search'}
                on:click={() => switchTab('search')}
            >
                Поиск
            </button>
        </div>
    </div>

    <div class="friends-content">
        {#if selectedTab !== 'search' && isLoading}
            <Preloader size="large" />
        {:else if selectedTab === 'friends' && friends.length === 0}
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                </svg>
                <p>У вас пока нет друзей</p>
            </div>
        {:else if selectedTab === 'in' && requestsIn.length === 0}
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                </svg>
                <p>Нет входящих заявок</p>
            </div>
        {:else if selectedTab === 'out' && requestsOut.length === 0}
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                </svg>
                <p>Нет исходящих заявок</p>
            </div>
        {:else if selectedTab === 'search' && searchUsersQuery.trim().length < 2}
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
                    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <p>Введите минимум 2 символа</p>
            </div>
        {:else if selectedTab === 'search' && searchLoading}
            <Preloader size="large" />
        {:else if selectedTab === 'search' && searchResults.length === 0}
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
                    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <p>Ничего не найдено</p>
            </div>
        {:else}
            <div class="friends-list">
                {#if selectedTab === 'friends'}
                    {#each friends as friend (friend.id)}
                        <div class="friend-card">
                            <a href="/profile/{friend.id}" class="friend-main">
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
                            <div class="friend-actions">
                                <button class="friend-action danger" on:click={() => removeFriend(friend.id)}>Удалить</button>
                            </div>
                        </div>
                    {/each}
                {:else if selectedTab === 'in'}
                    {#each requestsIn as friend (friend.id)}
                        <div class="friend-card">
                            <a href="/profile/{friend.id}" class="friend-main">
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
                            <div class="friend-actions">
                                <button class="friend-action" on:click={() => acceptFriendRequest(friend.id)}>Принять</button>
                                <button class="friend-action danger" on:click={() => hideFriendRequest(friend.id)}>Скрыть</button>
                            </div>
                        </div>
                    {/each}
                {:else if selectedTab === 'out'}
                    {#each requestsOut as friend (friend.id)}
                        <div class="friend-card">
                            <a href="/profile/{friend.id}" class="friend-main">
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
                            <div class="friend-actions">
                                <button class="friend-action danger" on:click={() => cancelFriendRequest(friend.id)}>Отменить</button>
                            </div>
                        </div>
                    {/each}
                {:else if selectedTab === 'search'}
                    {#each searchResults as friend (friend.id)}
                        <div class="friend-card">
                            <a href="/profile/{friend.id}" class="friend-main">
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
                            <div class="friend-actions">
                                {#if friend.id === utoken?.id}
                                    <button class="friend-action" disabled>Это вы</button>
                                {:else}
                                    {#if (searchStatuses[friend.id] ?? 0) === 2}
                                        <button class="friend-action" disabled>В друзьях</button>
                                    {:else if (searchStatuses[friend.id] ?? 0) === 1}
                                        <button class="friend-action danger" on:click={() => toggleSearchFriend(friend.id)}>Отменить</button>
                                    {:else}
                                        <button class="friend-action" on:click={() => toggleSearchFriend(friend.id)}>Добавить</button>
                                    {/if}
                                {/if}
                            </div>
                        </div>
                    {/each}
                {/if}

                {#if isLoadingMore || searchLoadingMore}
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
        gap: 12px;
        padding: 12px 14px;
        background-color: var(--alt-background-color);
        border-radius: 12px;
        text-decoration: none;
        color: inherit;
        transition: transform 0.2s;
    }

    .friend-main {
        display: flex;
        align-items: center;
        gap: 16px;
        min-width: 0;
        flex: 1;
        text-decoration: none;
        color: inherit;
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
        min-width: 0;
    }

    .friend-name {
        font-size: 15px;
        font-weight: 500;
        color: var(--text-color);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .friend-status {
        font-size: 13px;
        color: var(--secondary-text-color);
    }

    .friend-status.online {
        color: var(--watching-color);
    }

    .friend-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
    }

    .friend-action {
        border: none;
        border-radius: 8px;
        padding: 8px 10px;
        font-size: 13px;
        background: var(--primary-color);
        color: white;
        cursor: pointer;
        transition: filter 0.2s;
    }

    .friend-action:hover {
        filter: brightness(1.1);
    }

    .friend-action.danger {
        background: #c0392b;
    }

    .friend-action:disabled {
        opacity: 0.6;
        cursor: default;
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
