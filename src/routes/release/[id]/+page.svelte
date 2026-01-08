<script>
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { getApi } from '$lib/api';
    import { userToken } from '$lib/stores';
    import { returnSoonText, returnEpisodeString, getAgeRate, seasons } from '$lib/utils';
    import Preloader from '$lib/components/Preloader.svelte';

    $: releaseId = $page.params.id;
    $: utoken = $userToken;

    let release = null;
    let isLoading = true;
    let error = null;
    let isFavorite = false;
    let favoriteCount = 0;
    let currentBookmarkStatus = 0;
    let showBookmarkMenu = false;
    let api = null;

    const bookmarkOptions = [
        { id: 0, label: 'Убрать из списка', color: 'var(--secondary-text-color)' },
        { id: 1, label: 'Смотрю', color: 'var(--watching-color)' },
        { id: 2, label: 'В планах', color: 'var(--plan-color)' },
        { id: 3, label: 'Просмотрено', color: 'var(--completed-color)' },
        { id: 4, label: 'Отложено', color: 'var(--hold-on-color)' },
        { id: 5, label: 'Брошено', color: 'var(--dropped-color)' }
    ];

    onMount(() => {
        if (browser) {
            api = getApi();
            
            // Close bookmark menu on click outside
            document.addEventListener('click', handleClickOutside);
        }
        
        return () => {
            if (browser) {
                document.removeEventListener('click', handleClickOutside);
            }
        };
    });

    function handleClickOutside(e) {
        if (!e.target.closest('.bookmark-dropdown')) {
            showBookmarkMenu = false;
        }
    }

    let showAllComments = false;
    let showAllRelated = false;
    let videos = [];
    let allComments = [];
    let commentsPage = 0;
    let isLoadingComments = false;
    let hasMoreComments = false;

    // Comment replies state
    let expandedReplies = {};
    let commentReplies = {};

    let commentMessage = '';
    let commentIsSpoiler = false;
    let commentSubmitting = false;
    let commentError = '';
    let replyParentCommentId = null;
    let replyToProfileId = null;
    let replyToLogin = '';

    let loadedReleaseId = null;

    function getCommentDate(c) {
        const raw = c?.timestamp ?? c?.creation_date ?? c?.created_at ?? c?.createdAt ?? null;
        if (raw === null || raw === undefined) return null;
        const n = Number(raw);
        if (!Number.isFinite(n)) return null;
        const ms = n > 1e12 ? n : n * 1000;
        const d = new Date(ms);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    async function loadRelease(options = {}) {
        if (!api) return;

        const silent = !!options?.silent;

        if (loadedReleaseId !== releaseId) {
            loadedReleaseId = releaseId;
            release = null;
            showBookmarkMenu = false;
            showAllComments = false;
            showAllRelated = false;
            videos = [];
            allComments = [];
            commentsPage = 0;
            isLoadingComments = false;
            hasMoreComments = false;
            expandedReplies = {};
            commentReplies = {};
        }

        if (!silent) {
            isLoading = true;
        }
        error = null;
        try {
            const data = await api.release.info(releaseId, true);
            if (data.release) {
                release = data.release;
                isFavorite = release.is_favorite;
                favoriteCount = release.favorites_count;
                currentBookmarkStatus = release.profile_list_status || 0;
                
                // Load videos/trailers
                try {
                    const videosData = await api.release.getVideos(releaseId);
                    videos = videosData.content || [];
                } catch (e) {
                    console.error('Error loading videos:', e);
                }
                
                // Initialize all comments with first batch
                allComments = release.comments || [];
                commentsPage = 0;
                hasMoreComments = ((release.comments_count ?? release.comment_count) || 0) > allComments.length;
            } else {
                error = 'Релиз не найден';
            }
        } catch (e) {
            console.error('Error loading release:', e);
            error = 'Ошибка загрузки релиза';
        }
        if (!silent) {
            isLoading = false;
        }
    }

    $: if (browser && api && releaseId) {
        loadRelease();
    }

    function goBack() {
        if (browser && window.history.length > 1) {
            window.history.back();
            return;
        }
        goto('/');
    }

    // Comments come with release.comments from the API
    $: comments = showAllComments ? allComments : allComments.slice(0, 5);

    // Rating state
    let userRating = 0;
    let userRatingStars = 0;
    $: userRating = release?.your_vote ?? release?.my_vote ?? 0;
    $: userRatingStars = userRating > 5 ? Math.round(Number(userRating) / 2) : Number(userRating);
    $: userRatingStars = Math.max(0, Math.min(5, userRatingStars || 0));

    let isRatingModalOpen = false;
    let ratingSubmitting = false;

    function goToRelease(id) {
        goto(`/release/${id}`);
    }

    async function toggleReplies(comment) {
        if (!api) return;
        
        const commentId = comment.id;
        
        if (expandedReplies[commentId]) {
            expandedReplies[commentId] = false;
            expandedReplies = {...expandedReplies};
            return;
        }
        
        // Load replies if not already loaded
        if (!commentReplies[commentId]) {
            try {
                const data = await api.release.getCommentReplies({ id: commentId, page: 0, sort: 0 });
                commentReplies[commentId] = data.content || [];
                commentReplies = {...commentReplies};
            } catch (e) {
                console.error('Error loading replies:', e);
                commentReplies[commentId] = [];
            }
        }
        
        expandedReplies[commentId] = true;
        expandedReplies = {...expandedReplies};
    }

    async function toggleAllComments() {
        if (showAllComments) {
            showAllComments = false;
            return;
        }

        // Opening: make sure we have at least one extra page loaded when available
        // so that "Показать все" feels instant and not empty.
        if (hasMoreComments && allComments.length < ((release?.comments_count ?? release?.comment_count) || 0)) {
            await loadMoreComments();
        }
        showAllComments = true;
    }

    async function loadMoreComments() {
        if (!api || isLoadingComments || !hasMoreComments) return;
        
        isLoadingComments = true;
        const nextPage = commentsPage + 1;
        
        try {
            const data = await api.release.getComments({ id: releaseId, page: nextPage, sort: 0 });
            const newComments = data.content || [];
            allComments = [...allComments, ...newComments];
            commentsPage = nextPage;
            hasMoreComments = ((release?.comments_count ?? release?.comment_count) || 0) > allComments.length && newComments.length > 0;
        } catch (e) {
            console.error('Error loading more comments:', e);
            hasMoreComments = false;
        }
        
        isLoadingComments = false;
    }

    function startReplyTo(comment) {
        if (!comment) return;
        if (!utoken) {
            goto('/login');
            return;
        }

        replyParentCommentId = comment.id;
        replyToProfileId = comment.profile?.id ?? null;
        replyToLogin = comment.profile?.login ?? '';

        if (replyToLogin) {
            commentMessage = `@${replyToLogin}, `;
        }
    }

    function cancelReply() {
        replyParentCommentId = null;
        replyToProfileId = null;
        replyToLogin = '';
    }

    async function submitComment() {
        if (!api) return;
        if (!utoken) {
            goto('/login');
            return;
        }

        const message = String(commentMessage || '').trim();
        if (!message) return;

        commentError = '';
        commentSubmitting = true;

        try {
            const id = Number(releaseId);
            if (!Number.isFinite(id)) return;

            const data = await api.release.addComment(id, {
                parentCommentId: replyParentCommentId,
                replyToProfileId,
                message,
                isSpoiler: !!commentIsSpoiler
            });

            const newComment = data?.comment;
            if (newComment) {
                if (replyParentCommentId) {
                    // Update replies list if opened.
                    if (commentReplies[replyParentCommentId]) {
                        commentReplies[replyParentCommentId] = [...commentReplies[replyParentCommentId], newComment];
                        commentReplies = { ...commentReplies };
                    }

                    const parent = allComments.find(c => c?.id === replyParentCommentId);
                    if (parent) {
                        parent.reply_count = (parent.reply_count || 0) + 1;
                        allComments = [...allComments];
                    }
                } else {
                    allComments = [newComment, ...allComments];
                }

                if (release) {
                    if (release.comments_count != null) release.comments_count = Number(release.comments_count || 0) + 1;
                    if (release.comment_count != null) release.comment_count = Number(release.comment_count || 0) + 1;
                    release = { ...release };
                }
            }

            commentMessage = '';
            commentIsSpoiler = false;
            cancelReply();
        } catch (e) {
            console.error('Error adding comment:', e);
            commentError = 'Не удалось отправить комментарий';
        }

        commentSubmitting = false;
    }

    async function voteComment(comment, vote) {
        if (!api) return;
        if (!utoken) {
            goto('/login');
            return;
        }
        
        const prevVote = comment.vote;
        const prevLikes = comment.likes_count;
        
        // Calculate new likes count
        comment.likes_count = comment.likes_count + 
            (comment.vote == 0 ? (vote == 2 ? 1 : -1) : 
            (comment.vote != vote && vote == 2 ? 2 : 
            (comment.vote == vote ? (vote == 2 ? -1 : 1) : -2)));
        comment.vote = comment.vote == vote ? 0 : vote;
        
        // Force reactivity
        allComments = [...allComments];
        
        try {
            const result = await api.release.voteComment(comment.id, vote);
            if (result.code !== 0) {
                comment.vote = prevVote;
                comment.likes_count = prevLikes;
                allComments = [...allComments];
            }
        } catch (e) {
            console.error('Error voting comment:', e);
            comment.vote = prevVote;
            comment.likes_count = prevLikes;
            allComments = [...allComments];
        }
    }

    function openRatingModal() {
        if (!utoken) {
            goto('/login');
            return;
        }

        isRatingModalOpen = true;
    }

    async function refreshReleaseRatingFields() {
        if (!api) return;

        try {
            const data = await api.release.info(releaseId, true);
            const next = data?.release;
            if (!next || !release) return;

            release.grade = next.grade;
            release.vote_count = next.vote_count;

            for (const star of [1, 2, 3, 4, 5]) {
                const key = `vote_${star}_count`;
                if (next[key] !== undefined) {
                    release[key] = next[key];
                }
            }

            if (next.your_vote !== undefined) release.your_vote = next.your_vote;
            if (next.my_vote !== undefined) release.my_vote = next.my_vote;

            release = { ...release };
        } catch (e) {
            console.error('Error refreshing rating fields:', e);
        }
    }

    async function setRatingStars(stars) {
        if (!api) return;
        if (!utoken) {
            goto('/login');
            return;
        }

        const id = Number(releaseId);
        if (!Number.isFinite(id)) return;

        const nextStars = Math.max(0, Math.min(5, Math.trunc(Number(stars) || 0)));

        const prev = release?.your_vote ?? release?.my_vote ?? 0;
        ratingSubmitting = true;

        try {
            if (nextStars === 0) {
                await api.release.removeVote(id);
                if (release) {
                    release.your_vote = 0;
                    release.my_vote = 0;
                    release = { ...release };
                }
                userRating = 0;
            } else {
                await api.release.addVote(id, nextStars);
                if (release) {
                    release.your_vote = nextStars;
                    release.my_vote = nextStars;
                    release = { ...release };
                }
                userRating = nextStars;
            }

            await refreshReleaseRatingFields();
            isRatingModalOpen = false;
        } catch (e) {
            console.error('Error setting rating:', e);
            if (release) {
                release.your_vote = prev;
                release.my_vote = prev;
                release = { ...release };
            }
            userRating = prev;
        }

        ratingSubmitting = false;
    }

    async function toggleFavorite() {
        if (!api) return;
        if (!utoken) {
            goto('/login');
            return;
        }
        try {
            if (isFavorite) {
                await api.release.removeFavorite(releaseId);
                favoriteCount--;
            } else {
                await api.release.addFavorite(releaseId);
                favoriteCount++;
            }
            isFavorite = !isFavorite;
        } catch (e) {
            console.error('Error toggling favorite:', e);
        }
    }

    async function setBookmarkStatus(status) {
        if (!api) return;
        if (!utoken) {
            goto('/login');
            return;
        }
        
        showBookmarkMenu = false;
        
        try {
            // Use addToProfileList like in original code
            await api.release.addToProfileList(releaseId, status);
            currentBookmarkStatus = status;
            console.log('Bookmark set to:', status);
        } catch (e) {
            console.error('Error setting bookmark:', e);
        }
    }

    function toggleBookmarkMenu(e) {
        e.stopPropagation();
        if (!utoken) {
            goto('/login');
            return;
        }
        showBookmarkMenu = !showBookmarkMenu;
    }

    function getBookmarkClass(status) {
        switch(status) {
            case 1: return 'watching';
            case 2: return 'plan';
            case 3: return 'completed';
            case 4: return 'hold-on';
            case 5: return 'dropped';
            default: return '';
        }
    }

    function getBookmarkText(status) {
        switch(status) {
            case 1: return 'Смотрю';
            case 2: return 'В планах';
            case 3: return 'Просмотрено';
            case 4: return 'Отложено';
            case 5: return 'Брошено';
            default: return 'Добавить в список';
        }
    }
</script>

<svelte:head>
    <title>{release?.title_ru || 'Загрузка...'} - AniShika</title>
</svelte:head>

<div class="release-page">
    {#if isLoading}
        <Preloader size="large" />
    {:else if error}
        <div class="error-state">
            <h2>😔 {error}</h2>
            <a href="/" class="back-btn">Вернуться на главную</a>
        </div>
    {:else if release}
        <div class="release-top-actions">
            <button class="release-back" on:click={goBack}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                </svg>
                Назад
            </button>
        </div>
        <div class="release-content">
            <!-- Left side - Poster and actions -->
            <div class="left-panel">
                <div class="poster-wrapper">
                    <img src={release.image} alt={release.title_ru} class="poster" />
                    {#if release.age_rating}
                        <span class="age-badge">{getAgeRate(release.age_rating)}</span>
                    {/if}
                </div>

                <!-- Play button -->
                {#if release.is_view_blocked}
                    <button class="action-btn blocked" disabled>
                        Недоступно в вашем регионе
                    </button>
                {:else if !release.episodes_released}
                    <button class="action-btn soon" disabled>
                        {returnSoonText(release)}
                    </button>
                {:else}
                    <a href="/player/{release.id}" class="action-btn play">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        Смотреть
                    </a>
                {/if}

                <!-- Bookmark button with dropdown -->
                <div class="bookmark-dropdown">
                    <button 
                        class="action-btn bookmark {getBookmarkClass(currentBookmarkStatus)}"
                        on:click={toggleBookmarkMenu}
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                            <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
                        </svg>
                        {getBookmarkText(currentBookmarkStatus)}
                        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" class="arrow">
                            <path d="M7 10l5 5 5-5z"/>
                        </svg>
                    </button>
                    
                    {#if showBookmarkMenu}
                        <div class="bookmark-menu">
                            {#each bookmarkOptions as option}
                                {#if option.id !== 0 || currentBookmarkStatus !== 0}
                                    <button 
                                        class="bookmark-option"
                                        class:active={currentBookmarkStatus === option.id}
                                        style="--option-color: {option.color}"
                                        on:click={() => setBookmarkStatus(option.id)}
                                    >
                                        {option.label}
                                    </button>
                                {/if}
                            {/each}
                        </div>
                    {/if}
                </div>

                <!-- Favorite button -->
                <button 
                    class="action-btn favorite" 
                    class:active={isFavorite}
                    on:click={toggleFavorite}
                >
                    <svg viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" width="20" height="20">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    {favoriteCount}
                </button>

                <!-- Rating with graph -->
            </div>

            <!-- Right side - Info -->
            <div class="right-panel">
                <h1 class="title">{release.title_ru}</h1>
                <h2 class="alt-title">{release.title_original}</h2>

                {#if release.note}
                    <div class="note">
                        {@html release.note}
                    </div>
                {/if}

                <!-- Info list with icons -->
                <div class="info-list">
                    <!-- Country & Year -->
                    {#if release.country || release.year}
                        <div class="info-row">
                            <svg class="info-icon-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                            <span class="info-text">{typeof release.country === 'string' ? release.country : (release.country?.name || 'Неизвестно')}{release.year ? `, ${release.year} г.` : ''}</span>
                        </div>
                    {/if}
                    
                    <!-- Episodes & Duration -->
                    {#if release.episodes_released || release.episodes_total || release.duration}
                        <div class="info-row">
                            <svg class="info-icon-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9 8h2v8H9zm4 0h2v8h-2z"/></svg>
                            <span class="info-text">{returnEpisodeString(release)} эп.{release.duration ? ` по ~${release.duration} мин.` : ''}</span>
                        </div>
                    {/if}
                    
                    <!-- Type & Status -->
                    {#if release.type || release.status}
                        <div class="info-row">
                            <svg class="info-icon-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/></svg>
                            <span class="info-text">{release.type?.name || ''}{release.type && release.status ? ', ' : ''}{release.status?.name || ''}</span>
                        </div>
                    {/if}
                    
                    <!-- Studios -->
                    {#if release.studios?.length}
                        <div class="info-row">
                            <svg class="info-icon-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M18 4V3c0-.55-.45-1-1-1H5c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V6h1v4H9v11c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-9h8V4h-3z"/></svg>
                            <span class="info-text">
                                Студия 
                                {#each release.studios as studio, i}
                                    <a href="/search?studio={studio.id || studio.name}" class="info-link">{studio.name}</a>{i < release.studios.length - 1 ? ', ' : ''}
                                {/each}
                                {#if release.author}
                                    , автор <span class="info-author">{release.author}</span>
                                {/if}
                            </span>
                        </div>
                    {/if}
                    
                    <!-- Genres -->
                    {#if release.genres}
                        <div class="info-row">
                            <svg class="info-icon-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/></svg>
                            <span class="info-text">
                                {#if typeof release.genres === 'string'}
                                    {#each release.genres.split(',').map(g => g.trim()).filter(g => g) as genre, i}
                                        <a href="/search?genre={genre}" class="info-link">{genre}</a>{i < release.genres.split(',').length - 1 ? ', ' : ''}
                                    {/each}
                                {:else if Array.isArray(release.genres)}
                                    {#each release.genres as genre, i}
                                        <a href="/search?genre={genre.id || genre}" class="info-link">{genre.name || genre}</a>{i < release.genres.length - 1 ? ', ' : ''}
                                    {/each}
                                {/if}
                            </span>
                        </div>
                    {/if}
                </div>

                <!-- Trailer -->
                {#if release.trailer}
                    <div class="trailer-section">
                        <h3>Трейлер</h3>
                        <a href={release.trailer} target="_blank" rel="noopener" class="trailer-btn">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                            Смотреть трейлер
                        </a>
                    </div>
                {/if}

                <!-- Studios -->
                {#if release.studios?.length}
                    <div class="studios-section">
                        <h3>Студии</h3>
                        <div class="studios">
                            {#each release.studios as studio}
                                <span class="studio">{studio.name}</span>
                            {/each}
                        </div>
                    </div>
                {/if}

                <!-- Screenshots -->
                {#if release.screenshot_images?.length}
                    <div class="screenshots-section">
                        <h3>Кадры</h3>
                        <div class="screenshots">
                            {#each release.screenshot_images.slice(0, 6) as screenshot}
                                <img src={screenshot} alt="Screenshot" class="screenshot" loading="lazy" />
                            {/each}
                        </div>
                    </div>
                {/if}


                <p class="description">{release.description}</p>

                {#if release.status?.id !== 3}
                    {@const totalVotes = release.vote_count || 0}
                    <div class="rating-card">
                        <div class="rating-top">
                            <div class="rating-score">
                                <svg class="rating-star-icon" viewBox="0 0 24 24" fill="currentColor" width="38" height="38">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                </svg>
                                <p class="rating-score-text">{(release.grade ?? 0).toFixed(2)}</p>
                            </div>
                            {#if utoken}
                                <div class="rating-actions">
                                    {#if userRatingStars > 0}
                                        <p class="rating-user-text">ваша оценка: {userRatingStars}</p>
                                        <button type="button" class="rating-action-btn" disabled={ratingSubmitting} on:click={openRatingModal}>изменить</button>
                                    {:else}
                                        <button type="button" class="rating-action-btn" disabled={ratingSubmitting} on:click={openRatingModal}>оценить</button>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                        <p class="rating-votes">{totalVotes} голосов</p>
                        <div class="rating-graph">
                            {#each [5, 4, 3, 2, 1] as star}
                                {@const voteKey = `vote_${star}_count`}
                                {@const voteCount = release[voteKey] || release[`vote${star}Count`] || 0}
                                {@const percent = totalVotes > 0 ? Math.floor((voteCount / totalVotes) * 100) : 0}
                                <div class="rating-bar-row">
                                    <span class="rating-bar-label">{star}</span>
                                    <div class="rating-bar-track">
                                        <div class="rating-bar-fill" style="width: {percent}%"></div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if isRatingModalOpen}
                    <div class="rating-modal" role="dialog" aria-modal="true">
                        <div class="rating-modal__backdrop" role="button" tabindex="0" on:click={() => (isRatingModalOpen = false)} on:keydown={(e) => e.key === 'Enter' && (isRatingModalOpen = false)}></div>
                        <div class="rating-modal__panel">
                            <div class="rating-modal__header">
                                <div class="rating-modal__title">Оценка</div>
                                <button type="button" class="rating-modal__close" on:click={() => (isRatingModalOpen = false)} aria-label="Закрыть">
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                                        <path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L12 13.41l-6.89 6.3-1.42-1.41L10.59 12 3.69 5.11l1.42-1.42L12 10.59l6.89-6.9z"/>
                                    </svg>
                                </button>
                            </div>
                            <div class="rating-modal__stars">
                                {#each [1, 2, 3, 4, 5] as star}
                                    <button
                                        type="button"
                                        class="rating-modal__star"
                                        class:active={userRatingStars >= star}
                                        disabled={ratingSubmitting}
                                        on:click={() => setRatingStars(star)}
                                        title="{star} из 5"
                                    >
                                        <svg viewBox="0 0 24 24" fill={userRatingStars >= star ? 'currentColor' : 'none'} stroke="currentColor" width="28" height="28">
                                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                        </svg>
                                    </button>
                                {/each}
                            </div>
                            <div class="rating-modal__footer">
                                <button type="button" class="rating-modal__btn" disabled={ratingSubmitting} on:click={() => (isRatingModalOpen = false)}>Закрыть</button>
                                <button type="button" class="rating-modal__btn danger" disabled={ratingSubmitting} on:click={() => setRatingStars(0)}>Убрать оценку</button>
                            </div>
                        </div>
                    </div>
                {/if}

                <!-- Bookmark stats bar -->
                {#if (release.watching_count || 0) + (release.plan_count || 0) + (release.completed_count || 0) + (release.hold_on_count || 0) + (release.dropped_count || 0) > 0}
                    {@const total = (release.watching_count || 0) + (release.plan_count || 0) + (release.completed_count || 0) + (release.hold_on_count || 0) + (release.dropped_count || 0)}
                    <div class="bookmark-bar">
                        <div class="bookmark-bar-track">
                            <div class="bookmark-segment watching" style="width: {((release.watching_count || 0) / total) * 100}%"></div>
                            <div class="bookmark-segment plan" style="width: {((release.plan_count || 0) / total) * 100}%"></div>
                            <div class="bookmark-segment completed" style="width: {((release.completed_count || 0) / total) * 100}%"></div>
                            <div class="bookmark-segment hold-on" style="width: {((release.hold_on_count || 0) / total) * 100}%"></div>
                            <div class="bookmark-segment dropped" style="width: {((release.dropped_count || 0) / total) * 100}%"></div>
                        </div>
                    </div>
                {/if}

                <!-- Bookmark stats legend -->
                <div class="bookmark-stats">
                    <div class="stat watching">
                        <span class="dot"></span>
                        <span class="label">Смотрю</span>
                        <span class="count">{release.watching_count || 0}</span>
                    </div>
                    <div class="stat plan">
                        <span class="dot"></span>
                        <span class="label">В планах</span>
                        <span class="count">{release.plan_count || 0}</span>
                    </div>
                    <div class="stat completed">
                        <span class="dot"></span>
                        <span class="label">Просмотрено</span>
                        <span class="count">{release.completed_count || 0}</span>
                    </div>
                    <div class="stat hold-on">
                        <span class="dot"></span>
                        <span class="label">Отложено</span>
                        <span class="count">{release.hold_on_count || 0}</span>
                    </div>
                    <div class="stat dropped">
                        <span class="dot"></span>
                        <span class="label">Брошено</span>
                        <span class="count">{release.dropped_count || 0}</span>
                    </div>
                </div>

                <!-- Related releases -->
                {#if release.related_releases?.length}
                    <div class="related-section">
                        <div class="section-header">
                            <h3>Связанные релизы ({release.related_count ?? release.related_releases.length})</h3>
                            <a class="franchise-link" href="/franchise/{release.related?.id || release.id}">Франшиза</a>
                        </div>
                        <div class="related-list">
                            {#each (showAllRelated ? release.related_releases : release.related_releases.slice(0, 3)) as related}
                                <button class="related-item" on:click={() => goToRelease(related.id)}>
                                    <img src={related.image} alt={related.title_ru} class="related-poster" />
                                    <div class="related-info">
                                        <span class="related-title">{related.title_ru}</span>
                                        <span class="related-type">{related.category?.name || related.type?.name || ''}</span>
                                        {#if related.year}
                                            <span class="related-year">{related.year} г. • {related.grade?.toFixed(1) || 0} ★</span>
                                        {/if}
                                    </div>
                                </button>
                            {/each}
                        </div>
                        {#if release.related_releases.length > 3}
                            <button class="show-more-btn" on:click={() => showAllRelated = !showAllRelated}>
                                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" class="expand-icon" class:expanded={showAllRelated}>
                                    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                                </svg>
                                {showAllRelated ? 'Свернуть' : `Показать все (${release.related_releases.length})`}
                            </button>
                        {/if}
                    </div>
                {/if}

                <!-- Comments section -->
                <div class="comments-section">
                    <div class="section-header">
                        <h3>Комментарии ({release.comments_count ?? release.comment_count ?? 0})</h3>
                    </div>

                    <div class="comment-composer">
                        {#if utoken}
                            {#if replyParentCommentId}
                                <div class="composer-reply">
                                    <span class="composer-reply-text">Ответ пользователю {replyToLogin || ''}</span>
                                    <button type="button" class="composer-cancel" on:click={cancelReply} disabled={commentSubmitting}>Отмена</button>
                                </div>
                            {/if}

                            <textarea
                                class="composer-input"
                                placeholder={replyParentCommentId ? 'Написать ответ…' : 'Написать комментарий…'}
                                rows="3"
                                bind:value={commentMessage}
                                disabled={commentSubmitting}
                            ></textarea>

                            {#if commentError}
                                <div class="composer-error">{commentError}</div>
                            {/if}

                            <div class="composer-actions">
                                <label class="composer-spoiler">
                                    <input type="checkbox" bind:checked={commentIsSpoiler} disabled={commentSubmitting} />
                                    Спойлер
                                </label>
                                <button class="composer-send" on:click={submitComment} disabled={commentSubmitting || !commentMessage.trim()}>
                                    {commentSubmitting ? 'Отправка…' : 'Отправить'}
                                </button>
                            </div>
                        {:else}
                            <div class="composer-login">
                                <button class="composer-login-btn" on:click={() => goto('/login')}>Войти, чтобы комментировать</button>
                            </div>
                        {/if}
                    </div>

                    {#if comments.length > 0}
                        <div class="comments-list">
                            {#each comments as comment (comment.id)}
                                {@const commentDate = getCommentDate(comment)}
                                <div class="comment-item">
                                    <div class="comment-votes">
                                        <button class="vote-btn upvote" class:active={comment.vote === 2} on:click={() => voteComment(comment, 2)} title="Нравится">
                                            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                                <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
                                            </svg>
                                        </button>
                                        <span class="vote-count" class:positive={comment.likes_count > 0} class:negative={comment.likes_count < 0}>
                                            {comment.likes_count || 0}
                                        </span>
                                        <button class="vote-btn downvote" class:active={comment.vote === 1} on:click={() => voteComment(comment, 1)} title="Не нравится">
                                            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                                <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/>
                                            </svg>
                                        </button>
                                    </div>
                                    <div class="comment-main">
                                        <a href="/profile/{comment.profile?.id}" class="comment-avatar">
                                            <img src={comment.profile?.avatar} alt={comment.profile?.login} />
                                        </a>
                                        <div class="comment-content">
                                            <div class="comment-header">
                                                <a href="/profile/{comment.profile?.id}" class="comment-author">{comment.profile?.login}</a>
                                                <span class="comment-date">{commentDate ? commentDate.toLocaleDateString('ru-RU') : ''}</span>
                                            </div>
                                            <p class="comment-text">{comment.message}</p>

                                            {#if utoken}
                                                <button class="comment-reply-btn" on:click={() => startReplyTo(comment)} disabled={commentSubmitting}>
                                                    Ответить
                                                </button>
                                            {/if}

                                            {#if comment.reply_count > 0}
                                                <button class="reply-toggle" on:click={() => toggleReplies(comment)}>
                                                    ↳ {expandedReplies[comment.id] ? 'Скрыть' : 'Показать'} {comment.reply_count} ответов
                                                </button>
                                            {/if}
                                            {#if expandedReplies[comment.id] && commentReplies[comment.id]}
                                                <div class="replies-list">
                                                    {#each commentReplies[comment.id] as reply (reply.id)}
                                                        {@const replyDate = getCommentDate(reply)}
                                                        <div class="reply-item">
                                                            <a href="/profile/{reply.profile?.id}" class="reply-avatar">
                                                                <img src={reply.profile?.avatar} alt={reply.profile?.login} />
                                                            </a>
                                                            <div class="reply-content">
                                                                <div class="reply-header">
                                                                    <a href="/profile/{reply.profile?.id}" class="reply-author">{reply.profile?.login}</a>
                                                                    <span class="reply-date">{replyDate ? replyDate.toLocaleDateString('ru-RU') : ''}</span>
                                                                </div>
                                                                <p class="reply-text">{reply.message}</p>
                                                            </div>
                                                        </div>
                                                    {/each}
                                                </div>
                                            {/if}
                                        </div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                        {#if ((release.comments_count ?? release.comment_count ?? 0) > 5) && !showAllComments}
                            <button class="show-more-btn" on:click={toggleAllComments}>
                                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                                </svg>
                                Показать все комментарии ({release.comments_count ?? release.comment_count ?? 0})
                            </button>
                        {:else if showAllComments && hasMoreComments && !isLoadingComments}
                            <button class="show-more-btn" on:click={loadMoreComments}>
                                Загрузить ещё
                            </button>
                        {:else if isLoadingComments}
                            <div class="loading-more">Загрузка...</div>
                        {/if}
                    {:else}
                        <p class="no-comments">Комментариев пока нет</p>
                    {/if}
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    .release-page {
        width: 100%;
        min-height: 100%;
        padding: 20px;
    }

    .release-top-actions {
        max-width: 1400px;
        margin: 0 auto 12px;
        display: flex;
        align-items: center;
        justify-content: flex-start;
    }

    .release-back {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        border: none;
        border-radius: 10px;
        background: var(--alt-background-color);
        color: var(--text-color);
        font-weight: 600;
        cursor: pointer;
    }

    .release-back:hover {
        filter: brightness(1.1);
    }

    .franchise-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 8px 12px;
        border-radius: 10px;
        background: var(--alt-background-color);
        color: var(--primary-color);
        text-decoration: none;
        font-size: 13px;
        font-weight: 700;
    }

    .franchise-link:hover {
        filter: brightness(1.1);
    }

    .release-content {
        display: flex;
        gap: 30px;
        max-width: 1400px;
        margin: 0 auto;
    }

    .comment-composer {
        background: var(--alt-background-color);
        border-radius: 12px;
        padding: 12px;
        margin: 12px 0 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .composer-reply {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        font-size: 13px;
        color: var(--secondary-text-color);
    }

    .composer-cancel {
        border: none;
        background: transparent;
        color: var(--primary-color);
        font-weight: 700;
        cursor: pointer;
    }

    .composer-input {
        width: 100%;
        resize: vertical;
        min-height: 84px;
        padding: 12px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: var(--background-color);
        color: var(--text-color);
        line-height: 1.4;
        outline: none;
    }

    .composer-input:focus {
        border-color: rgba(204, 46, 86, 0.6);
    }

    .composer-error {
        font-size: 12px;
        color: var(--danger-color);
    }

    .composer-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
    }

    .composer-spoiler {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--secondary-text-color);
        user-select: none;
    }

    .composer-send {
        padding: 10px 16px;
        border: none;
        border-radius: 10px;
        background: var(--primary-color);
        color: white;
        font-weight: 700;
        cursor: pointer;
    }

    .composer-send:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .composer-login {
        display: flex;
        justify-content: flex-start;
    }

    .composer-login-btn {
        padding: 10px 14px;
        border: none;
        border-radius: 10px;
        background: var(--primary-color);
        color: white;
        font-weight: 700;
        cursor: pointer;
    }

    .comment-reply-btn {
        margin-top: 8px;
        border: none;
        background: transparent;
        color: var(--primary-color);
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        padding: 0;
        text-align: left;
    }

    .comment-reply-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    @media (max-width: 768px) {
        .comment-composer {
            padding: 10px;
        }

        .composer-input {
            min-height: 72px;
        }

        .composer-actions {
            justify-content: space-between;
        }
    }

    .left-panel {
        flex-shrink: 0;
        width: 300px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .poster-wrapper {
        position: relative;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
    }

    .poster {
        width: 100%;
        display: block;
    }

    .age-badge {
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 4px 10px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        border-radius: 6px;
        font-size: 12px;
        font-weight: bold;
    }

    .action-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 14px 20px;
        border: none;
        border-radius: 10px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        text-decoration: none;
    }

    .action-btn.play {
        background: var(--primary-color);
        color: white;
    }

    .action-btn.play:hover {
        filter: brightness(1.1);
    }

    .bookmark-dropdown {
        position: relative;
    }

    .action-btn.bookmark {
        background: var(--alt-background-color);
        color: var(--text-color);
        width: 100%;
    }

    .action-btn.bookmark .arrow {
        margin-left: auto;
    }

    .action-btn.bookmark.watching { background: var(--watching-color); color: white; }
    .action-btn.bookmark.plan { background: var(--plan-color); color: white; }
    .action-btn.bookmark.completed { background: var(--completed-color); color: white; }
    .action-btn.bookmark.hold-on { background: var(--hold-on-color); color: white; }
    .action-btn.bookmark.dropped { background: var(--dropped-color); color: white; }

    .bookmark-menu {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 4px;
        background: var(--alt-background-color);
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
        z-index: 100;
    }

    .bookmark-option {
        display: block;
        width: 100%;
        padding: 12px 16px;
        border: none;
        background: transparent;
        color: var(--text-color);
        font-size: 14px;
        text-align: left;
        cursor: pointer;
        transition: background 0.2s;
    }

    .bookmark-option:hover {
        background: var(--background-color);
    }

    .bookmark-option.active {
        background: var(--option-color);
        color: white;
    }

    .action-btn.favorite {
        background: var(--alt-background-color);
        color: var(--text-color);
    }

    .action-btn.favorite.active {
        color: var(--hold-on-color);
    }

    .action-btn.blocked,
    .action-btn.soon {
        background: var(--alt-background-color);
        color: var(--secondary-text-color);
        cursor: not-allowed;
    }

    .rating-card {
        background: var(--alt-background-color);
        padding: 16px;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .rating-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    .rating-score {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
    }

    .rating-star-icon {
        flex-shrink: 0;
        color: var(--hold-on-color);
    }

    .rating-score-text {
        margin: 0;
        font-size: 32px;
        font-weight: 700;
        color: var(--text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .rating-actions {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
    }

    .rating-user-text {
        margin: 0;
        font-size: 13px;
        color: var(--secondary-text-color);
        white-space: nowrap;
    }

    .rating-action-btn {
        border: 1px solid var(--secondary-text-color);
        background: transparent;
        color: var(--secondary-text-color);
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
    }

    .rating-action-btn:hover {
        filter: brightness(1.1);
    }

    .rating-action-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    .rating-votes {
        margin: 0;
        font-size: 12px;
        color: var(--secondary-text-color);
    }

    .rating-graph {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
        justify-content: center;
    }

    .rating-bar-row {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .rating-bar-label {
        font-size: 12px;
        color: var(--secondary-text-color);
        width: 12px;
        text-align: right;
    }

    .rating-bar-track {
        flex: 1;
        height: 8px;
        background: var(--background-color);
        border-radius: 4px;
        overflow: hidden;
    }

    .rating-bar-fill {
        height: 100%;
        background: var(--secondary-text-color);
        border-radius: 4px;
        transition: width 0.3s;
    }

    .rating-modal {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: grid;
        place-items: center;
        padding: 16px;
    }

    .rating-modal__backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
    }

    .rating-modal__panel {
        position: relative;
        width: 100%;
        max-width: 420px;
        background: var(--alt-background-color);
        border-radius: 14px;
        padding: 14px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
    }

    .rating-modal__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 6px 6px 10px;
    }

    .rating-modal__title {
        font-size: 16px;
        font-weight: 800;
        color: var(--text-color);
    }

    .rating-modal__close {
        border: none;
        background: transparent;
        color: var(--secondary-text-color);
        cursor: pointer;
        padding: 6px;
        border-radius: 10px;
    }

    .rating-modal__close:hover {
        filter: brightness(1.1);
    }

    .rating-modal__stars {
        display: flex;
        justify-content: center;
        gap: 6px;
        padding: 10px 4px 14px;
    }

    .rating-modal__star {
        border: none;
        background: transparent;
        color: var(--hold-on-color);
        cursor: pointer;
        padding: 6px;
        border-radius: 10px;
    }

    .rating-modal__star:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    .rating-modal__footer {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 6px;
    }

    .rating-modal__btn {
        border: none;
        background: var(--background-color);
        color: var(--text-color);
        padding: 10px 12px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
    }

    .rating-modal__btn.danger {
        background: var(--dropped-color);
        color: white;
    }

    .rating-modal__btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    .bookmark-bar {
        margin: 12px 0;
    }

    .bookmark-bar-track {
        display: flex;
        height: 12px;
        border-radius: 6px;
        overflow: hidden;
    }

    .bookmark-segment {
        height: 100%;
        min-width: 2px;
    }

    .bookmark-segment.watching { background: var(--watching-color); }
    .bookmark-segment.plan { background: var(--plan-color); }
    .bookmark-segment.completed { background: var(--completed-color); }
    .bookmark-segment.hold-on { background: var(--hold-on-color); }
    .bookmark-segment.dropped { background: var(--dropped-color); }

    .bookmark-stats {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
    }

    .stat {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
    }

    .stat .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
    }

    .stat.watching .dot { background: var(--watching-color); }
    .stat.plan .dot { background: var(--plan-color); }
    .stat.completed .dot { background: var(--completed-color); }
    .stat.hold-on .dot { background: var(--hold-on-color); }
    .stat.dropped .dot { background: var(--dropped-color); }

    .stat .label {
        color: var(--text-color);
    }

    .stat .count {
        font-weight: 600;
        color: var(--text-color);
    }

    .right-panel {
        flex: 1;
        min-width: 0;
    }

    .title {
        font-size: 28px;
        font-weight: bold;
        color: var(--text-color);
    }

    .alt-title {
        font-size: 16px;
        font-weight: 500;
        color: var(--secondary-text-color);
    }

    .note {
        background: var(--alt-background-color);
        padding: 12px 16px;
        border-radius: 10px;
        font-size: 13px;
        line-height: 1.6;
        margin-bottom: 16px;
    }

    .description {
        font-size: 14px;
        line-height: 1.7;
        color: var(--text-color);
        margin-bottom: 24px;
    }

    .info-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 24px;
        background: var(--alt-background-color);
        padding: 16px;
        border-radius: 12px;
    }

    .info-row {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        font-size: 14px;
        color: var(--text-color);
    }

    .info-icon {
        font-size: 18px;
        width: 20px;
        text-align: center;
        flex-shrink: 0;
    }

    .info-icon-svg {
        width: 20px;
        height: 20px;
        color: var(--secondary-text-color);
        flex-shrink: 0;
    }

    .info-text {
        line-height: 1.5;
    }

    .info-link {
        color: var(--primary-color);
        text-decoration: none;
    }

    .info-link:hover {
        text-decoration: underline;
    }

    .info-author {
        color: var(--secondary-text-color);
    }

    .studios-section,
    .screenshots-section,
    .related-section {
        margin-bottom: 24px;
    }

    .studios-section h3,
    .screenshots-section h3,
    .related-section h3 {
        font-size: 18px;
        margin: 0;
    }

    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .section-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
    }

    .genres,
    .studios {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .genre,
    .studio {
        padding: 6px 14px;
        background: var(--alt-background-color);
        border-radius: 20px;
        font-size: 13px;
        color: var(--text-color);
        text-decoration: none;
        transition: background 0.2s;
    }

    .genre:hover {
        background: var(--primary-color);
        color: white;
    }

    .trailer-section {
        margin-bottom: 24px;
    }

    .trailer-section h3 {
        font-size: 18px;
        margin: 0 0 12px 0;
    }

    .trailer-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 12px 20px;
        background: var(--primary-color);
        color: white;
        text-decoration: none;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        transition: filter 0.2s;
    }

    .trailer-btn:hover {
        filter: brightness(1.1);
    }

    .comments-section {
        margin-bottom: 24px;
    }

    .show-more-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 12px 20px;
        margin-top: 12px;
        background: var(--alt-background-color);
        border: none;
        border-radius: 10px;
        color: var(--text-color);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }

    .show-more-btn:hover {
        background: var(--primary-color);
        color: white;
    }

    .show-more-btn .expand-icon {
        transition: transform 0.2s;
    }

    .show-more-btn .expand-icon.expanded {
        transform: rotate(180deg);
    }

    .loading-more {
        text-align: center;
        padding: 16px;
        color: var(--secondary-text-color);
        font-size: 14px;
    }

    .screenshots {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
    }

    .screenshot {
        width: 100%;
        border-radius: 8px;
        aspect-ratio: 16/9;
        object-fit: cover;
    }

    .related-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .related-item {
        display: flex;
        gap: 12px;
        text-decoration: none;
        color: inherit;
        padding: 10px;
        background: var(--alt-background-color);
        border-radius: 10px;
        transition: transform 0.2s, background-color 0.2s;
        cursor: pointer;
        border: none;
        width: 100%;
        text-align: left;
    }

    .related-item:hover {
        transform: translateX(4px);
        background-color: var(--background-color);
    }

    .related-poster {
        width: 60px;
        height: 85px;
        object-fit: cover;
        border-radius: 6px;
    }

    .related-info {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 4px;
    }

    .related-title {
        font-size: 14px;
        font-weight: 500;
    }

    .related-type {
        font-size: 12px;
        color: var(--secondary-text-color);
    }

    .related-year {
        font-size: 12px;
        color: var(--secondary-text-color);
    }

    .comments-section {
        margin-top: 30px;
    }

    .comments-section h3 {
        margin-bottom: 16px;
    }

    .comments-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .comment-item {
        display: flex;
        gap: 12px;
        padding: 16px;
        background: var(--alt-background-color);
        border-radius: 12px;
    }

    .comment-votes {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        min-width: 40px;
    }

    .vote-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--secondary-text-color);
        cursor: pointer;
        transition: all 0.2s;
    }

    .vote-btn:hover {
        background: var(--background-color);
    }

    .vote-btn.upvote.active {
        color: var(--completed-color);
    }

    .vote-btn.downvote.active {
        color: var(--dropped-color);
    }

    .vote-btn svg {
        width: 20px;
        height: 20px;
    }

    .vote-count {
        font-size: 14px;
        font-weight: 600;
    }

    .vote-count.positive {
        color: var(--completed-color);
    }

    .vote-count.negative {
        color: var(--dropped-color);
    }

    .comment-main {
        display: flex;
        gap: 12px;
        flex: 1;
    }

    .comment-avatar {
        flex-shrink: 0;
    }

    .comment-avatar img {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
    }

    .comment-content {
        flex: 1;
        min-width: 0;
    }

    .reply-toggle {
        font-size: 13px;
        color: var(--primary-color);
        margin-top: 8px;
        display: block;
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        text-align: left;
    }

    .reply-toggle:hover {
        text-decoration: underline;
    }

    .replies-list {
        margin-top: 12px;
        padding-left: 16px;
        border-left: 2px solid var(--alt-background-color);
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .reply-item {
        display: flex;
        gap: 10px;
    }

    .reply-avatar img {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
    }

    .reply-content {
        flex: 1;
    }

    .reply-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
    }

    .reply-author {
        font-weight: 600;
        font-size: 13px;
        color: var(--text-color);
        text-decoration: none;
    }

    .reply-author:hover {
        text-decoration: underline;
    }

    .reply-date {
        font-size: 11px;
        color: var(--secondary-text-color);
    }

    .reply-text {
        font-size: 13px;
        color: var(--text-color);
        margin: 0;
        line-height: 1.4;
    }

    .rating-stars {
        display: flex;
        gap: 4px;
        margin-top: 12px;
        justify-content: center;
    }

    .star-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        background: transparent;
        color: var(--secondary-text-color);
        cursor: pointer;
        transition: all 0.2s;
        padding: 2px;
    }

    .star-btn:hover {
        color: var(--hold-on-color);
        transform: scale(1.1);
    }

    .star-btn.active {
        color: var(--hold-on-color);
    }

    .star-btn svg {
        width: 24px;
        height: 24px;
    }

    .user-rating {
        font-size: 12px;
        color: var(--secondary-text-color);
        text-align: center;
        margin-top: 8px;
    }

    .comment-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
    }

    .comment-author {
        font-weight: 600;
        color: var(--text-color);
        text-decoration: none;
    }

    .comment-author:hover {
        text-decoration: underline;
    }

    .comment-date {
        font-size: 12px;
        color: var(--secondary-text-color);
    }

    .comment-text {
        font-size: 14px;
        color: var(--text-color);
        margin: 0 0 8px;
        line-height: 1.5;
    }

    .comment-stats {
        font-size: 13px;
        color: var(--secondary-text-color);
    }

    .comments-more, .no-comments {
        font-size: 14px;
        color: var(--secondary-text-color);
        text-align: center;
        padding: 20px;
    }

    .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        text-align: center;
    }

    .error-state h2 {
        color: var(--secondary-text-color);
        margin-bottom: 20px;
    }

    .back-btn {
        padding: 12px 24px;
        background: var(--primary-color);
        color: white;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 500;
    }

    @media (max-width: 900px) {
        .release-content {
            flex-direction: column;
        }

        .left-panel {
            width: 100%;
            max-width: 350px;
            margin: 0 auto;
        }

        .screenshots {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    @media (max-width: 768px) {
        .release-page {
            padding: 12px;
        }

        .release-top-actions {
            margin-bottom: 8px;
        }

        .release-back {
            width: 100%;
            justify-content: center;
        }

        .section-header {
            flex-wrap: wrap;
            gap: 8px;
        }

        .title {
            font-size: 20px;
        }

        .alt-title {
            font-size: 14px;
        }

        .description {
            font-size: 14px;
        }

        .info-row {
            font-size: 13px;
        }

        .info-icon-svg {
            width: 18px;
            height: 18px;
        }

        .screenshots {
            grid-template-columns: repeat(2, 1fr);
        }

        .related-poster {
            width: 60px;
            height: 85px;
        }

        .related-title {
            font-size: 14px;
        }

        .related-type,
        .related-year {
            font-size: 12px;
        }

        .comment-item {
            flex-direction: column;
            gap: 8px;
        }

        .comment-votes {
            flex-direction: row;
            gap: 8px;
            align-items: center;
        }

        .comment-main {
            gap: 10px;
        }

        .comment-avatar img {
            width: 36px;
            height: 36px;
        }

        .bookmark-stats {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
        }

        .rating-card {
            flex-direction: column;
            gap: 12px;
        }

        .rating-left {
            text-align: center;
        }

        .action-btn {
            padding: 12px 16px;
            font-size: 14px;
        }

        .right-panel {
            display: contents;
        }

        .title,
        .alt-title {
            order: -1;
        }
    }
</style>
