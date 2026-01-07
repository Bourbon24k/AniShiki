<script>
    import { page } from '$app/stores';
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { getApi } from '$lib/api';
    import { playerSettings } from '$lib/stores';
    import { returnFormatedTime } from '$lib/utils';
    import Preloader from '$lib/components/Preloader.svelte';

    $: releaseId = $page.params.id;
    $: pSettings = $playerSettings;

    let release = null;
    let dubbers = [];
    let sources = [];
    let episodes = [];
    let selectedDubber = null;
    let selectedSource = null;
    let selectedEpisode = null;
    let videoUrl = '';
    let isLoading = true;
    let isLoadingEpisodes = false;
    let isLoadingVideo = false;
    let error = null;
    let api = null;

    // Player state
    let isFullscreen = false;
    let showEpisodeSelector = false;
    let showDubberSelector = false;
    let isMobile = false;

    function syncMobileState() {
        if (!browser) return;
        isMobile = window.innerWidth <= 768;

        // On mobile, default sections should be open so the user sees the selectors under the player.
        if (isMobile) {
            showDubberSelector = true;
            showEpisodeSelector = true;
        }
    }

    onMount(() => {
        if (browser) {
            api = getApi();
            loadRelease();
            syncMobileState();
            document.addEventListener('fullscreenchange', handleFullscreenChange);

            const handleResize = () => {
                syncMobileState();
            };
            window.addEventListener('resize', handleResize);

            return () => {
                document.removeEventListener('fullscreenchange', handleFullscreenChange);
                window.removeEventListener('resize', handleResize);
            };
        }
    });

    async function loadRelease() {
        if (!api) return;
        isLoading = true;
        error = null;
        try {
            // Load release info
            const data = await api.release.info(releaseId, true);
            console.log('Release data:', data);
            
            if (data.release) {
                release = data.release;
                
                // Load dubbers (voice actors)
                await loadDubbers();
            } else {
                error = 'Релиз не найден';
            }
        } catch (e) {
            console.error('Error loading release:', e);
            error = 'Ошибка загрузки релиза';
        }
        isLoading = false;
    }

    async function loadDubbers() {
        try {
            const dubbersData = await api.release.getDubbers(releaseId);
            console.log('Dubbers:', dubbersData);
            dubbers = dubbersData.types || [];
            
            if (dubbers.length > 0) {
                await selectDubber(dubbers[0]);
            }
        } catch (e) {
            console.error('Error loading dubbers:', e);
        }
    }

    async function selectDubber(dubber) {
        selectedDubber = dubber;
        sources = [];
        episodes = [];
        selectedSource = null;
        selectedEpisode = null;
        
        try {
            // Load sources for this dubber
            const sourcesData = await api.release.getDubberSources(releaseId, dubber.id);
            console.log('Sources for dubber:', sourcesData);
            sources = sourcesData.sources || [];
            
            if (sources.length > 0) {
                await selectSource(sources[0]);
            }
        } catch (e) {
            console.error('Error loading sources:', e);
        }
    }

    async function selectSource(source) {
        selectedSource = source;
        episodes = [];
        selectedEpisode = null;
        isLoadingEpisodes = true;
        
        try {
            // Load episodes for this source
            const episodesData = await api.release.getEpisodes(releaseId, selectedDubber.id, source.id);
            console.log('Episodes:', episodesData);
            episodes = episodesData.episodes || [];
            
            if (episodes.length > 0) {
                await selectEpisode(episodes[0]);
            }
        } catch (e) {
            console.error('Error loading episodes:', e);
        }
        isLoadingEpisodes = false;
    }

    async function selectEpisode(episode) {
        selectedEpisode = episode;
        await loadVideoUrl();
        
        // Add to history and mark as watched
        if (api && selectedSource) {
            try {
                await api.release.addToHistory(releaseId, selectedSource.id, episode.position);
                await api.release.markEpisodeAsWatched(releaseId, selectedSource.id, episode.position);
            } catch (e) {
                console.error('Error updating history:', e);
            }
        }
    }

    async function loadVideoUrl() {
        if (!selectedEpisode) return;
        
        isLoadingVideo = true;
        videoUrl = '';
        
        try {
            console.log('Loading video for episode:', selectedEpisode);
            
            // Get the episode URL
            let episodeUrl = selectedEpisode.url;
            const sourceName = selectedSource?.name || '';
            console.log('Source name:', sourceName, 'URL:', episodeUrl);
            
            if (episodeUrl) {
                // Make sure URL has protocol
                const fullUrl = episodeUrl.startsWith('http') ? episodeUrl : `https:${episodeUrl}`;
                videoUrl = fullUrl;
                console.log('Video URL:', videoUrl);
            } else {
                console.log('No URL found for episode');
            }
        } catch (e) {
            console.error('Error loading video:', e);
        }
        isLoadingVideo = false;
    }

    function handleFullscreenChange() {
        isFullscreen = !!document.fullscreenElement;
    }

    function goBack() {
        goto(`/release/${releaseId}`);
    }

    function getEpisodeIndex() {
        if (!selectedEpisode) return -1;
        const pos = Number(selectedEpisode.position);
        if (!Number.isNaN(pos)) {
            const idxByPos = episodes.findIndex(e => Number(e.position) === pos);
            if (idxByPos !== -1) return idxByPos;
        }
        if (selectedEpisode.id != null) {
            const idxById = episodes.findIndex(e => e.id === selectedEpisode.id);
            if (idxById !== -1) return idxById;
        }
        return episodes.findIndex(e => e.url && selectedEpisode.url && e.url === selectedEpisode.url);
    }

    $: currentEpisodeIndex = getEpisodeIndex();
    $: canPrev = currentEpisodeIndex > 0;
    $: canNext = currentEpisodeIndex >= 0 && currentEpisodeIndex < episodes.length - 1;
    $: currentDubberName = selectedDubber?.name || '';
    $: currentSourceName = selectedSource?.name || '';
    $: currentEpisodeName = selectedEpisode ? `Эпизод ${selectedEpisode.position}` : '';

    function nextEpisode() {
        if (!canNext) return;
        selectEpisode(episodes[currentEpisodeIndex + 1]);
    }

    function prevEpisode() {
        if (!canPrev) return;
        selectEpisode(episodes[currentEpisodeIndex - 1]);
    }
