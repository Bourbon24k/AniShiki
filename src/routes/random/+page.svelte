<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { getApi } from '$lib/api';
    import { returnEpisodeString } from '$lib/utils';
    import Preloader from '$lib/components/Preloader.svelte';

    let release = null;
    let isLoading = true;
    let api = null;

    onMount(async () => {
        if (browser) {
            api = getApi();
            await loadRandom();
        }
    });

    async function loadRandom() {
        if (!api) return;
        isLoading = true;
        try {
            const data = await api.release.getRandomRelease(true);
            console.log('Random release:', data);
            if (data.release) {
                release = data.release;
            }
        } catch (e) {
            console.error('Error loading random:', e);
        }
        isLoading = false;
    }

    function goToRelease() {
        if (release) {
            goto(`/release/${release.id}`);
        }
    }
</script>

<svelte:head>
    <title>Случайное аниме - AniShika</title>
</svelte:head>

<div class="random-page">
    {#if isLoading}
        <Preloader size="large" />
    {:else if release}
        <div class="random-content">
            <div class="poster-section">
                <img src={release.image} alt={release.title_ru} class="poster" />
                <div class="actions">
                    <button class="action-btn primary" on:click={goToRelease}>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        Смотреть
                    </button>
                    <button class="action-btn secondary" on:click={loadRandom}>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                            <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
                        </svg>
                        Ещё
                    </button>
                </div>
            </div>
            
            <div class="info-section">
                <h1 class="title">{release.title_ru}</h1>
                {#if release.title_original}
                    <h2 class="alt-title">{release.title_original}</h2>
                {/if}
                
                <div class="meta">
                    {#if release.year}
                        <span class="meta-item">{release.year}</span>
                    {/if}
                    {#if release.type}
                        <span class="meta-item">{release.type.name}</span>
                    {/if}
                    {#if release.episodes_total || release.episodes_released}
                        <span class="meta-item">{returnEpisodeString(release)} эп.</span>
                    {/if}
                    {#if release.grade}
                        <span class="meta-item rating">★ {release.grade.toFixed(1)}</span>
                    {/if}
                </div>
                
                {#if release.genres}
                    <div class="genres">
                        {#if typeof release.genres === 'string'}
                            {#each release.genres.split(',').map(g => g.trim()).filter(g => g) as genre}
                                <span class="genre">{genre}</span>
                            {/each}
                        {:else if Array.isArray(release.genres)}
                            {#each release.genres as genre}
                                <span class="genre">{genre.name || genre}</span>
                            {/each}
                        {/if}
                    </div>
                {/if}
                
                {#if release.description}
                    <p class="description">{release.description}</p>
                {/if}
                
                {#if release.status}
                    <div class="status" class:ongoing={release.status.id === 2} class:completed={release.status.id === 1}>
                        {release.status.name}
                    </div>
                {/if}
            </div>
        </div>
    {:else}
        <div class="error-state">
            <p>Не удалось загрузить случайное аниме</p>
            <button class="retry-btn" on:click={loadRandom}>Попробовать снова</button>
        </div>
    {/if}
</div>

<style>
    .random-page {
        width: 100%;
        min-height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
    }

    .random-content {
        display: flex;
        gap: 40px;
        max-width: 1000px;
        width: 100%;
    }

    .poster-section {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .poster {
        width: 280px;
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.4);
    }

    .actions {
        display: flex;
        gap: 10px;
    }

    .action-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 14px;
        border: none;
        border-radius: 10px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }

    .action-btn.primary {
        background: var(--primary-color);
        color: white;
    }

    .action-btn.primary:hover {
        filter: brightness(1.1);
    }

    .action-btn.secondary {
        background: var(--alt-background-color);
        color: var(--text-color);
    }

    .action-btn.secondary:hover {
        background: var(--background-color);
    }

    .info-section {
        flex: 1;
        min-width: 0;
    }

    .title {
        font-size: 32px;
        font-weight: bold;
        margin: 0 0 8px;
        color: var(--text-color);
    }

    .alt-title {
        font-size: 18px;
        font-weight: 400;
        color: var(--secondary-text-color);
        margin: 0 0 20px;
    }

    .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        margin-bottom: 20px;
    }

    .meta-item {
        font-size: 14px;
        color: var(--secondary-text-color);
    }

    .meta-item.rating {
        color: #ffc107;
        font-weight: 600;
    }

    .genres {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 20px;
    }

    .genre {
        padding: 6px 14px;
        background: var(--alt-background-color);
        border-radius: 20px;
        font-size: 13px;
        color: var(--text-color);
    }

    .description {
        font-size: 15px;
        line-height: 1.7;
        color: var(--text-color);
        margin: 0 0 20px;
    }

    .status {
        display: inline-block;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        background: var(--alt-background-color);
        color: var(--secondary-text-color);
    }

    .status.ongoing {
        background: var(--watching-color);
        color: white;
    }

    .status.completed {
        background: var(--completed-color);
        color: white;
    }

    .error-state {
        text-align: center;
        color: var(--secondary-text-color);
    }

    .retry-btn {
        margin-top: 16px;
        padding: 12px 24px;
        background: var(--primary-color);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        cursor: pointer;
    }

    @media (max-width: 768px) {
        .random-page {
            padding: 20px;
        }

        .random-content {
            flex-direction: column;
            align-items: center;
            text-align: center;
        }

        .poster {
            width: 200px;
        }

        .title {
            font-size: 24px;
        }

        .meta, .genres {
            justify-content: center;
        }
    }
</style>
