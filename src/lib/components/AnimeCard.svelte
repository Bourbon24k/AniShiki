<script>
    import { returnEpisodeString, getAgeRate } from '$lib/utils';

    export let anime;
    export let type = 'full-row';

    $: episodeText = returnEpisodeString(anime);
    $: ageRate = getAgeRate(anime.age_rating);
    $: poster = anime?.image || anime?.poster || '';

    function getStatusClass(status) {
        switch(status?.id) {
            case 1: return 'completed';
            case 2: return 'ongoing';
            case 3: return 'announced';
            default: return '';
        }
    }

    function getStatusText(status) {
        switch(status?.id) {
            case 1: return 'Завершён';
            case 2: return 'Онгоинг';
            case 3: return 'Анонс';
            default: return '';
        }
    }

    function genreList(genres, n) {
        if (!genres) return [];
        if (typeof genres === 'string') {
            return genres.split(',').map(g => g.trim()).filter(Boolean).slice(0, n);
        }
        if (Array.isArray(genres)) {
            return genres.slice(0, n).map(g => g.name || g);
        }
        return [];
    }
</script>

<a href="/release/{anime.id}" class="anime-card {type}" title={anime.title_ru}>
    <div class="poster-container">
        {#if poster}
            <img src={poster} alt={anime.title_ru} class="poster" loading="lazy" referrerpolicy="no-referrer" />
        {:else}
            <div class="poster poster-fallback"></div>
        {/if}

        <div class="poster-shade"></div>

        <div class="badges">
            {#if anime.status}
                <span class="badge status {getStatusClass(anime.status)}">{getStatusText(anime.status)}</span>
            {/if}
            <span class="badge age">{ageRate}</span>
        </div>

        {#if anime.grade}
            <span class="badge grade"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>{Number(anime.grade).toFixed(1)}</span>
        {/if}

        {#if type === 'grid'}
            <div class="hover-overlay">
                <span class="play-btn" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </span>
                <div class="overlay-meta">
                    <span>{episodeText} эп.</span>
                    {#if anime.year}<span>· {anime.year}</span>{/if}
                </div>
                {#if genreList(anime.genres, 3).length}
                    <div class="overlay-genres">
                        {#each genreList(anime.genres, 3) as g}<span>{g}</span>{/each}
                    </div>
                {/if}
            </div>
        {/if}
    </div>

    <div class="info">
        <h3 class="title">{anime.title_ru}</h3>

        {#if type === 'full-row'}
            {#if anime.title_original}<p class="alt-title">{anime.title_original}</p>{/if}
            {#if anime.description}<p class="description">{anime.description.slice(0, 220)}{anime.description.length > 220 ? '…' : ''}</p>{/if}
        {/if}

        <div class="meta">
            <span>{episodeText} эп.</span>
            {#if anime.year}<span>· {anime.year}</span>{/if}
        </div>

        {#if type === 'full-row' && genreList(anime.genres, 4).length}
            <div class="genres">
                {#each genreList(anime.genres, 4) as genre}
                    <span class="genre">{genre}</span>
                {/each}
            </div>
        {/if}
    </div>
</a>

<style>
    .anime-card {
        display: flex;
        text-decoration: none;
        color: inherit;
        position: relative;
    }

    /* ---------- Grid (poster-forward) ---------- */
    .anime-card.grid {
        flex-direction: column;
        width: 100%;
    }

    .grid .poster-container {
        position: relative;
        width: 100%;
        aspect-ratio: 2 / 3;
        border-radius: var(--radius-md);
        overflow: hidden;
        background: var(--surface-3);
        box-shadow: var(--shadow-sm);
        transition: transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
    }

    .grid:hover .poster-container {
        transform: translateY(-4px);
        box-shadow: var(--shadow-md);
    }

    .grid .poster {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: transform var(--dur-slow) var(--ease);
    }

    .grid:hover .poster {
        transform: scale(1.06);
    }

    .poster-shade {
        position: absolute;
        inset: 0;
        background: var(--overlay-grad);
        opacity: 0;
        transition: opacity var(--dur) var(--ease);
    }

    .grid:hover .poster-shade { opacity: 1; }

    .hover-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 14px;
        opacity: 0;
        transition: opacity var(--dur) var(--ease);
        text-align: center;
    }

    .grid:hover .hover-overlay { opacity: 1; }

    .play-btn {
        width: 54px;
        height: 54px;
        border-radius: 50%;
        background: var(--accent-gradient);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: var(--shadow-accent);
        transform: scale(0.8);
        transition: transform var(--dur) var(--ease);
    }

    .grid:hover .play-btn { transform: scale(1); }
    .play-btn svg { width: 26px; height: 26px; color: #fff; margin-left: 3px; }

    .overlay-meta {
        display: flex;
        gap: 6px;
        font-size: 12.5px;
        font-weight: 600;
        color: #fff;
        text-shadow: 0 1px 4px rgba(0,0,0,0.6);
    }

    .overlay-genres {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        justify-content: center;
    }

    .overlay-genres span {
        font-size: 10.5px;
        padding: 3px 8px;
        border-radius: var(--radius-pill);
        background: rgba(255,255,255,0.16);
        color: #fff;
        -webkit-backdrop-filter: blur(4px);
        backdrop-filter: blur(4px);
    }

    .grid .info { padding: 10px 2px 4px; }

    .grid .title {
        font-size: 14px;
        font-weight: 700;
        margin: 0;
        color: var(--text-color);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        line-height: 1.3;
    }

    .grid .meta {
        margin-top: 4px;
        font-size: 12px;
        color: var(--third-text-color);
    }

    /* ---------- Full row ---------- */
    .anime-card.full-row {
        flex-direction: row;
        gap: 18px;
        padding: 14px;
        margin: 0;
        background: var(--surface-2);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        transition: transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease), border-color var(--dur) var(--ease);
    }

    .full-row:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
        border-color: var(--border-strong);
    }

    .full-row .poster-container {
        position: relative;
        flex-shrink: 0;
        width: 130px;
        height: 188px;
        border-radius: var(--radius-sm);
        overflow: hidden;
        background: var(--surface-3);
    }

    .full-row .poster { width: 100%; height: 100%; object-fit: cover; }
    .full-row .poster-shade,
    .full-row .hover-overlay { display: none; }

    .full-row .info {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
    }

    .full-row .title {
        font-size: 1.2rem;
        font-weight: 800;
        letter-spacing: -0.01em;
        margin: 0 0 4px;
        color: var(--text-color);
    }

    .full-row .alt-title {
        font-size: 0.85rem;
        color: var(--secondary-text-color);
        margin: 0 0 10px;
    }

    .full-row .description {
        font-size: 0.875rem;
        color: var(--secondary-text-color);
        line-height: 1.55;
        margin: 0 0 12px;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .full-row .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        font-size: 0.85rem;
        color: var(--secondary-text-color);
        margin-top: auto;
    }

    .genres {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 12px;
    }

    .genre {
        padding: 4px 11px;
        background: var(--surface-3);
        border-radius: var(--radius-pill);
        font-size: 12px;
        color: var(--secondary-text-color);
    }

    .poster-fallback {
        background: linear-gradient(135deg, var(--surface-3), var(--surface-1));
    }

    /* ---------- Badges ---------- */
    .badges {
        position: absolute;
        top: 8px;
        left: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        z-index: 2;
    }

    .badge {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 3px 7px;
        border-radius: var(--radius-xs);
        font-size: 10.5px;
        font-weight: 700;
        line-height: 1;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        -webkit-backdrop-filter: blur(6px);
        backdrop-filter: blur(6px);
    }

    .badge.status.ongoing { background: rgba(82,182,40,0.92); color: #fff; }
    .badge.status.completed { background: rgba(69,119,183,0.92); color: #fff; }
    .badge.status.announced { background: rgba(147,20,220,0.92); color: #fff; }

    .badge.age { background: rgba(0,0,0,0.6); color: #fff; }

    .badge.grade {
        position: absolute;
        top: 8px;
        right: 8px;
        left: auto;
        background: rgba(0,0,0,0.62);
        color: #ffce4d;
        z-index: 2;
        font-size: 11px;
    }
    .badge.grade svg { width: 11px; height: 11px; }

    /* ---------- Mobile ---------- */
    @media (max-width: 768px) {
        .anime-card.full-row {
            gap: 12px;
            padding: 12px;
        }
        .full-row .poster-container { width: 96px; height: 140px; }
        .full-row .title { font-size: 1rem; }
        .full-row .description,
        .full-row .alt-title { display: none; }
        .grid:hover .poster-container,
        .grid:hover .poster {
            transform: none;
        }
        .grid .poster-container { border-radius: 12px; }
        .grid .info { padding: 8px 1px 2px; }
        .grid .title {
            font-size: 13px;
            line-height: 1.25;
        }
        .grid .meta {
            margin-top: 3px;
            font-size: 11px;
        }
        .hover-overlay,
        .poster-shade {
            display: none;
        }
        .badges {
            top: 7px;
            left: 7px;
            right: 7px;
            gap: 4px;
        }
        .badge {
            padding: 3px 6px;
            border-radius: 6px;
            font-size: 9.5px;
            max-width: 100%;
        }
        .badge.grade {
            top: 7px;
            right: 7px;
            font-size: 10px;
        }
        .badge.grade svg {
            width: 10px;
            height: 10px;
        }
    }
</style>