</script>

<svelte:head>
    <title>{release?.title_ru || 'Плеер'} - AniShika</title>
</svelte:head>

<div class="player-page">
    {#if isLoading}
        <Preloader size="large" />
    {:else if error}
        <div class="error-state">
            <h2>😔 {error}</h2>
            <a href="/" class="back-btn">Вернуться на главную</a>
        </div>
    {:else if release}
        <div 
            class="player-container" 
            class:fullscreen={isFullscreen}
        >
            <!-- Video element -->
            <div class="video-wrapper">
                {#if videoUrl}
                    <!-- All sources use iframe since they are embed URLs -->
                    <iframe 
                        src={videoUrl}
                        class="video-iframe"
                        allowfullscreen
                        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                        title="Video Player"
                        referrerpolicy="origin"
                    ></iframe>
                {:else if isLoadingVideo}
                    <div class="video-loading">
                        <Preloader />
                    </div>
                {:else}
                    <div class="video-placeholder">
                        <p>Выберите эпизод для воспроизведения</p>
                    </div>
                {/if}
            </div>

            <!-- Simple top bar with back button and title -->
            <div class="player-top-bar">
                <button class="back-btn" on:click={goBack} title="Назад">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                    </svg>
                </button>
                <div class="title-info">
                    <span class="anime-title">{release.title_ru}</span>
                    {#if selectedEpisode}
                        <span class="episode-title">• Эпизод {selectedEpisode.position}</span>
                    {/if}
                    {#if selectedDubber}
                        <span class="dubber-title">• {selectedDubber.name}{selectedSource?.name ? ` (${selectedSource.name})` : ''}</span>
                    {/if}
                </div>
                {#if !isMobile}
                    <div class="nav-buttons">
                        <button class="nav-btn" on:click={prevEpisode} title="Предыдущий эпизод" disabled={!canPrev}>
                            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                            </svg>
                        </button>
                        <button class="nav-btn" on:click={nextEpisode} title="Следующий эпизод" disabled={!canNext}>
                            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                            </svg>
                        </button>
                    </div>
                {/if}
            </div>
        </div>

        <!-- Mobile controls panel under player -->
        {#if isMobile}
            <div class="mobile-controls-panel">
                <!-- Dubber selector -->
                {#if dubbers.length > 0}
                    <div class="mobile-section">
                        <div class="mobile-section-header">
                            <h3>Озвучка</h3>
                            <button 
                                class="toggle-section-btn" 
                                aria-label={showDubberSelector ? 'Свернуть список озвучек' : 'Показать список озвучек'}
                                title={showDubberSelector ? 'Свернуть' : 'Показать'}
                                on:click={() => showDubberSelector = !showDubberSelector}
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" class:rotated={showDubberSelector}>
                                    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                                </svg>
                            </button>
                        </div>
                        {#if currentDubberName}
                            <div class="mobile-current">{currentDubberName}{currentSourceName ? ` • ${currentSourceName}` : ''}</div>
                        {/if}
                        {#if showDubberSelector}
                            <div class="mobile-dubbers-grid">
                                {#each dubbers as dubber}
                                    <button 
                                        class="mobile-dubber-btn"
                                        class:active={selectedDubber?.id === dubber.id}
                                        on:click={() => selectDubber(dubber)}
                                    >
                                        <span class="dubber-name">{dubber.name}</span>
                                        <span class="dubber-count">{dubber.episodes_count} эп.</span>
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/if}

                <!-- Source selector -->
                {#if sources.length > 0 && showDubberSelector}
                    <div class="mobile-section">
                        <h4 class="mobile-subsection-title">Источник</h4>
                        <div class="mobile-sources-grid">
                            {#each sources as source}
                                <button 
                                    class="mobile-source-btn"
                                    class:active={selectedSource?.id === source.id}
                                    on:click={() => selectSource(source)}
                                >
                                    {source.name}
                                </button>
                            {/each}
                        </div>
                    </div>
                {/if}

                <!-- Episode selector -->
                <div class="mobile-section">
                    <div class="mobile-section-header">
                        <h3>Эпизоды ({episodes.length})</h3>
                        <button 
                            class="toggle-section-btn" 
                            aria-label={showEpisodeSelector ? 'Свернуть список эпизодов' : 'Показать список эпизодов'}
                            title={showEpisodeSelector ? 'Свернуть' : 'Показать'}
                            on:click={() => showEpisodeSelector = !showEpisodeSelector}
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" class:rotated={showEpisodeSelector}>
                                <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                            </svg>
                        </button>
                    </div>
                    {#if currentEpisodeName}
                        <div class="mobile-current">{currentEpisodeName}</div>
                    {/if}
                    {#if showEpisodeSelector}
                        {#if isLoadingEpisodes}
                            <div class="mobile-loading">
                                <Preloader size="small" />
                            </div>
                        {:else if episodes.length > 0}
                            <div class="mobile-episodes-grid">
                                {#each episodes as episode}
                                    <button 
                                        class="mobile-episode-btn"
                                        class:active={selectedEpisode?.position === episode.position}
                                        on:click={() => selectEpisode(episode)}
                                    >
                                        {episode.position}
                                    </button>
                                {/each}
                            </div>
                        {:else}
                            <p class="mobile-no-content">Выберите озвучку</p>
                        {/if}
                    {/if}
                </div>

                <!-- Navigation buttons -->
                {#if selectedEpisode}
                    <div class="mobile-nav-buttons">
                        <button 
                            class="mobile-nav-btn" 
                            on:click={prevEpisode} 
                            disabled={!canPrev}
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                            </svg>
                            <span>Предыдущий</span>
                        </button>
                        <button 
                            class="mobile-nav-btn" 
                            on:click={nextEpisode} 
                            disabled={!canNext}
                        >
                            <span>Следующий</span>
                            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                            </svg>
                        </button>
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Desktop episode selector panel -->
        {#if !isFullscreen && !isMobile}
            <div class="episodes-panel">
                <!-- Dubber selector (voice acting) -->
                {#if dubbers.length > 0}
                    <div class="panel-section">
                        <h3>Озвучка</h3>
                        <div class="dubbers-selector">
                            {#each dubbers as dubber}
                                <button 
                                    class="dubber-btn"
                                    class:active={selectedDubber?.id === dubber.id}
                                    on:click={() => selectDubber(dubber)}
                                >
                                    {dubber.name}
                                    <span class="dubber-info">{dubber.episodes_count} эп.</span>
                                </button>
                            {/each}
                        </div>
                    </div>
                {/if}

                <!-- Source selector -->
                {#if sources.length > 0}
                    <div class="panel-section">
                        <h3>Источник</h3>
                        <div class="sources-selector">
                            {#each sources as source}
                                <button 
                                    class="source-btn"
                                    class:active={selectedSource?.id === source.id}
                                    on:click={() => selectSource(source)}
                                >
                                    {source.name}
                                </button>
                            {/each}
                        </div>
                    </div>
                {/if}

                <!-- Episode selector -->
                <div class="panel-section">
                    <h3>Эпизоды ({episodes.length})</h3>
                    {#if isLoadingEpisodes}
                        <Preloader size="small" />
                    {:else if episodes.length > 0}
                        <div class="episodes-grid">
                            {#each episodes as episode}
                                <button 
                                    class="episode-btn"
                                    class:active={selectedEpisode?.position === episode.position}
                                    on:click={() => selectEpisode(episode)}
                                    title={episode.name || `Эпизод ${episode.position}`}
                                >
                                    {episode.position}
                                </button>
                            {/each}
                        </div>
                    {:else}
                        <p class="no-episodes">Выберите озвучку и источник</p>
                    {/if}
                </div>

                <!-- Current episode info -->
                {#if selectedEpisode}
                    <div class="current-episode-info">
                        <span class="episode-name">{selectedEpisode.name || `Эпизод ${selectedEpisode.position}`}</span>
                    </div>
                {/if}
            </div>
        {/if}
    {/if}
</div>

<style>
    .player-page {
        width: 100%;
        min-height: 100%;
        background-color: #000;
    }

    .player-container {
        position: relative;
        width: 100%;
        aspect-ratio: 16/9;
        background-color: #000;
        overflow: hidden;
    }

    .player-container.fullscreen {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        aspect-ratio: unset;
        z-index: 9999;
    }

    .video-wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .video-wrapper video {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }

    .video-iframe {
        width: 100%;
        height: 100%;
        border: none;
    }

    .player-top-bar {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        display: flex;
        align-items: center;
        padding: 12px 16px;
        background: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent);
        z-index: 10;
    }

    .back-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 50%;
        background: rgba(0,0,0,0.6);
        color: white;
        cursor: pointer;
        transition: all 0.2s;
        text-decoration: none;
    }

    .back-btn:hover {
        background: rgba(0,0,0,0.8);
    }

    .back-btn:active {
        background: rgba(0,0,0,0.9);
        transform: scale(0.95);
    }

    .back-btn svg {
        width: 24px;
        height: 24px;
    }

    .title-info {
        flex: 1;
        margin-left: 16px;
        color: white;
    }

    .anime-title {
        font-size: 20px;
        font-weight: 700;
        line-height: 1.3;
    }

    .episode-title {
        font-size: 14px;
        opacity: 0.8;
        margin-left: 8px;
    }

    .dubber-title {
        font-size: 13px;
        opacity: 0.8;
        margin-left: 8px;
        display: inline-block;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .nav-buttons {
        display: flex;
        gap: 8px;
    }

    .nav-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border: none;
        border-radius: 50%;
        background: rgba(0,0,0,0.5);
        color: white;
        cursor: pointer;
        transition: background 0.2s;
    }

    .nav-btn:hover:not(:disabled) {
        background: rgba(0,0,0,0.7);
    }

    .nav-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .nav-btn svg {
        width: 20px;
        height: 20px;
    }

    .video-placeholder,
    .video-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        color: var(--secondary-text-color);
    }

    .player-controls {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        opacity: 0;
        transition: opacity 0.3s;
        pointer-events: none;
    }

    .player-controls.visible {
        opacity: 1;
        pointer-events: auto;
    }

    .controls-top {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px;
        background: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent);
    }

    .title-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .anime-title {
        font-size: 16px;
        font-weight: 600;
        color: white;
    }

    .episode-title {
        font-size: 13px;
        color: rgba(255,255,255,0.7);
    }

    .controls-center {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 30px;
    }

    .controls-bottom {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 20px;
        background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
    }

    .progress-bar {
        width: 100%;
        height: 20px;
        display: flex;
        align-items: center;
        cursor: pointer;
    }

    .progress-track {
        width: 100%;
        height: 4px;
        background: rgba(255,255,255,0.3);
        border-radius: 2px;
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        background: var(--primary-color);
        transition: width 0.1s;
    }

    .controls-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .left-controls,
    .right-controls {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .time-display {
        font-size: 13px;
        color: white;
        font-family: monospace;
    }

    .volume-control {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .volume-slider {
        width: 80px;
        height: 4px;
        -webkit-appearance: none;
        background: rgba(255,255,255,0.3);
        border-radius: 2px;
        cursor: pointer;
    }

    .volume-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 12px;
        height: 12px;
        background: white;
        border-radius: 50%;
    }

    .control-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        color: white;
        cursor: pointer;
        transition: transform 0.2s;
    }

    .control-btn:hover {
        transform: scale(1.1);
    }

    .control-btn svg {
        width: 28px;
        height: 28px;
    }

    .control-btn.play svg {
        width: 60px;
        height: 60px;
    }

    .control-btn.small svg {
        width: 24px;
        height: 24px;
    }

    .episodes-panel {
        padding: 20px;
        background-color: var(--background-color);
    }

    .panel-section {
        margin-bottom: 20px;
    }

    .panel-section:last-child {
        margin-bottom: 0;
    }

    .episodes-panel h3 {
        font-size: 16px;
        margin: 0 0 12px;
        color: var(--text-color);
        font-weight: 600;
    }

    .current-episode-info {
        padding: 12px;
        background-color: var(--alt-background-color);
        border-radius: 8px;
        margin-top: 16px;
    }

    .episode-name {
        font-size: 14px;
        color: var(--text-color);
    }

    .dubbers-selector,
    .sources-selector {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }

    .dubber-btn {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 10px 16px;
        border: none;
        border-radius: 8px;
        background-color: var(--alt-background-color);
        color: var(--text-color);
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .dubber-btn .dubber-info {
        font-size: 11px;
        color: var(--secondary-text-color);
        margin-top: 2px;
    }

    .dubber-btn.active {
        background-color: var(--primary-color);
        color: white;
    }

    .dubber-btn.active .dubber-info {
        color: rgba(255, 255, 255, 0.8);
    }

    .source-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        background-color: var(--alt-background-color);
        color: var(--secondary-text-color);
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .source-btn.active {
        background-color: var(--primary-color);
        color: white;
    }

    .no-episodes {
        color: var(--secondary-text-color);
        font-size: 14px;
        padding: 20px 0;
    }

    .episodes-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .episode-btn {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: 8px;
        background-color: var(--alt-background-color);
        color: var(--text-color);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }

    .episode-btn:hover {
        filter: brightness(1.2);
    }

    .episode-btn.active {
        background-color: var(--primary-color);
        color: white;
    }

    .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 50vh;
        color: white;
        text-align: center;
    }

    .back-btn {
        padding: 12px 24px;
        background: var(--primary-color);
        color: white;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 500;
        margin-top: 20px;
    }

    /* Mobile controls panel */
    .mobile-controls-panel {
        background: var(--background-color);
        padding: 16px;
        padding-bottom: 96px;
    }

    .mobile-back {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 12px 14px;
        margin-bottom: 12px;
        border: none;
        border-radius: 12px;
        background: var(--alt-background-color);
        color: var(--text-color);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
    }

    .mobile-back:active {
        background: var(--primary-color);
        color: white;
    }

    .mobile-current {
        margin: 8px 0 10px;
        padding: 10px 12px;
        border-radius: 10px;
        background: var(--background-color);
        color: var(--secondary-text-color);
        font-size: 13px;
        line-height: 1.3;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .mobile-section {
        margin-bottom: 16px;
        background: var(--alt-background-color);
        border-radius: 12px;
        padding: 12px;
    }

    .mobile-section:last-child {
        margin-bottom: 0;
    }

    .mobile-section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
    }

    .mobile-section-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--text-color);
    }

    .toggle-section-btn {
        width: 32px;
        height: 32px;
        border: none;
        background: var(--background-color);
        color: var(--text-color);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
    }

    .toggle-section-btn:active {
        background: var(--primary-color);
        color: white;
    }

    .toggle-section-btn svg {
        transition: transform 0.2s;
    }

    .toggle-section-btn svg.rotated {
        transform: rotate(180deg);
    }

    .mobile-subsection-title {
        margin: 0 0 8px 0;
        font-size: 14px;
        font-weight: 500;
        color: var(--secondary-text-color);
    }

    .mobile-dubbers-grid {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .mobile-dubber-btn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        background: var(--background-color);
        border: 2px solid transparent;
        border-radius: 10px;
        color: var(--text-color);
        cursor: pointer;
        transition: all 0.2s;
        text-align: left;
    }

    .mobile-dubber-btn.active {
        background: var(--primary-color);
        border-color: var(--primary-color);
        color: white;
    }

    .mobile-dubber-btn .dubber-name {
        font-size: 15px;
        font-weight: 500;
    }

    .mobile-dubber-btn .dubber-count {
        font-size: 13px;
        opacity: 0.8;
    }

    .mobile-sources-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .mobile-source-btn {
        padding: 10px 16px;
        background: var(--background-color);
        border: 2px solid transparent;
        border-radius: 8px;
        color: var(--text-color);
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .mobile-source-btn.active {
        background: var(--primary-color);
        border-color: var(--primary-color);
        color: white;
    }

    .mobile-episodes-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
        gap: 8px;
    }

    .mobile-episode-btn {
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--background-color);
        border: 2px solid transparent;
        border-radius: 10px;
        color: var(--text-color);
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }

    .mobile-episode-btn.active {
        background: var(--primary-color);
        border-color: var(--primary-color);
        color: white;
        transform: scale(1.05);
    }

    .mobile-loading {
        padding: 20px;
        display: flex;
        justify-content: center;
    }

    .mobile-no-content {
        padding: 20px;
        text-align: center;
        color: var(--secondary-text-color);
        font-size: 14px;
        margin: 0;
    }

    .mobile-nav-buttons {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 12px;
    }

    .mobile-nav-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 14px 16px;
        background: var(--primary-color);
        border: none;
        border-radius: 10px;
        color: white;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }

    .mobile-nav-btn:disabled {
        background: var(--alt-background-color);
        color: var(--secondary-text-color);
        opacity: 0.5;
        cursor: not-allowed;
    }

    .mobile-nav-btn:active:not(:disabled) {
        transform: scale(0.98);
    }

    @media (max-width: 768px) {
        .control-btn.play svg {
            width: 48px;
            height: 48px;
        }

        .volume-control {
            display: none;
        }

        .episodes-panel {
            padding: 16px;
        }

        .episode-btn {
            width: 40px;
            height: 40px;
            font-size: 12px;
        }
    }
</style>
