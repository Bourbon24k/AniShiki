<script>
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { getApi } from '$lib/api';
    import { userToken } from '$lib/stores';
    import { returnFullStringTime, getNumericWord } from '$lib/utils';
    import Preloader from '$lib/components/Preloader.svelte';
    import AnimeCard from '$lib/components/AnimeCard.svelte';

    $: profileId = $page.params.id;
    $: utoken = $userToken;
    $: isOwnProfile = utoken?.id?.toString() === profileId;

    let profile = null;
    let isLoading = true;
    let error = null;
    let api = null;
    let recentAnime = [];
    let ratedAnime = [];
    let friends = [];
    let friendStatus = null;
    let bookmarkStats = { watching: 0, planned: 0, watched: 0, hold: 0, dropped: 0 };

    onMount(async () => {
        if (browser) {
            api = getApi();
            await loadProfile();
        }
    });

    async function loadProfile() {
        if (!api) return;
        isLoading = true;
        error = null;
        try {
            const data = await api.profile.info(profileId);
            if (data.profile) {
                profile = data.profile;
                friendStatus = data.profile.friend_status;
                
                // Extract bookmark stats from profile
                if (profile.list_stats) {
                    bookmarkStats = {
                        watching: profile.list_stats[1] || 0,
                        planned: profile.list_stats[2] || 0,
                        watched: profile.list_stats[3] || 0,
                        hold: profile.list_stats[4] || 0,
                        dropped: profile.list_stats[5] || 0
                    };
                }
                
                // Load recent watched anime (status 1 = watching)
                try {
                    const recent = await api.profile.getBookmarks({
                        id: profileId,
                        type: 1,
                        page: 0,
                        sort: 1
                    });
                    recentAnime = (recent.content || []).slice(0, 4);
                } catch (e) {
                    console.error('Error loading recent anime:', e);
                }
                
                // Load rated anime (releases user has rated)
                try {
                    const rated = await api.profile.getVotedReleases ? 
                        await api.profile.getVotedReleases(profileId, 0) : 
                        { content: [] };
                    ratedAnime = (rated.content || []).slice(0, 5);
                } catch (e) {
                    console.error('Error loading rated anime:', e);
                }
                
                // Load friends
                try {
                    const friendsData = await api.profile.getFriends({ id: profileId, page: 0 });
                    friends = (friendsData.content || []).slice(0, 6);
                } catch (e) {
                    console.error('Error loading friends:', e);
                }
                
                // Load social links
                try {
                    const socials = await api.profile.getSocials ? 
                        await api.profile.getSocials(profileId) : null;
                    if (socials) {
                        profile.vk = socials.vk;
                        profile.telegram = socials.telegram;
                        profile.discord = socials.discord;
                        profile.instagram = socials.instagram;
                    }
                } catch (e) {
                    console.error('Error loading socials:', e);
                }
            } else {
                error = 'Профиль не найден';
            }
        } catch (e) {
            console.error('Error loading profile:', e);
            error = 'Ошибка загрузки профиля';
        }
        isLoading = false;
    }
    
    $: totalBookmarks = bookmarkStats.watching + bookmarkStats.planned + bookmarkStats.watched + bookmarkStats.hold + bookmarkStats.dropped;

    async function toggleFriend() {
        if (!api || !utoken) return;
        
        try {
            if (friendStatus === 2) {
                // Already friends, remove
                await api.profile.removeFriendRequest(profileId);
                friendStatus = 0;
            } else if (friendStatus === 1) {
                // Request sent, cancel
                await api.profile.removeFriendRequest(profileId);
                friendStatus = 0;
            } else {
                // Send request
                await api.profile.sendFriendRequest(profileId);
                friendStatus = 1;
            }
        } catch (e) {
            console.error('Error toggling friend:', e);
        }
    }

    function formatDate(timestamp) {
        if (!timestamp) return 'Неизвестно';
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
    }

    function getStatusClass(status) {
        if (!status) return '';
        if (status.includes('онлайн')) return 'online';
        return 'offline';
    }
</script>

<svelte:head>
    <title>{profile?.login || 'Профиль'} - AniShika</title>
</svelte:head>

