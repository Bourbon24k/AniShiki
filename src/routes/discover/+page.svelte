<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { getApi } from '$lib/api';
    import { returnTimeString } from '$lib/utils';
    import Preloader from '$lib/components/Preloader.svelte';
    import AnimeCard from '$lib/components/AnimeCard.svelte';

    let discoverData = null;
    let isLoading = true;
    let api = null;
    let carouselIndex = 0;
    let carouselInterval;

    onMount(() => {
        if (browser) {
            api = getApi();
            loadDiscover();
            startCarousel();
        }
        return () => {
            if (carouselInterval) clearInterval(carouselInterval);
        };
    });

    function startCarousel() {
        carouselInterval = setInterval(() => {
            if (discoverData?.interesting?.length > 0) {
                carouselIndex = (carouselIndex + 1) % discoverData.interesting.length;
            }
        }, 5000);
    }

    function prevSlide() {
        if (discoverData?.interesting?.length > 0) {
            carouselIndex = (carouselIndex - 1 + discoverData.interesting.length) % discoverData.interesting.length;
        }
    }

    function nextSlide() {
        if (discoverData?.interesting?.length > 0) {
            carouselIndex = (carouselIndex + 1) % discoverData.interesting.length;
        }
    }

    async function loadDiscover() {
        if (!api) return;
        isLoading = true;
        try {
            const [interesting, discussing, watching, weeklyComments] = await Promise.all([
                api.discover.getInteresting().catch(() => ({ content: [] })),
                api.discover.getDiscussing().catch(() => ({ content: [] })),
                api.discover.getWatching(0).catch(() => ({ content: [] })),
                api.discover.getComments ? api.discover.getComments(0).catch(() => ({ content: [] })) : Promise.resolve({ content: [] })
            ]);
            
            console.log('Interesting:', interesting);
            console.log('Watching:', watching);
            
            discoverData = {
                interesting: interesting.content || interesting.releases || [],
                discussing: discussing.content || [],
                watching: watching.content || [],
                comments: weeklyComments.content || []
            };
        } catch (e) {
            console.error('Error loading discover:', e);
            discoverData = { interesting: [], discussing: [], watching: [], comments: [] };
        }
        isLoading = false;
    }
</script>

<svelte:head>
    <title>Обзор - AniShika</title>
</svelte:head>

