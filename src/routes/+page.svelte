<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page as pageStore } from '$app/stores';
	import { getApi } from '$lib/api';
	import { userToken } from '$lib/stores';
	import { returnEpisodeString, getAgeRate } from '$lib/utils';
	import Preloader from '$lib/components/Preloader.svelte';
	import AnimeCard from '$lib/components/AnimeCard.svelte';

	let typeReleases = 0;
	let page = 0;
	let filterArgs = { sort: 0, status_id: null, category_id: null };
	let allData = [];
	let isLoading = true;
	let isLoadingMore = false;
	let api = null;

	let hero = null;
	let continueList = [];
	let recommendList = [];

	const releaseTypes = [
		{ id: 0, label: 'Последние' },
		{ id: 1, label: 'Онгоинги' },
		{ id: 2, label: 'Анонсы' },
		{ id: 3, label: 'Завершённые' },
		{ id: 4, label: 'Фильмы' },
		{ id: 5, label: 'Популярные' }
	];

	onMount(async () => {
		if (browser) {
			api = getApi();
			loadHero();
			loadContinue();
			loadRecommendations();
			const t = $pageStore?.url?.searchParams?.get('type');
			const parsed = t !== null ? Number(t) : null;
			if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 5) {
				setReleasesType(parsed);
			} else {
				await loadReleases();
			}
		}
	});

	$: if (browser && api) {
		const t = $pageStore?.url?.searchParams?.get('type');
		const parsed = t !== null ? Number(t) : null;
		if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 5 && parsed !== typeReleases) {
			setReleasesType(parsed);
		}
	}

	async function loadHero() {
		try {
			const data = await api.release.filter(0, { sort: 1, status_id: null, category_id: null }, true);
			const list = (data.content || []).filter(r => r.image);
			if (list.length) hero = list[Math.floor(Math.random() * Math.min(5, list.length))];
		} catch (e) { /* ignore */ }
	}

	async function loadContinue() {
		if (!$userToken) return;
		try {
			const data = await api.release.getHistory(0);
			continueList = (data.content || []).slice(0, 12);
		} catch (e) { /* ignore */ }
	}

	async function loadRecommendations() {
		if (!$userToken) return;
		try {
			const data = await api.discover.getRecommendations(0);
			const list = data.content || data.releases || [];
			recommendList = list.map(x => x.release || x).filter(x => x && x.id).slice(0, 12);
		} catch (e) { /* ignore */ }
	}

	async function loadReleases() {
		if (!api) return;
		isLoading = true;
		try {
			const data = await api.release.filter(page, filterArgs, true);
			allData = data.content || [];
		} catch (e) {
			console.error('Error loading releases:', e);
		}
		isLoading = false;
	}

	async function loadMore() {
		if (!api || isLoadingMore) return;
		isLoadingMore = true;
		page++;
		try {
			const data = await api.release.filter(page, filterArgs, true);
			allData = [...allData, ...(data.content || [])];
		} catch (e) {
			console.error('Error loading more:', e);
		}
		isLoadingMore = false;
	}

	function setReleasesType(type) {
		if (typeReleases === type && allData.length) return;
		typeReleases = type;
		page = 0;
		allData = [];
		switch (type) {
			case 0: filterArgs = { sort: 0, status_id: null, category_id: null }; break;
			case 1: filterArgs = { sort: 0, status_id: 2, category_id: null }; break;
			case 2: filterArgs = { sort: 0, status_id: 3, category_id: null }; break;
			case 3: filterArgs = { sort: 0, status_id: 1, category_id: null }; break;
			case 4: filterArgs = { sort: 0, status_id: null, category_id: 2 }; break;
			case 5: filterArgs = { sort: 1, status_id: null, category_id: null }; break;
		}
		loadReleases();
	}

	function handleScroll(e) {
		const { scrollTop, scrollHeight, clientHeight } = e.target;
		if (scrollHeight - scrollTop - clientHeight < 600 && !isLoadingMore) {
			loadMore();
		}
	}

	$: heroGenres = hero?.genres
		? (typeof hero.genres === 'string'
			? hero.genres.split(',').map(g => g.trim()).filter(Boolean).slice(0, 4)
			: Array.isArray(hero.genres) ? hero.genres.slice(0, 4).map(g => g.name || g) : [])
		: [];