<div class="profile-page">
    {#if isLoading}
        <Preloader size="large" />
    {:else if error}
        <div class="error-state">
            <h2>😔 {error}</h2>
            <a href="/" class="back-btn">Вернуться на главную</a>
        </div>
    {:else if profile}
        <div class="profile-content">
            <!-- Cover banner -->
            {#if profile.banner || profile.cover}
                <div class="profile-cover">
                    <img
                        src={profile.banner || profile.cover}
                        alt=""
                        class="profile-cover-img"
                        referrerpolicy="no-referrer"
                    />
                </div>
            {/if}

            <!-- Header with avatar -->
            <div class="profile-header">
                <div class="profile-avatar-wrapper">
                    {#if profile.avatar}
                        <img src={profile.avatar} alt={profile.login} class="profile-avatar" />
                    {:else}
                        <div class="profile-avatar placeholder">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                            </svg>
                        </div>
                    {/if}
                    {#if profile.is_sponsor}
                        <span class="sponsor-badge">⭐</span>
                    {/if}
                </div>
                
                <div class="profile-info">
                    <div class="profile-name-row">
                        <h1 class="profile-name">{profile.login}</h1>
                        {#if profile.badge?.name || profile.badge?.title}
                            <span class="profile-badge">{profile.badge.name || profile.badge.title}</span>
                        {/if}
                        {#if profile.level !== undefined}
                            <span class="profile-level">{profile.level}</span>
                        {/if}
                    </div>
                    
                    <!-- Status and last seen -->
                    <div class="profile-status-row">
                        {#if profile.is_online}
                            <span class="profile-status online">● В сети</span>
                        {:else if profile.last_activity || profile.last_online}
                            <span class="profile-status offline">был(а) в сети {formatDate(profile.last_activity || profile.last_online)}</span>
                        {/if}
                    </div>
                    
                    <!-- Social links -->
                    {#if profile.vk || profile.telegram || profile.discord || profile.instagram}
                        <div class="social-links">
                            {#if profile.vk}
                                <a href="https://vk.com/{profile.vk}" target="_blank" class="social-btn vk" title="ВКонтакте">
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.862-.525-2.049-1.714-1.033-1.01-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4 8.684 4 8.245c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.678.847 2.455 2.302 4.602 2.896 4.602.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.203.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.27-1.422 2.18-3.608 2.18-3.608.119-.254.322-.491.762-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.049.17.49-.085.744-.576.744z"/></svg>
                                </a>
                            {/if}
                            {#if profile.telegram}
                                <a href="https://t.me/{profile.telegram}" target="_blank" class="social-btn telegram" title="Telegram">
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                                </a>
                            {/if}
                            {#if profile.discord}
                                <button type="button" class="social-btn discord" title="Discord: {profile.discord}" on:click={() => navigator.clipboard.writeText(profile.discord)}>
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>
                                </button>
                            {/if}
                            {#if profile.instagram}
                                <a href="https://instagram.com/{profile.instagram}" target="_blank" class="social-btn instagram" title="Instagram">
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.757-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/></svg>
                                </a>
                            {/if}
                        </div>
                    {/if}
                </div>
            </div>

            <!-- Privacy notice -->
            {#if profile.is_counts_hidden || profile.is_stats_hidden || profile.is_social_hidden}
                <div class="privacy-notice">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                    </svg>
                    <span>У пользователя установлены настройки приватности. Некоторая информация может быть недоступна.</span>
                </div>
            {/if}

            <!-- Statistics section -->
            <section class="profile-section statistics-section">
                <div class="section-header">
                    <h2>Статистика</h2>
                    <a href="/profile/{profileId}/bookmarks" class="view-all">Посмотреть всё</a>
                </div>
                
                <!-- Bookmark stats bar -->
                {#if (profile.watching_count || 0) + (profile.plan_count || 0) + (profile.completed_count || 0) + (profile.hold_on_count || 0) + (profile.dropped_count || 0) > 0}
                    {@const total = (profile.watching_count || 0) + (profile.plan_count || 0) + (profile.completed_count || 0) + (profile.hold_on_count || 0) + (profile.dropped_count || 0)}
                    <div class="stats-bar">
                        <div class="stats-bar-track">
                            <div class="stats-segment watching" style="width: {((profile.watching_count || 0) / total) * 100}%"></div>
                            <div class="stats-segment plan" style="width: {((profile.plan_count || 0) / total) * 100}%"></div>
                            <div class="stats-segment completed" style="width: {((profile.completed_count || 0) / total) * 100}%"></div>
                            <div class="stats-segment hold-on" style="width: {((profile.hold_on_count || 0) / total) * 100}%"></div>
                            <div class="stats-segment dropped" style="width: {((profile.dropped_count || 0) / total) * 100}%"></div>
                        </div>
                    </div>
                {/if}
                
                <!-- Stats legend -->
                <div class="stats-legend">
                    <div class="stat-item watching">
                        <span class="dot"></span>
                        <span class="label">Смотрю</span>
                        <span class="count">{profile.watching_count || 0}</span>
                    </div>
                    <div class="stat-item plan">
                        <span class="dot"></span>
                        <span class="label">В планах</span>
                        <span class="count">{profile.plan_count || 0}</span>
                    </div>
                    <div class="stat-item completed">
                        <span class="dot"></span>
                        <span class="label">Просмотрено</span>
                        <span class="count">{profile.completed_count || 0}</span>
                    </div>
                    <div class="stat-item hold-on">
                        <span class="dot"></span>
                        <span class="label">Отложено</span>
                        <span class="count">{profile.hold_on_count || 0}</span>
                    </div>
                    <div class="stat-item dropped">
                        <span class="dot"></span>
                        <span class="label">Брошено</span>
                        <span class="count">{profile.dropped_count || 0}</span>
                    </div>
                </div>
                
                <!-- Episodes and time stats -->
                <div class="extra-stats">
                    <span>Просмотрено серий: <strong>{profile.watched_episode_count || profile.episodes_watched || 0}</strong></span>
                    {#if profile.watched_time || profile.watching_time}
                        <span>Время просмотра: <strong>~ {returnFullStringTime(profile.watched_time || profile.watching_time)}</strong></span>
                    {/if}
                </div>
            </section>
            
            <!-- Watch dynamics -->
            {#if profile.watch_dynamics && !profile.is_counts_hidden}
                {@const raw = Array.isArray(profile.watch_dynamics) ? profile.watch_dynamics : []}
                {@const getTs = (d) => (d?.timestamp ?? d?.date ?? null)}
                {@const rawSorted = raw
                    .filter(d => getTs(d) !== null)
                    .slice()
                    .sort((a, b) => (getTs(a) || 0) - (getTs(b) || 0))
                }
                {@const toSeconds = (v) => {
                    const n = typeof v === 'string' ? Number(v) : v;
                    if (!n) return 0;
                    return n > 10_000_000_000 ? Math.floor(n / 1000) : n;
                }}
                {@const toDayKey = (ts) => {
                    const d = new Date(ts * 1000);
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${y}-${m}-${day}`;
                }}
                {@const countsByDay = rawSorted.reduce((acc, d) => {
                    const ts = toSeconds(getTs(d));
                    acc[toDayKey(ts)] = d.count || 0;
                    return acc;
                }, {})}
                {@const today = new Date()}
                {@const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())}
                {@const last7Days = Array.from({ length: 7 }, (_, i) => {
                    const dt = new Date(todayMidnight);
                    dt.setDate(dt.getDate() - (6 - i));
                    const ts = Math.floor(dt.getTime() / 1000);
                    const key = toDayKey(ts);
                    return { ts, count: countsByDay[key] ?? 0 };
                })}
                {@const maxCount = Math.max(...last7Days.map(d => d.count || 0), 1)}
                <section class="profile-section">
                    <h2>Динамика просмотра</h2>
                    <div class="watch-dynamics">
                        {#each last7Days as day}
                            {@const dayDate = new Date(day.ts * 1000)}
                            <div class="dynamic-bar" title="{day.count} серий">
                                <div class="bar-fill" style="height: {Math.max(2, (day.count / maxCount) * 100)}%"></div>
                                <span class="bar-count">{day.count}</span>
                                <span class="bar-date">{dayDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</span>
                            </div>
                        {/each}
                    </div>
                </section>
            {/if}

            <!-- About section -->
            {#if profile.about}
                <section class="profile-section">
                    <h2>О себе</h2>
                    <p class="about-text">{profile.about}</p>
                </section>
            {/if}

            <!-- Time spent watching -->
            {#if profile.watching_time}
                <section class="profile-section">
                    <h2>Время за просмотром</h2>
                    <p class="time-text">{returnFullStringTime(profile.watching_time)}</p>
                </section>
            {/if}

            <!-- Registration info -->
            <section class="profile-section">
                <h2>Информация</h2>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Дата регистрации</span>
                        <span class="info-value">{formatDate(profile.register_date)}</span>
                    </div>
                    {#if profile.reputation !== undefined}
                        <div class="info-item">
                            <span class="info-label">Репутация</span>
                            <span class="info-value reputation" class:positive={profile.reputation > 0} class:negative={profile.reputation < 0}>
                                {profile.reputation > 0 ? '+' : ''}{profile.reputation}
                            </span>
                        </div>
                    {/if}
                </div>
            </section>

            <!-- Friend action button -->
            {#if utoken && !isOwnProfile}
                <div class="friend-action">
                    <button class="friend-btn" class:active={friendStatus === 2} class:pending={friendStatus === 1} on:click={toggleFriend}>
                        {#if friendStatus === 2}
                            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                            </svg>
                            В друзьях
                        {:else if friendStatus === 1}
                            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                            Запрос отправлен
                        {:else}
                            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                                <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                            </svg>
                            Добавить в друзья
                        {/if}
                    </button>
                </div>
            {/if}

            <!-- Friends section -->
            {#if friends.length > 0}
                <section class="profile-section">
                    <div class="section-header">
                        <h2>Друзья ({profile.friends_count || friends.length})</h2>
                        <a href="/friends/{profileId}" class="view-all">Все друзья</a>
                    </div>
                    <div class="friends-grid">
                        {#each friends as friend (friend.id)}
                            <a href="/profile/{friend.id}" class="friend-card">
                                {#if friend.avatar}
                                    <img src={friend.avatar} alt={friend.login} class="friend-avatar" referrerpolicy="no-referrer" />
                                {:else}
                                    <div class="friend-avatar placeholder" aria-hidden="true">
                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                        </svg>
                                    </div>
                                {/if}
                                <span class="friend-name">{friend.login}</span>
                            </a>
                        {/each}
                    </div>
                </section>
            {/if}

            <!-- Rated releases section -->
            {#if ratedAnime.length > 0}
                <section class="profile-section">
                    <div class="section-header">
                        <h2>Оценка релизов</h2>
                        <a href="/profile/{profileId}/votes" class="view-all">Посмотреть всё</a>
                    </div>
                    <div class="rated-grid">
                        {#each ratedAnime as item (item.release?.id || item.id)}
                            <a href="/release/{item.release?.id || item.id}" class="rated-card">
                                <img src={item.release?.image || item.image} alt="" class="rated-poster" />
                                <div class="rated-info">
                                    <span class="rated-score">★ {item.my_vote || item.vote || 0} из 5</span>
                                    <span class="rated-date">{item.timestamp ? new Date(item.timestamp * 1000).toLocaleDateString('ru-RU') : ''}</span>
                                </div>
                                <span class="rated-title">{item.release?.title_ru || item.title_ru}</span>
                            </a>
                        {/each}
                    </div>
                </section>
            {/if}

            <!-- Recent anime -->
            {#if recentAnime.length > 0}
                <section class="profile-section">
                    <div class="section-header">
                        <h2>Сейчас смотрит</h2>
                        <a href="/profile/{profileId}/bookmarks" class="view-all">Все закладки</a>
                    </div>
                    <div class="recent-grid">
                        {#each recentAnime as anime (anime.id)}
                            <a href="/release/{anime.id}" class="recent-card">
                                <img src={anime.image} alt={anime.title_ru} class="recent-poster" />
                                <span class="recent-title">{anime.title_ru}</span>
                            </a>
                        {/each}
                    </div>
                </section>
            {/if}
        </div>
    {/if}
</div>

<style>
    .profile-page {
        width: 100%;
        min-height: 100%;
    }

    .profile-content {
        max-width: 900px;
        margin: 0 auto;
        padding: 0 20px 20px;
    }

    /* Cover banner */
    .profile-cover {
        height: 200px;
        border-radius: 0 0 16px 16px;
        overflow: hidden;
        margin-bottom: -60px;
        position: relative;
        z-index: 0;
    }

    .profile-cover-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    .profile-header {
        display: flex;
        align-items: flex-end;
        gap: 24px;
        margin-bottom: 30px;
        padding: 0 20px;
        position: relative;
        z-index: 1;
    }

    .profile-avatar-wrapper {
        flex-shrink: 0;
        position: relative;
    }

    .profile-avatar {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        object-fit: cover;
        border: 4px solid var(--background-color);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }

    .profile-avatar.placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--alt-background-color);
    }

    .profile-avatar.placeholder svg {
        width: 60px;
        height: 60px;
        color: var(--secondary-text-color);
    }

    .sponsor-badge {
        position: absolute;
        bottom: 4px;
        right: 4px;
        font-size: 20px;
    }

    .privacy-notice {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        background: rgba(255, 193, 7, 0.1);
        border: 1px solid rgba(255, 193, 7, 0.3);
        border-radius: 10px;
        margin-bottom: 20px;
        color: #ffc107;
        font-size: 14px;
    }

    .privacy-notice svg {
        flex-shrink: 0;
    }

    .profile-info {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-bottom: 10px;
    }

    .profile-name-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
    }

    .profile-name {
        font-size: 28px;
        font-weight: bold;
        margin: 0;
        color: var(--text-color);
    }

    .profile-badge {
        padding: 4px 10px;
        background: var(--primary-color);
        color: white;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
    }

    .profile-level {
        padding: 4px 10px;
        background: var(--alt-background-color);
        color: var(--text-color);
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
    }

    .profile-status-row {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .profile-status {
        font-size: 14px;
        color: var(--secondary-text-color);
    }

    .profile-status.online {
        color: var(--watching-color);
    }

    /* Social links */
    .social-links {
        display: flex;
        gap: 8px;
        margin-top: 6px;
    }

    .social-btn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--alt-background-color);
        color: var(--text-color);
        transition: all 0.2s;
    }

    .social-btn:hover {
        transform: scale(1.1);
    }

    .social-btn.vk:hover { background: #4a76a8; color: white; }
    .social-btn.telegram:hover { background: #0088cc; color: white; }
    .social-btn.discord:hover { background: #5865f2; color: white; }
    .social-btn.instagram:hover { background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); color: white; }

    .profile-stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-bottom: 30px;
    }

    .stat-card {
        background-color: var(--alt-background-color);
        padding: 20px;
        border-radius: 12px;
        text-align: center;
    }

    .stat-value {
        display: block;
        font-size: 28px;
        font-weight: bold;
        color: var(--text-color);
        margin-bottom: 4px;
    }

    .stat-label {
        font-size: 13px;
        color: var(--secondary-text-color);
    }

    .profile-section {
        background-color: var(--alt-background-color);
        padding: 20px;
        border-radius: 12px;
        margin-bottom: 20px;
    }

    .profile-section h2 {
        font-size: 18px;
        margin: 0 0 16px;
        color: var(--text-color);
    }

    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .section-header h2 {
        margin: 0;
    }

    .view-all {
        font-size: 14px;
        color: var(--primary-color);
        text-decoration: none;
    }

    .friend-action {
        margin-bottom: 20px;
    }

    .friend-btn {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 24px;
        border: none;
        border-radius: 10px;
        background: var(--primary-color);
        color: white;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }

    .friend-btn:hover {
        filter: brightness(1.1);
    }

    .friend-btn.active {
        background: var(--watching-color);
    }

    .friend-btn.pending {
        background: var(--hold-on-color);
    }

    /* Watch dynamics chart */
    .watch-dynamics {
        display: flex;
        gap: 6px;
        height: 80px;
        padding: 8px 0;
    }

    .dynamic-bar {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 100%;
        min-width: 0;
    }

    .bar-fill {
        width: 12px;
        max-width: 100%;
        background: rgba(255, 255, 255, 0.85);
        border-radius: 3px;
        min-height: 2px;
        margin-top: auto;
    }

    .bar-count {
        font-size: 9px;
        font-weight: 600;
        color: var(--text-color);
        margin-top: 4px;
    }

    .bar-date {
        font-size: 8px;
        color: var(--secondary-text-color);
        margin-top: 2px;
        white-space: nowrap;
    }

    .friends-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 12px;
    }

    .friend-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-decoration: none;
        color: var(--text-color);
        transition: transform 0.2s;
    }

    .friend-card:hover {
        transform: translateY(-4px);
    }

    .friend-avatar {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        object-fit: cover;
        margin-bottom: 8px;
    }

    .friend-avatar.placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--background-color);
        color: var(--secondary-text-color);
    }

    .friend-avatar.placeholder svg {
        width: 28px;
        height: 28px;
    }

    .friend-name {
        font-size: 12px;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 80px;
    }

    .about-text {
        font-size: 14px;
        line-height: 1.6;
        color: var(--text-color);
        margin: 0;
    }

    .time-text {
        font-size: 20px;
        font-weight: 600;
        color: var(--text-color);
        margin: 0;
    }

    .info-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
    }

    .info-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .info-label {
        font-size: 12px;
        color: var(--secondary-text-color);
    }

    .info-value {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-color);
    }

    .reputation.positive {
        color: var(--watching-color);
    }

    .reputation.negative {
        color: var(--dropped-color);
    }

    .recent-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
    }

    .recent-card {
        text-decoration: none;
        color: inherit;
    }

    .recent-poster {
        width: 100%;
        aspect-ratio: 2/3;
        object-fit: cover;
        border-radius: 8px;
        margin-bottom: 8px;
    }

    .recent-title {
        display: block;
        font-size: 13px;
        color: var(--text-color);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    /* Rated releases grid */
    .rated-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 16px;
    }

    .rated-card {
        text-decoration: none;
        color: inherit;
        position: relative;
    }

    .rated-poster {
        width: 100%;
        aspect-ratio: 2/3;
        object-fit: cover;
        border-radius: 8px;
        margin-bottom: 8px;
    }

    .rated-info {
        position: absolute;
        top: 8px;
        left: 8px;
        right: 8px;
        display: flex;
        justify-content: space-between;
        font-size: 11px;
    }

    .rated-score {
        background: rgba(0,0,0,0.7);
        color: #ffc107;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: 600;
    }

    .rated-date {
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
    }

    .rated-title {
        display: block;
        font-size: 12px;
        color: var(--text-color);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    /* History grid */
    .history-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 16px;
    }

    .history-card {
        text-decoration: none;
        color: inherit;
        position: relative;
    }

    .history-poster {
        width: 100%;
        aspect-ratio: 2/3;
        object-fit: cover;
        border-radius: 8px;
        margin-bottom: 8px;
    }

    .history-info {
        position: absolute;
        top: 8px;
        left: 8px;
        right: 8px;
        display: flex;
        justify-content: space-between;
        font-size: 11px;
    }

    .history-episode {
        background: var(--primary-color);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: 600;
    }

    .history-date {
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
    }

    .history-title {
        display: block;
        font-size: 12px;
        color: var(--text-color);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
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

    .stats-bar {
        margin-bottom: 16px;
    }

    .stats-bar-track {
        display: flex;
        height: 16px;
        border-radius: 8px;
        overflow: hidden;
    }

    .stats-segment {
        height: 100%;
        min-width: 3px;
    }

    .stats-segment.watching { background: var(--watching-color); }
    .stats-segment.plan { background: var(--plan-color); }
    .stats-segment.completed { background: var(--completed-color); }
    .stats-segment.hold-on { background: var(--hold-on-color); }
    .stats-segment.dropped { background: var(--dropped-color); }

    .stats-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        margin-bottom: 16px;
    }

    .stat-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
    }

    .stat-item .dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
    }

    .stat-item.watching .dot { background: var(--watching-color); }
    .stat-item.plan .dot { background: var(--plan-color); }
    .stat-item.completed .dot { background: var(--completed-color); }
    .stat-item.hold-on .dot { background: var(--hold-on-color); }
    .stat-item.dropped .dot { background: var(--dropped-color); }

    .stat-item .label {
        color: var(--text-color);
    }

    .stat-item .count {
        font-weight: 600;
        color: var(--text-color);
    }

    .extra-stats {
        display: flex;
        gap: 24px;
        font-size: 14px;
        color: var(--secondary-text-color);
    }

    .extra-stats strong {
        color: var(--text-color);
    }

    @media (max-width: 768px) {
        .profile-page {
            padding: 12px;
        }

        .profile-header {
            flex-direction: column;
            text-align: center;
            gap: 12px;
            align-items: center;
            padding: 0 16px;
        }

        .profile-avatar {
            width: 100px;
            height: 100px;
        }

        .profile-info {
            width: 100%;
            align-items: center;
        }

        .profile-name-row {
            justify-content: center;
        }

        .profile-name {
            font-size: 22px;
        }

        .section-header {
            flex-wrap: wrap;
            gap: 10px;
        }

        .section-header h2 {
            font-size: 16px;
        }

        .view-all {
            font-size: 13px;
        }

        .profile-section {
            padding: 16px;
        }

        .recent-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
        }

        .rated-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
        }

        .history-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
        }

        .friends-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
        }

        .stats-legend {
            gap: 8px;
            font-size: 13px;
        }

        .stat-item {
            font-size: 13px;
        }

        .stat-item .dot {
            width: 10px;
            height: 10px;
        }

        .extra-stats {
            flex-direction: column;
            gap: 8px;
            font-size: 13px;
        }

        .friend-card {
            padding: 8px;
        }

        .friend-avatar {
            width: 50px;
            height: 50px;
        }

        .friend-name {
            font-size: 12px;
        }
    }
</style>
