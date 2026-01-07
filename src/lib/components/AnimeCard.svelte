<script>
    import { returnEpisodeString, getAgeRate } from '$lib/utils';
    
    export let anime;
    export let type = 'full-row';
    
    $: episodeText = returnEpisodeString(anime);
    $: ageRate = getAgeRate(anime.age_rating);
    
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
            case 1: return 'Завершен';
            case 2: return 'Онгоинг';
            case 3: return 'Анонс';
            default: return '';
        }
    }
</script>

<a href="/release/{anime.id}" class="anime-card {type}">
    <div class="poster-container">
        <img 
            src={anime.image} 
            alt={anime.title_ru} 
            class="poster"
            loading="lazy"
        />
        {#if anime.status}
            <span class="status-badge {getStatusClass(anime.status)}">
                {getStatusText(anime.status)}
            </span>
        {/if}
        <span class="age-badge">{ageRate}</span>
    </div>
    
    <div class="info">
        <h3 class="title">{anime.title_ru}</h3>
        
        {#if type === 'full-row'}
            <p class="alt-title">{anime.title_original || ''}</p>
            <p class="description">{anime.description?.slice(0, 200) || ''}{anime.description?.length > 200 ? '...' : ''}</p>
        {/if}
        
        <div class="meta">
            <span class="episodes">{episodeText} эп.</span>
            {#if anime.grade}
                <span class="rating">★ {anime.grade.toFixed(1)}</span>
            {/if}
            {#if anime.year}
                <span class="year">{anime.year}</span>
            {/if}
        </div>
        
        {#if type === 'full-row' && anime.genres}
            <div class="genres">
                {#if typeof anime.genres === 'string'}
                    {#each anime.genres.split(',').slice(0, 4).map(g => g.trim()).filter(g => g) as genre}
                        <span class="genre">{genre}</span>
                    {/each}
                {:else if Array.isArray(anime.genres)}
                    {#each anime.genres.slice(0, 4) as genre}
                        <span class="genre">{genre.name || genre}</span>
                    {/each}
                {/if}
            </div>
        {/if}
    </div>
</a>

<style>
    .anime-card {
        display: flex;
        text-decoration: none;
        color: inherit;
        background-color: var(--alt-background-color);
        border-radius: 12px;
        overflow: hidden;
        transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .anime-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
    }
    
    /* Full row layout */
    .anime-card.full-row {
        flex-direction: row;
        margin: 10px 20px;
        padding: 15px;
        gap: 20px;
    }
    
    .full-row .poster-container {
        position: relative;
        flex-shrink: 0;
    }
    
    .full-row .poster {
        width: 140px;
        height: 200px;
        object-fit: cover;
        border-radius: 8px;
    }
    
    .full-row .info {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
    }
    
    .full-row .title {
        font-size: 1.25em;
        font-weight: bold;
        margin: 0 0 5px 0;
        color: var(--text-color);
    }
    
    .full-row .alt-title {
        font-size: 0.875em;
        color: var(--secondary-text-color);
        margin: 0 0 10px 0;
    }
    
    .full-row .description {
        font-size: 0.875em;
        color: var(--text-color);
        line-height: 1.5;
        margin: 0 0 10px 0;
        opacity: 0.8;
    }
    
    /* Grid card layout */
    .anime-card.grid {
        flex-direction: column;
        width: 100%;
    }
    
    .grid .poster-container {
        position: relative;
        width: 100%;
        aspect-ratio: 2/3;
    }
    
    .grid .poster {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    
    .grid .info {
        padding: 12px;
    }
    
    .grid .title {
        font-size: 0.9em;
        font-weight: 600;
        margin: 0 0 5px 0;
        color: var(--text-color);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
    
    /* Common styles */
    .status-badge {
        position: absolute;
        top: 8px;
        left: 8px;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
    }
    
    .status-badge.ongoing {
        background-color: var(--watching-color);
        color: white;
    }
    
    .status-badge.completed {
        background-color: var(--completed-color);
        color: white;
    }
    
    .status-badge.announced {
        background-color: var(--plan-color);
        color: white;
    }
    
    .age-badge {
        position: absolute;
        top: 8px;
        right: 8px;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
    }
    
    .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        font-size: 0.875em;
        color: var(--secondary-text-color);
    }
    
    .rating {
        color: #ffc107;
    }
    
    .genres {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 10px;
    }
    
    .genre {
        padding: 4px 10px;
        background-color: var(--background-color);
        border-radius: 20px;
        font-size: 12px;
        color: var(--secondary-text-color);
    }
    
    /* Mobile responsive */
    @media (max-width: 768px) {
        .anime-card.full-row {
            margin: 8px 12px;
            padding: 12px;
            gap: 12px;
        }
        
        .full-row .poster {
            width: 100px;
            height: 150px;
        }
        
        .full-row .title {
            font-size: 1em;
        }
        
        .full-row .description {
            display: none;
        }
        
        .full-row .alt-title {
            display: none;
        }
    }
</style>
