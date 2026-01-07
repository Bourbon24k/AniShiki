<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { getApi } from '$lib/api';
    import { userToken } from '$lib/stores';
    import { returnTimeString } from '$lib/utils';
    import Preloader from '$lib/components/Preloader.svelte';

    $: utoken = $userToken;

    let articles = [];
    let isLoading = true;
    let page = 0;
    let isLoadingMore = false;
    let hasMore = true;
    let api = null;
    let activeTab = 'latest'; // 'my' or 'latest'

    onMount(async () => {
        if (browser) {
            api = getApi();
            await loadFeed();
        }
    });

    async function loadFeed() {
        if (!api) return;
        isLoading = true;
        page = 0;
        try {
            let data;
            if (activeTab === 'my' && utoken) {
                try {
                    data = await api.feed.my(page);
                } catch (e) {
                    // Fallback to latest if my feed fails
                    data = await api.feed.latest(page);
                }
            } else {
                data = await api.feed.latest(page);
            }
            console.log('Feed data:', data);
            articles = data.content || [];
            hasMore = articles.length >= 20;
        } catch (e) {
            console.error('Error loading feed:', e);
            articles = [];
        }
        isLoading = false;
    }

    async function loadMore() {
        if (!api || isLoadingMore || !hasMore) return;
        isLoadingMore = true;
        page++;
        try {
            let data;
            if (activeTab === 'my' && utoken) {
                data = await api.feed.my(page);
            } else {
                data = await api.feed.latest(page);
            }
            const newItems = data.content || [];
            articles = [...articles, ...newItems];
            hasMore = newItems.length >= 20;
        } catch (e) {
            console.error('Error loading more:', e);
        }
        isLoadingMore = false;
    }

    function switchTab(tab) {
        if (tab === activeTab) return;
        activeTab = tab;
        loadFeed();
    }

    function handleScroll(e) {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollHeight - scrollTop - clientHeight < 500 && !isLoadingMore && hasMore) {
            loadMore();
        }
    }
</script>

<svelte:head>
    <title>Лента - AniShika</title>
</svelte:head>

<div class="feed-page" on:scroll={handleScroll}>
    <div class="feed-header">
        <h1>Лента</h1>
        <div class="tabs">
            {#if utoken}
                <button class="tab" class:active={activeTab === 'my'} on:click={() => switchTab('my')}>
                    Мои подписки
                </button>
            {/if}
            <button class="tab" class:active={activeTab === 'latest'} on:click={() => switchTab('latest')}>
                Последние
            </button>
        </div>
    </div>

    <div class="feed-content">
        {#if isLoading}
            <Preloader size="large" />
        {:else if articles.length === 0}
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
                <p>{activeTab === 'my' ? 'Нет постов от ваших подписок' : 'Нет новых постов'}</p>
            </div>
        {:else}
            <div class="articles-list">
                {#each articles as article (article.id)}
                    <div class="article-card">
                        <div class="article-header">
                            {#if article.channel}
                                <a href="/channel/{article.channel.id}" class="channel-info">
                                    {#if article.channel.image}
                                        <img src={article.channel.image} alt="" class="channel-avatar" />
                                    {/if}
                                    <span class="channel-name">{article.channel.name}</span>
                                </a>
                            {/if}
                            {#if article.timestamp}
                                <span class="article-time">{returnTimeString(article.timestamp * 1000)}</span>
                            {/if}
                        </div>
                        
                        {#if article.title}
                            <h3 class="article-title">{article.title}</h3>
                        {/if}
                        
                        {#if article.text || article.message}
                            <p class="article-text">{article.text || article.message}</p>
                        {/if}
                        
                        {#if article.image}
                            <img src={article.image} alt="" class="article-image" loading="lazy" />
                        {/if}
                        
                        {#if article.release}
                            <a href="/release/{article.release.id}" class="article-release">
                                <img src={article.release.image} alt="" class="release-poster" />
                                <div class="release-info">
                                    <span class="release-title">{article.release.title_ru}</span>
                                    {#if article.release.type}
                                        <span class="release-type">{article.release.type.name}</span>
                                    {/if}
                                </div>
                            </a>
                        {/if}
                        
                        <div class="article-stats">
                            {#if article.likes_count !== undefined}
                                <span class="stat">
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                        <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
                                    </svg>
                                    {article.likes_count}
                                </span>
                            {/if}
                            {#if article.comments_count !== undefined}
                                <span class="stat">
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                        <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"/>
                                    </svg>
                                    {article.comments_count}
                                </span>
                            {/if}
                            {#if article.views_count !== undefined}
                                <span class="stat">
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                                    </svg>
                                    {article.views_count}
                                </span>
                            {/if}
                        </div>
                    </div>
                {/each}
                
                {#if isLoadingMore}
                    <Preloader size="small" />
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    .feed-page {
        width: 100%;
        height: 100%;
        overflow-y: auto;
        padding: 20px;
    }

    .feed-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
        flex-wrap: wrap;
        gap: 16px;
    }

    .feed-header h1 {
        font-size: 24px;
        margin: 0;
        color: var(--text-color);
    }

    .tabs {
        display: flex;
        gap: 8px;
    }

    .tab {
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        background: var(--alt-background-color);
        color: var(--secondary-text-color);
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .tab.active {
        background: var(--primary-color);
        color: white;
    }

    .tab:hover:not(.active) {
        background: var(--background-color);
    }

    .feed-content {
        max-width: 700px;
    }

    .articles-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .article-card {
        background: var(--alt-background-color);
        border-radius: 12px;
        padding: 16px;
    }

    .article-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
    }

    .channel-info {
        display: flex;
        align-items: center;
        gap: 10px;
        text-decoration: none;
        color: var(--text-color);
    }

    .channel-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        object-fit: cover;
    }

    .channel-name {
        font-weight: 600;
        font-size: 14px;
    }

    .article-time {
        font-size: 12px;
        color: var(--secondary-text-color);
    }

    .article-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 10px;
        color: var(--text-color);
    }

    .article-text {
        font-size: 14px;
        line-height: 1.6;
        color: var(--text-color);
        margin: 0 0 12px;
    }

    .article-image {
        width: 100%;
        border-radius: 8px;
        margin-bottom: 12px;
    }

    .article-release {
        display: flex;
        gap: 12px;
        padding: 12px;
        background: var(--background-color);
        border-radius: 8px;
        text-decoration: none;
        color: inherit;
        margin-bottom: 12px;
    }

    .release-poster {
        width: 60px;
        height: 85px;
        object-fit: cover;
        border-radius: 6px;
    }

    .release-info {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 4px;
    }

    .release-title {
        font-weight: 500;
        font-size: 14px;
        color: var(--text-color);
    }

    .release-type {
        font-size: 12px;
        color: var(--secondary-text-color);
    }

    .article-stats {
        display: flex;
        gap: 16px;
    }

    .stat {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--secondary-text-color);
    }

    .stat svg {
        opacity: 0.7;
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
        .feed-page {
            padding: 16px;
        }

        .feed-header {
            flex-direction: column;
            align-items: flex-start;
        }

        .feed-header h1 {
            font-size: 20px;
        }
    }
</style>