</script>

<svelte:head>
	<title>AniShiki — Главная</title>
	<meta name="description" content="AniShiki — неофициальный веб-клиент Anixart" />
</svelte:head>

<div class="home-page" on:scroll={handleScroll}>
	{#if hero}
		<section class="hero" style="--bg: url('{hero.image}')">
			<div class="hero-bg"></div>
			<div class="hero-grad"></div>
			<div class="hero-content fade-in">
				<div class="hero-badges">
					{#if hero.grade}<span class="hero-grade">★ {Number(hero.grade).toFixed(1)}</span>{/if}
					{#if hero.year}<span>{hero.year}</span>{/if}
					<span>{getAgeRate(hero.age_rating)}</span>
				</div>
				<h1 class="hero-title">{hero.title_ru}</h1>
				{#if hero.title_original}<p class="hero-alt">{hero.title_original}</p>{/if}
				{#if heroGenres.length}
					<div class="hero-genres">
						{#each heroGenres as g}<span>{g}</span>{/each}
					</div>
				{/if}
				{#if hero.description}<p class="hero-desc">{hero.description.slice(0, 220)}{hero.description.length > 220 ? '…' : ''}</p>{/if}
				<div class="hero-actions">
					<a href="/release/{hero.id}" class="btn btn-primary">
						<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M8 5v14l11-7z"/></svg>
						Смотреть
					</a>
					<a href="/release/{hero.id}" class="btn">Подробнее</a>
				</div>
			</div>
		</section>
	{/if}

	<div class="content-wrap">
		{#if continueList.length}
			<section class="rail-section">
				<div class="section-head">
					<h2 class="section-title">Продолжить просмотр</h2>
					<a href="/history" class="see-all">Вся история →</a>
				</div>
				<div class="rail no-scrollbar">
					{#each continueList as anime (anime.id)}
						<div class="rail-item">
							<AnimeCard {anime} type="grid" />
						</div>
					{/each}
				</div>
			</section>
		{/if}

		{#if recommendList.length}
			<section class="rail-section">
				<div class="section-head">
					<h2 class="section-title">Рекомендации для вас</h2>
					<a href="/discover" class="see-all">Больше →</a>
				</div>
				<div class="rail no-scrollbar">
					{#each recommendList as anime (anime.id)}
						<div class="rail-item">
							<AnimeCard {anime} type="grid" />
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<section class="catalog-section">
			<div class="chips-row no-scrollbar">
				{#each releaseTypes as type}
					<button class="chip" class:active={typeReleases === type.id} on:click={() => setReleasesType(type.id)}>
						{type.label}
					</button>
				{/each}
			</div>

			{#if isLoading}
				<div class="poster-grid">
					{#each Array(12) as _}<div class="skel-card"><div class="skeleton skel-poster"></div><div class="skeleton skel-line"></div></div>{/each}
				</div>
			{:else if allData.length === 0}
				<div class="empty-state"><p>Нет релизов для отображения</p></div>
			{:else}
				<div class="poster-grid">
					{#each allData as anime (anime.id)}
						<AnimeCard {anime} type="grid" />
					{/each}
				</div>
				{#if isLoadingMore}<Preloader size="small" />{/if}
			{/if}
		</section>
	</div>
</div>

<style>
	.home-page {
		width: 100%;
		height: 100%;
		overflow-y: auto;
	}

	/* ---------------- Hero ---------------- */
	.hero {
		position: relative;
		min-height: 460px;
		display: flex;
		align-items: flex-end;
		overflow: hidden;
	}

	.hero-bg {
		position: absolute;
		inset: 0;
		background-image: var(--bg);
		background-size: cover;
		background-position: center 25%;
		transform: scale(1.05);
		filter: saturate(1.1);
	}

	.hero-grad {
		position: absolute;
		inset: 0;
		background: var(--hero-grad), var(--overlay-grad);
	}

	.hero-content {
		position: relative;
		z-index: 1;
		max-width: 680px;
		padding: 96px 48px 48px;
	}

	.hero-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
		font-size: 13px;
		font-weight: 600;
		color: var(--secondary-text-color);
		margin-bottom: 14px;
	}

	.hero-grade { color: #ffce4d; }

	.hero-title {
		font-size: clamp(28px, 5vw, 52px);
		font-weight: 900;
		letter-spacing: -0.03em;
		line-height: 1.05;
		margin: 0 0 6px;
		color: var(--text-color);
	}

	.hero-alt {
		font-size: 15px;
		color: var(--secondary-text-color);
		margin: 0 0 14px;
	}

	.hero-genres {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 14px;
	}

	.hero-genres span {
		font-size: 12px;
		font-weight: 600;
		padding: 5px 12px;
		border-radius: var(--radius-pill);
		background: var(--glass-bg);
		border: 1px solid var(--glass-border);
		color: var(--text-color);
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
	}

	.hero-desc {
		font-size: 15px;
		line-height: 1.6;
		color: var(--secondary-text-color);
		margin: 0 0 22px;
	}

	.hero-actions {
		display: flex;
		gap: 12px;
	}

	.hero-actions .btn { padding: 12px 26px; font-size: 15px; }

	/* ---------------- Content ---------------- */
	.content-wrap {
		padding: 28px 48px 40px;
		display: flex;
		flex-direction: column;
		gap: 36px;
	}

	.see-all {
		font-size: 14px;
		font-weight: 600;
		color: var(--secondary-text-color);
		text-decoration: none;
		transition: color var(--dur) var(--ease);
	}
	.see-all:hover { color: var(--accent-strong); }

	.rail {
		display: flex;
		gap: 16px;
		overflow-x: auto;
		padding-bottom: 8px;
		scroll-snap-type: x mandatory;
	}

	.rail-item {
		flex: 0 0 150px;
		width: 150px;
		scroll-snap-align: start;
	}

	.chips-row {
		display: flex;
		gap: 10px;
		overflow-x: auto;
		padding-bottom: 6px;
		margin-bottom: 22px;
	}

	.poster-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 22px 18px;
	}

	.skel-card { display: flex; flex-direction: column; gap: 10px; }
	.skel-poster { width: 100%; aspect-ratio: 2/3; border-radius: var(--radius-md); }
	.skel-line { height: 14px; width: 80%; border-radius: 6px; }

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 60px 20px;
		color: var(--secondary-text-color);
	}

	/* ---------------- Mobile ---------------- */
	@media (max-width: 768px) {
		.hero { min-height: 330px; }
		.hero-content { padding: 54px 18px 20px; }
		.hero-badges { margin-bottom: 10px; }
		.hero-title {
			font-size: 29px;
			line-height: 1.08;
			letter-spacing: 0;
		}
		.hero-alt {
			font-size: 14px;
			margin-bottom: 12px;
		}
		.hero-genres {
			gap: 7px;
			margin-bottom: 14px;
		}
		.hero-genres span {
			padding: 5px 11px;
			font-size: 11px;
		}
		.hero-desc { display: none; }
		.hero-actions { gap: 10px; }
		.hero-actions .btn {
			min-width: 0;
			padding: 11px 18px;
			font-size: 14px;
			flex: 1;
			justify-content: center;
		}
		.content-wrap { padding: 18px 16px 24px; gap: 28px; }
		.poster-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 12px; }
		.rail-item { flex-basis: 120px; width: 120px; }
	}
</style>