<div class="discover-page">
    {#if isLoading}
        <Preloader size="large" />
    {:else if discoverData}
        <!-- Carousel section -->
        {#if discoverData.interesting.length > 0}
            <section class="carousel-section">
                <div class="carousel">
                    <button class="carousel-btn prev" on:click={prevSlide}>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                        </svg>
                    </button>
                    <div class="carousel-track">
                        {#each discoverData.interesting as item, i}
                            <a 
                                href="/release/{item.action || item.release?.id || item.id}" 
                                class="carousel-slide" 
                                class:active={i === carouselIndex}
                                class:prev={i === (carouselIndex - 1 + discoverData.interesting.length) % discoverData.interesting.length}
                                class:next={i === (carouselIndex + 1) % discoverData.interesting.length}
                            >
                                <img src={item.image || item.release?.image} alt={item.title || item.release?.title_ru} class="carousel-img" referrerpolicy="no-referrer" />
                                <div class="carousel-info">
                                    <h3>{item.title || item.release?.title_ru}</h3>
                                    {#if item.description}
                                        <p>{item.description}</p>
                                    {/if}
                                </div>
                            </a>
                        {/each}
                    </div>
                    <button class="carousel-btn next" on:click={nextSlide}>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                        </svg>
                    </button>
                </div>
            </section>
        {/if}

        <!-- Currently watching section -->
        {#if discoverData.watching.length > 0}
            <section class="section">
                <div class="section-header">
                    <h2 class="section-title">Сейчас смотрят</h2>
                    <a href="/search" class="view-all">Посмотреть всё</a>
                </div>
                <div class="watching-grid">
                    {#each discoverData.watching.slice(0, 6) as anime}
                        <a href="/release/{anime.id}" class="watching-card">
                            <div class="watching-poster-wrap">
                                <img src={anime.image} alt={anime.title_ru} class="watching-poster" />
                            </div>
                            <span class="watching-title">{anime.title_ru}</span>
                            <span class="watching-meta">{anime.episodes_released || '?'} эп. • {anime.grade?.toFixed(2) || '0'} ★</span>
                        </a>
                    {/each}
                </div>
            </section>
        {/if}

        <!-- Weekly comments section -->
        {#if discoverData.comments?.length > 0}
            <section class="section">
                <h2 class="section-title">Комментарии недели</h2>
                <div class="comments-list">
                    {#each discoverData.comments.slice(0, 5) as comment}
                        <div class="weekly-comment">
                            <a href="/profile/{comment.profile?.id}" class="comment-avatar">
                                <img src={comment.profile?.avatar} alt="" />
                            </a>
                            <div class="comment-body">
                                <div class="comment-meta">
                                    <a href="/profile/{comment.profile?.id}" class="comment-author">{comment.profile?.login}</a>
                                    <a href="/release/{comment.release?.id}" class="comment-release">к релизу</a>
                                    <span class="comment-release-title">{comment.release?.title_ru}</span>
                                </div>
                                <p class="comment-text">{comment.message}</p>
                                <span class="comment-date">{returnTimeString(comment.timestamp * 1000)}</span>
                            </div>
                            <span class="comment-likes">❤️ {comment.likes_count || 0}</span>
                        </div>
                    {/each}
                </div>
            </section>
        {/if}

        <!-- Discussing today section -->
        {#if discoverData.discussing.length > 0}
            <section class="section">
                <h2 class="section-title">Обсуждаемое сегодня</h2>
                <div class="discussing-list">
                    {#each discoverData.discussing as anime}
                        <a href="/release/{anime.id}" class="discussing-card">
                            <img src={anime.image} alt="" class="discussing-poster" />
                            <div class="discussing-info">
                                <h4 class="discussing-title">{anime.title_ru}</h4>
                                <span class="discussing-meta">{anime.comment_count || 0} комментариев</span>
                                <span class="discussing-meta">{anime.episodes_released || '?'} из {anime.episodes_total || '?'} эп. • {anime.grade?.toFixed(2) || '0'} ★</span>
                                {#if anime.description}
                                    <p class="discussing-desc">{anime.description}</p>
                                {/if}
                            </div>
                        </a>
                    {/each}
                </div>
            </section>
        {/if}

        {#if discoverData.interesting.length === 0 && discoverData.discussing.length === 0 && discoverData.watching.length === 0}
            <div class="empty-state">
                <p>Не удалось загрузить данные</p>
            </div>
        {/if}
    {/if}
</div>

<style>
    .discover-page {
        width: 100%;
        height: 100%;
        overflow-y: auto;
        padding: 20px;
    }

    .section {
        margin-bottom: 40px;
    }

    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }

    .section-title {
        font-size: 22px;
        font-weight: 600;
        margin: 0;
        color: var(--text-color);
    }

    .view-all {
        color: var(--secondary-text-color);
        text-decoration: none;
        font-size: 14px;
    }

    .view-all:hover {
        color: var(--text-color);
    }

    /* Carousel */
    .carousel-section {
        margin-bottom: 40px;
    }

    .carousel {
        position: relative;
        display: flex;
        align-items: center;
        gap: 16px;
    }

    .carousel-btn {
        flex-shrink: 0;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: none;
        background: var(--alt-background-color);
        color: var(--text-color);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        z-index: 5;
    }

    .carousel-btn:hover {
        background: var(--primary-color);
        color: white;
    }

    .carousel-track {
        display: flex;
        gap: 20px;
        justify-content: center;
        flex: 1;
        overflow: hidden;
        height: 320px;
    }

    .carousel-slide {
        position: absolute;
        width: 45%;
        height: 300px;
        border-radius: 16px;
        overflow: hidden;
        text-decoration: none;
        opacity: 0;
        transform: scale(0.8);
        transition: all 0.5s ease;
        pointer-events: none;
    }

    .carousel-slide.active {
        position: relative;
        opacity: 1;
        transform: scale(1);
        z-index: 3;
        pointer-events: auto;
    }

    .carousel-slide.prev,
    .carousel-slide.next {
        position: relative;
        opacity: 0.6;
        transform: scale(0.85);
        z-index: 1;
        pointer-events: auto;
    }

    .carousel-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .carousel-info {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 20px;
        background: linear-gradient(transparent, rgba(0,0,0,0.9));
        color: white;
    }

    .carousel-info h3 {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 6px;
    }

    .carousel-info p {
        font-size: 13px;
        margin: 0;
        opacity: 0.8;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    /* Watching grid */
    .watching-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 16px;
    }

    .watching-card {
        text-decoration: none;
        color: inherit;
    }

    .watching-poster-wrap {
        position: relative;
        border-radius: 12px;
        overflow: hidden;
        margin-bottom: 8px;
    }

    .watching-poster {
        width: 100%;
        aspect-ratio: 2/3;
        object-fit: cover;
        transition: transform 0.2s;
    }

    .watching-card:hover .watching-poster {
        transform: scale(1.05);
    }

    .watching-title {
        display: block;
        font-size: 13px;
        color: var(--text-color);
        margin-bottom: 4px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .watching-meta {
        font-size: 12px;
        color: var(--secondary-text-color);
    }

    /* Weekly comments */
    .comments-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .weekly-comment {
        display: flex;
        gap: 12px;
        padding: 16px;
        background: var(--alt-background-color);
        border-radius: 12px;
        align-items: flex-start;
    }

    .weekly-comment .comment-avatar {
        flex-shrink: 0;
    }

    .weekly-comment .comment-avatar img {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        object-fit: cover;
    }

    .comment-body {
        flex: 1;
        min-width: 0;
    }

    .comment-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 6px;
        font-size: 13px;
    }

    .comment-author {
        font-weight: 600;
        color: var(--text-color);
        text-decoration: none;
    }

    .comment-release {
        color: var(--primary-color);
        text-decoration: none;
    }

    .comment-release-title {
        color: var(--secondary-text-color);
    }

    .weekly-comment .comment-text {
        font-size: 14px;
        color: var(--text-color);
        margin: 0 0 6px;
        line-height: 1.5;
    }

    .comment-date {
        font-size: 12px;
        color: var(--secondary-text-color);
    }

    .comment-likes {
        flex-shrink: 0;
        font-size: 14px;
        color: var(--secondary-text-color);
        padding: 4px 10px;
        background: var(--background-color);
        border-radius: 16px;
    }

    /* Discussing list */
    .discussing-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .discussing-card {
        display: flex;
        gap: 16px;
        padding: 16px;
        background: var(--alt-background-color);
        border-radius: 12px;
        text-decoration: none;
        color: inherit;
        transition: background 0.2s;
    }

    .discussing-card:hover {
        background: var(--background-color);
    }

    .discussing-poster {
        width: 80px;
        height: 110px;
        object-fit: cover;
        border-radius: 8px;
        flex-shrink: 0;
    }

    .discussing-info {
        flex: 1;
        min-width: 0;
    }

    .discussing-title {
        font-size: 16px;
        font-weight: 600;
        margin: 0 0 6px;
        color: var(--text-color);
    }

    .discussing-meta {
        display: block;
        font-size: 13px;
        color: var(--secondary-text-color);
        margin-bottom: 4px;
    }

    .discussing-desc {
        font-size: 13px;
        color: var(--text-color);
        margin: 8px 0 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        opacity: 0.8;
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        color: var(--secondary-text-color);
        text-align: center;
    }

    @media (max-width: 1024px) {
        .watching-grid {
            grid-template-columns: repeat(4, 1fr);
        }

        .carousel-track {
            height: 260px;
        }

        .carousel-slide.active {
            width: 60%;
        }

        .carousel-slide.prev,
        .carousel-slide.next {
            width: 30%;
        }
    }

    @media (max-width: 768px) {
        .discover-page {
            padding: 16px;
            padding-top: 20px;
        }

        .carousel-section {
            margin-bottom: 30px;
            margin-top: 8px;
        }

        .section-title {
            font-size: 18px;
        }

        .watching-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
        }

        .carousel-track {
            height: 200px;
        }

        .carousel-slide.active {
            width: 80%;
        }

        .carousel-slide.prev,
        .carousel-slide.next {
            display: none;
        }

        .carousel-btn {
            width: 36px;
            height: 36px;
        }

        .discussing-poster {
            width: 60px;
            height: 85px;
        }
    }
</style>
