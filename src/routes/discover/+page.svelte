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
            const [interesting, discussing, watching, weeklyComments, popular, weekCollections] = await Promise.all([
                api.discover.getInteresting().catch(() => ({ content: [] })),
                api.discover.getDiscussing().catch(() => ({ content: [] })),
                api.discover.getWatching(0).catch(() => ({ content: [] })),
                api.discover.getComments ? api.discover.getComments(0).catch(() => ({ content: [] })) : Promise.resolve({ content: [] }),
                api.release.filter(0, { sort: 1, status_id: null, category_id: null }, true).catch(() => ({ content: [] })),
                api.collection.all(0, 4).catch(() => ({ content: [] }))
            ]);

            discoverData = {
                interesting: interesting.content || interesting.releases || [],
                discussing: discussing.content || [],
                watching: watching.content || [],
                comments: weeklyComments.content || [],
                popular: popular.content || popular.releases || [],
                collections: weekCollections.content || []
            };
        } catch (e) {
            console.error('Error loading discover:', e);
            discoverData = { interesting: [], discussing: [], watching: [], comments: [], popular: [], collections: [] };
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
                    {#each discoverData.interesting as item, i}
                        <a
                            href="/release/{item.action || item.release?.id || item.id}"
                            class="carousel-slide"
                            class:active={i === carouselIndex}
                        >
                            <img src={item.image || item.release?.image} alt={item.title || item.release?.title_ru} class="carousel-img" referrerpolicy="no-referrer" />
                            <div class="carousel-shade"></div>
                            <div class="carousel-info">
                                <span class="carousel-tag">Интересное</span>
                                <h3>{item.title || item.release?.title_ru}</h3>
                                {#if item.description}<p>{item.description}</p>{/if}
                                <span class="carousel-cta">Смотреть →</span>
                            </div>
                        </a>
                    {/each}

                    <button class="carousel-btn prev" on:click|preventDefault={prevSlide} aria-label="Предыдущий">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                    </button>
                    <button class="carousel-btn next" on:click|preventDefault={nextSlide} aria-label="Следующий">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                    </button>

                    <div class="carousel-dots">
                        {#each discoverData.interesting as _, i}
                            <button class="dot" class:active={i === carouselIndex} on:click={() => carouselIndex = i} aria-label="Слайд {i+1}"></button>
                        {/each}
                    </div>
                </div>
            </section>
        {/if}

        <section class="quick-actions">
            <a class="action-btn action-btn--popular" href="/?type=5">
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M13.5 0.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.41-1.67-3.41-3.73L7.5 2.1C4.18 4.08 2 7.67 2 11.5 2 17.3 6.7 22 12.5 22S23 17.3 23 11.5c0-4.02-2.34-7.78-6.5-10.83z"/>
                </svg>
                <span class="action-text">Популярное</span>
            </a>
            <a class="action-btn action-btn--schedule" href="/schedule">
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/>
                </svg>
                <span class="action-text">Расписание</span>
            </a>
            <a class="action-btn action-btn--collections" href="/collections">
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M4 6h16V4H4v2zm0 14h16v-6H4v6zm0-8h16V8H4v4z"/>
                </svg>
                <span class="action-text">Коллекции</span>
            </a>
            <a class="action-btn action-btn--filter" href="/search">
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M10 18h4v-2h-4v2zm-7-8v2h18v-2H3zm3-6v2h12V4H6z"/>
                </svg>
                <span class="action-text">Фильтр</span>
            </a>

            <a class="action-btn action-btn--random" href="/random">
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
                </svg>
                <span class="action-text">Случайное</span>
            </a>
        </section>

        {#if discoverData.popular?.length > 0}
            <section class="section">
                <div class="section-header">
                    <h2 class="section-title">Популярное</h2>
                    <a href="/?type=5" class="view-all">Посмотреть всё</a>
                </div>
                <div class="popular-grid">
                    {#each discoverData.popular.slice(0, 6) as anime}
                        <AnimeCard {anime} type="grid" />
                    {/each}
                </div>
            </section>
        {/if}

        {#if discoverData.collections?.length > 0}
            <section class="section">
                <div class="section-header">
                    <h2 class="section-title">Коллекции недели</h2>
                    <a href="/collections" class="view-all">Посмотреть всё</a>
                </div>
                <div class="collections-grid">
                    {#each discoverData.collections.slice(0, 6) as c}
                        <a class="collection-card" href="/collection/{c.id}">
                            <img class="collection-img" src={c.image} alt={c.title} loading="lazy" />
                            <div class="collection-title">{c.title}</div>
                        </a>
                    {/each}
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

    .quick-actions {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
        margin: 10px 0 30px;
    }

    .action-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 14px;
        border-radius: var(--radius-md);
        color: var(--text-color);
        background: var(--surface-2);
        border: 1px solid var(--border-color);
        text-decoration: none;
        transition: background var(--dur) var(--ease), transform var(--dur-fast) var(--ease), border-color var(--dur) var(--ease);
        font-weight: 700;
    }

    .action-btn :global(svg) { color: var(--accent-strong); }

    .action-btn:hover {
        background: var(--surface-hover);
        border-color: var(--border-strong);
        transform: translateY(-2px);
    }

    .carousel {
        position: relative;
        width: 100%;
        height: 380px;
        border-radius: var(--radius-lg);
        overflow: hidden;
        background: var(--surface-2);
        box-shadow: var(--shadow-md);
    }

    @media (max-width: 768px) {
        .quick-actions {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    .popular-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 16px;
    }

    .collections-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
    }

    .collection-card {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 14px;
        border-radius: 14px;
        background: var(--alt-background-color);
        color: inherit;
        text-decoration: none;
        transition: filter 0.2s;
    }

    .collection-card:hover {
        filter: brightness(1.1);
    }

    .collection-img {
        width: 100%;
        height: 140px;
        border-radius: 12px;
        object-fit: cover;
        background: var(--background-color);
    }

    .collection-title {
        font-size: 14px;
        font-weight: 700;
        color: var(--text-color);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
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
    .carousel-slide {
        position: absolute;
        inset: 0;
        text-decoration: none;
        opacity: 0;
        visibility: hidden;
        transition: opacity var(--dur-slow) var(--ease);
    }

    .carousel-slide.active {
        opacity: 1;
        visibility: visible;
        z-index: 1;
    }

    .carousel-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center 25%;
    }

    .carousel-shade {
        position: absolute;
        inset: 0;
        background: var(--hero-grad), var(--overlay-grad);
    }

    .carousel-info {
        position: absolute;
        bottom: 0;
        left: 0;
        max-width: 620px;
        padding: 28px 32px;
        color: #fff;
    }

    .carousel-tag {
        display: inline-block;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--accent-strong);
        margin-bottom: 8px;
    }

    .carousel-info h3 {
        font-size: clamp(22px, 3.5vw, 34px);
        font-weight: 900;
        letter-spacing: -0.02em;
        margin: 0 0 8px;
        text-shadow: 0 2px 12px rgba(0,0,0,0.5);
    }

    .carousel-info p {
        font-size: 14px;
        margin: 0 0 14px;
        opacity: 0.85;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .carousel-cta {
        display: inline-block;
        padding: 9px 18px;
        border-radius: var(--radius-pill);
        background: var(--accent-gradient);
        font-weight: 700;
        font-size: 14px;
        box-shadow: var(--shadow-accent);
    }

    .carousel-btn {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 42px;
        height: 42px;
        border-radius: 50%;
        border: 1px solid var(--glass-border);
        background: var(--glass-bg);
        -webkit-backdrop-filter: blur(10px);
        backdrop-filter: blur(10px);
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 3;
        transition: background var(--dur) var(--ease);
    }

    .carousel-btn:hover { background: var(--accent); }
    .carousel-btn.prev { left: 16px; }
    .carousel-btn.next { right: 16px; }

    .carousel-dots {
        position: absolute;
        bottom: 16px;
        right: 24px;
        display: flex;
        gap: 7px;
        z-index: 3;
    }

    .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        border: none;
        background: rgba(255,255,255,0.4);
        cursor: pointer;
        transition: all var(--dur) var(--ease);
    }

    .dot.active { background: #fff; width: 22px; border-radius: 4px; }

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

        .popular-grid {
            grid-template-columns: repeat(4, 1fr);
        }

        .collections-grid {
            grid-template-columns: repeat(2, 1fr);
        }

        .carousel {
            height: 300px;
        }
    }

    @media (max-width: 768px) {
        .discover-page {
            padding: 16px;
            padding-top: 20px;
        }

        .action-btn {
            padding: 12px;
            border-radius: 12px;
            gap: 8px;
        }

        .action-text {
            font-size: 14px;
        }

        .popular-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
        }

        .collections-grid {
            grid-template-columns: 1fr;
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

        .carousel {
            height: 240px;
        }

        .carousel-info { padding: 18px 18px 22px; }
        .carousel-info p { display: none; }

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
