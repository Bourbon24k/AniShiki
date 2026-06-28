<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { getApi } from '$lib/api';
	import { userToken, showToast } from '$lib/stores';
	import { siteSession } from '$lib/stores/auth';
	import {
		isFavorite as siteIsFav,
		addFavorite as siteAddFav,
		removeFavorite as siteRemoveFav,
		getListStatus as siteGetListStatus,
		getRating as siteGetRating,
		setRating as siteSetRating,
		getHistoryEntry as siteHistoryEntry
	} from '$lib/sitedata';
	import {
		returnEpisodeString,
		getAgeRate,
		getStatusInfo,
		parseGenres,
		returnSoonText,
		thumb
	} from '$lib/utils';
	import Icon from '$lib/components/Icon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import AnimeCard from '$lib/components/AnimeCard.svelte';
	import BookmarkButton from '$lib/components/BookmarkButton.svelte';
	import Comments from '$lib/components/Comments.svelte';
	import SiteComments from '$lib/components/SiteComments.svelte';
	import Lightbox from '$lib/components/Lightbox.svelte';

	$: releaseId = Number($page.params.id);

	let release = null;
	let loading = true;
	let error = '';
	let related = [];
	let recommended = [];
	let isFavorite = false;
	let listStatus = 0;
	let myVote = 0;
	let descExpanded = false;
	let resume = null; // { sec, ep } — сохранённая позиция просмотра

	function fmtTime(s) {
		s = Math.floor(s || 0);
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = s % 60;
		const mm = h ? String(m).padStart(2, '0') : String(m);
		return `${h ? h + ':' : ''}${mm}:${String(sec).padStart(2, '0')}`;
	}

	// Галерея скриншотов
	let lbOpen = false;
	let lbIndex = 0;
	function openShot(i) {
		lbIndex = i;
		lbOpen = true;
	}

	// Трейлер (YouTube-модалка)
	let trailerId = null;
	function ytId(url) {
		const m = String(url || '').match(/(?:youtube\.com\/(?:.*v=|vi\/|embed\/)|youtu\.be\/|\/vi\/)([\w-]{11})/);
		return m ? m[1] : null;
	}

	$: status = getStatusInfo(release?.status);
	$: genres = parseGenres(release?.genres, 12);
	// screenshot_images содержит готовые URL; screenshots — только id-файлов (без URL).
	$: screenshots = release?.screenshot_images?.length
		? release.screenshot_images
		: (release?.screenshots || []).map((s) =>
				String(s).startsWith('http') ? s : `https://s.anixmirai.com/screenshots/${s}.jpg`
			);
	$: franchise = release?.related && release.related.id ? release.related : null;
	$: videoBanners = (release?.video_banners || [])
		.map((b) => ({ ...b, yt: ytId(b.image) }))
		.filter((b) => b.yt);
	$: listStats = release
		? [
				{ label: 'Смотрят', value: release.watching_count, color: 'var(--watching-color)' },
				{ label: 'В планах', value: release.plan_count, color: 'var(--plan-color)' },
				{ label: 'Просмотрели', value: release.completed_count, color: 'var(--completed-color)' },
				{ label: 'Отложили', value: release.hold_on_count, color: 'var(--hold-on-color)' },
				{ label: 'Бросили', value: release.dropped_count, color: 'var(--dropped-color)' }
			].filter((s) => s.value != null)
		: [];
	$: listTotal = listStats.reduce((a, s) => a + (s.value || 0), 0) || 1;

	async function load(id) {
		loading = true;
		error = '';
		release = null;
		const api = getApi();
		if (!api) return;
		try {
			const data = await api.release.info(id, true);
			release = data?.release;
			if (!release) {
				error = 'Релиз не найден';
				return;
			}
			isFavorite = !!release.is_favorite;
			listStatus = release.profile_list_status || 0;
			myVote = release.your_vote || 0;
			// Позиция просмотра: локально для всех, кросс-девайс для site-аккаунта
			try {
				const local = JSON.parse(localStorage.getItem(`progress:${release.id}`) || 'null');
				if (local?.sec > 5) resume = { sec: local.sec, ep: local.ep };
			} catch {}
			if (!$userToken && $siteSession) {
				try {
					const h = await siteHistoryEntry(release.id);
					if (h?.seconds > 5) resume = { sec: h.seconds, ep: h.episode_position };
				} catch {}
			}
			// Для аккаунта сайта (без Anixart) — избранное/список/оценка из Supabase
			if (!$userToken && $siteSession) {
				[isFavorite, listStatus, myVote] = await Promise.all([
					siteIsFav(release.id),
					siteGetListStatus(release.id),
					siteGetRating(release.id)
				]);
			}
			// Связанное и рекомендации приходят прямо в release.info (надёжнее отдельных запросов).
			related = release.related_releases || [];
			recommended = release.recommended_releases || [];
			if (!related.length) {
				api.release
					.getRelatedReleases(id, 0)
					.then((r) => (related = r?.content || []))
					.catch(() => {});
			}
		} catch (e) {
			console.error(e);
			error = 'Ошибка загрузки релиза';
		} finally {
			loading = false;
		}
	}

	async function toggleFavorite() {
		if (!$userToken && !$siteSession) return showToast('Войдите в аккаунт', 'error');
		const prev = isFavorite;
		isFavorite = !isFavorite;
		try {
			if ($userToken) {
				if (prev) await getApi().release.removeFavorite(releaseId);
				else await getApi().release.addFavorite(releaseId);
			} else {
				// аккаунт сайта → Supabase
				if (prev) await siteRemoveFav(release.id);
				else await siteAddFav(release);
			}
		} catch {
			isFavorite = prev;
			showToast('Ошибка', 'error');
		}
	}

	async function vote(stars) {
		if (!$userToken && !$siteSession) return showToast('Войдите в аккаунт', 'error');
		const prev = myVote;
		const next = myVote === stars ? 0 : stars;
		myVote = next;
		try {
			if ($userToken) {
				if (next === 0) await getApi().release.removeVote(releaseId);
				else await getApi().release.addVote(releaseId, stars);
			} else {
				await siteSetRating(release, next);
			}
			showToast(next === 0 ? 'Оценка снята' : 'Оценка сохранена', 'success');
		} catch {
			myVote = prev;
			showToast('Ошибка', 'error');
		}
	}

	$: if (releaseId) load(releaseId);

	/** @type {[string, (r: any) => any][]} */
	const infoRows = [
		['Студия', (r) => r.studio],
		['Автор', (r) => r.author],
		['Режиссёр', (r) => r.director],
		['Страна', (r) => r.country],
		['Год', (r) => r.year]
	];
</script>

<svelte:head>
	<title>{release?.title_ru || 'Релиз'} — AniShiki</title>
</svelte:head>

{#if loading}
	<Spinner center label="Загрузка…" />
{:else if error}
	<div class="error">
		<h2>{error}</h2>
		<a href="/">На главную</a>
	</div>
{:else if release}
	<div class="release">
		<div class="backdrop">
			{#if release.image}
				<img src={thumb(release.image, { w: 720, q: 50 })} alt="" referrerpolicy="no-referrer" decoding="async" />
			{/if}
			<div class="backdrop-grad"></div>
		</div>

		<div class="container">
			<button class="back-btn" on:click={() => history.back()}><Icon name="back" size={18} /> Назад</button>

			<div class="head">
				<div class="poster">
					<img src={thumb(release.image, { w: 400 })} alt={release.title_ru} referrerpolicy="no-referrer" decoding="async" fetchpriority="high" />
					{#if release.status}<span class="status" style="--c:{status.color}">{status.text}</span>{/if}
				</div>

				<div class="meta">
					<h1>{release.title_ru}</h1>
					{#if release.title_original}<p class="orig">{release.title_original}</p>{/if}

					<div class="badges">
						{#if release.grade}
							<span class="grade"><Icon name="star" size={15} fill="#ffc107" />{release.grade.toFixed(1)}</span>
						{/if}
						<span class="badge">{getAgeRate(release.age_rating)}</span>
						<span class="badge">{returnEpisodeString(release)} эп.</span>
						{#if release.category?.name}<span class="badge">{release.category.name}</span>{/if}
						{#if release.season != null && release.year}
							<span class="badge">{returnSoonText(release)}</span>
						{/if}
					</div>

					<div class="genres">
						{#each genres as g}
							<a class="genre" href={`/search?genre=${encodeURIComponent(g)}`}>{g}</a>
						{/each}
					</div>

					<div class="actions">
						{#if resume}
							<a class="btn primary" href={`/player/${release.id}`}>
								<Icon name="play" size={20} /> Продолжить с {fmtTime(resume.sec)}{#if resume.ep} · сер. {resume.ep}{/if}
							</a>
							<a class="btn ghost" href={`/player/${release.id}?fresh=1`}>С начала</a>
						{:else}
							<a class="btn primary" href={`/player/${release.id}`}><Icon name="play" size={20} /> Смотреть</a>
						{/if}
						{#if $userToken || $siteSession}<BookmarkButton releaseId={release.id} {release} bind:status={listStatus} />{/if}
						<button class="icon-btn" class:fav={isFavorite} on:click={toggleFavorite} aria-label="В избранное">
							<Icon name={isFavorite ? 'bookmark' : 'bookmarkAdd'} size={20} />
						</button>
					</div>

					<div class="rate">
						<span class="rate-label">Ваша оценка:</span>
						<div class="stars">
							{#each [1, 2, 3, 4, 5] as s}
								<button class="star" class:on={s <= myVote} on:click={() => vote(s)} aria-label={`${s} звёзд`}>
									<Icon name="star" size={22} fill={s <= myVote ? '#ffc107' : 'currentColor'} />
								</button>
							{/each}
						</div>
						{#if release.vote_count}<span class="votes">{release.vote_count} оценок</span>{/if}
					</div>
				</div>
			</div>

			{#if release.description}
				<div class="desc" class:expanded={descExpanded}>
					<p>{release.description}</p>
				</div>
				{#if release.description.length > 320}
					<button class="more-desc" on:click={() => (descExpanded = !descExpanded)}>
						{descExpanded ? 'Свернуть' : 'Читать далее'}
					</button>
				{/if}
			{/if}

			<div class="info-grid">
				{#each infoRows as [label, get]}
					{#if get(release)}
						<div class="info-row"><span class="k">{label}</span><span class="v">{get(release)}</span></div>
					{/if}
				{/each}
			</div>

			{#if listStats.some((s) => s.value)}
				<section class="stats-block">
					<div class="stats-head">
						<h2>Статистика</h2>
						<span class="stats-total">{listTotal.toLocaleString('ru-RU')} в списках · {(release.favorites_count || 0).toLocaleString('ru-RU')} в избранном</span>
					</div>
					<div class="stat-bar">
						{#each listStats as s}
							{#if s.value}
								<span class="seg" style="width:{(s.value / listTotal) * 100}%;background:{s.color}" title={`${s.label}: ${s.value}`}></span>
							{/if}
						{/each}
					</div>
					<div class="stat-legend">
						{#each listStats as s}
							<div class="leg">
								<span class="dot" style="background:{s.color}"></span>
								<span class="leg-label">{s.label}</span>
								<span class="leg-val">{(s.value || 0).toLocaleString('ru-RU')}</span>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			{#if videoBanners.length}
				<section class="media">
					<h2>Трейлеры и видео</h2>
					<div class="video-row no-scrollbar">
						{#each videoBanners as b}
							<button class="video-thumb" on:click={() => (trailerId = b.yt)}>
								<img src={b.image} alt={b.name} referrerpolicy="no-referrer" loading="lazy" />
								<span class="play-ic"><Icon name="play" size={26} /></span>
								<span class="vt-name">{b.name}</span>
							</button>
						{/each}
					</div>
				</section>
			{/if}

			{#if screenshots.length}
				<section class="media">
					<h2>Кадры</h2>
					<div class="shots-row no-scrollbar">
						{#each screenshots as src, i}
							<button class="shot" on:click={() => openShot(i)}>
								<img src={thumb(src, { w: 480 })} alt={`Кадр ${i + 1}`} referrerpolicy="no-referrer" loading="lazy" decoding="async" />
							</button>
						{/each}
					</div>
				</section>
			{/if}

			{#if recommended.length}
				<section class="related">
					<h2>Рекомендуем для вас</h2>
					<div class="related-grid">
						{#each recommended.slice(0, 12) as r (r.id)}
							<AnimeCard anime={r} type="grid" />
						{/each}
					</div>
				</section>
			{/if}

			{#if related.length}
				<section class="related">
					<div class="rel-head">
						<h2>Связанные тайтлы</h2>
						{#if franchise}
							<a class="franchise-link" href={`/franchise/${franchise.id}`}>
								Вся франшиза{#if franchise.release_count}<span class="fr-cnt">{franchise.release_count}</span>{/if}
								<Icon name="chevronRight" size={16} />
							</a>
						{/if}
					</div>
					<div class="related-grid">
						{#each related as r (r.id)}
							<AnimeCard anime={r} type="grid" />
						{/each}
					</div>
				</section>
			{/if}

			{#if $siteSession}
				<SiteComments releaseId={release.id} />
			{:else}
				<Comments {releaseId} />
			{/if}
		</div>
	</div>

	<Lightbox images={screenshots} bind:index={lbIndex} bind:open={lbOpen} />

	{#if trailerId}
		<div class="yt-modal" on:click={() => (trailerId = null)}>
			<button class="yt-close" on:click|stopPropagation={() => (trailerId = null)} aria-label="Закрыть">
				<Icon name="close" size={24} />
			</button>
			<div class="yt-frame" on:click|stopPropagation>
				<iframe
					src={`https://www.youtube.com/embed/${trailerId}?autoplay=1`}
					title="Трейлер"
					allow="autoplay; encrypted-media; fullscreen"
					allowfullscreen
				></iframe>
			</div>
		</div>
	{/if}
{/if}

<style>
	.release {
		position: relative;
		min-height: 100%;
	}
	.backdrop {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 460px;
		z-index: 0;
		overflow: hidden;
	}
	.backdrop img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: blur(30px) saturate(120%);
		transform: scale(1.15);
		opacity: 0.5;
	}
	.backdrop-grad {
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, transparent 0%, var(--background-color) 92%);
	}
	.container {
		position: relative;
		z-index: 1;
		max-width: 1200px;
		margin: 0 auto;
		padding: 20px 24px 60px;
	}
	.back-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border: 1px solid var(--glass-border);
		background: var(--glass-bg);
		backdrop-filter: blur(10px);
		color: var(--text-color);
		border-radius: 12px;
		cursor: pointer;
		font-size: 14px;
		margin-bottom: 24px;
	}
	.head {
		display: flex;
		gap: 32px;
		margin-bottom: 28px;
	}
	.poster {
		position: relative;
		width: 250px;
		min-width: 250px;
		aspect-ratio: 2/3;
		border-radius: 18px;
		overflow: hidden;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
	}
	.poster img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.poster .status {
		position: absolute;
		top: 12px;
		left: 12px;
		padding: 5px 10px;
		border-radius: 8px;
		font-size: 12px;
		font-weight: 700;
		color: #fff;
		background: var(--c);
	}
	.meta {
		flex: 1;
		min-width: 0;
		padding-top: 10px;
	}
	h1 {
		font-size: clamp(26px, 3.4vw, 42px);
		font-weight: 800;
		line-height: 1.08;
		letter-spacing: -0.5px;
	}
	.orig {
		font-size: 16px;
		color: var(--secondary-text-color);
		margin-top: 8px;
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		margin: 18px 0;
	}
	.grade {
		display: flex;
		align-items: center;
		gap: 4px;
		font-weight: 700;
		color: #ffc107;
		font-size: 16px;
	}
	.badge {
		padding: 5px 12px;
		border-radius: 9px;
		font-size: 13px;
		font-weight: 600;
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		color: var(--secondary-text-color);
	}
	.genres {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 22px;
	}
	.genre {
		padding: 6px 13px;
		font-size: 12.5px;
		border-radius: 20px;
		background: var(--alt-background-color);
		color: var(--secondary-text-color);
		transition: background 0.2s, color 0.2s;
	}
	.genre:hover {
		color: #fff;
		background: var(--primary-color);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		margin-bottom: 22px;
	}
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 13px 26px;
		border-radius: 14px;
		font-weight: 700;
		font-size: 15px;
		cursor: pointer;
		transition: transform 0.15s ease;
	}
	.btn:hover {
		transform: translateY(-2px);
	}
	.btn.primary {
		color: #fff;
		background: var(--primary-color);
		box-shadow: 0 8px 24px var(--primary-glow);
	}
	.btn.ghost {
		color: var(--text-color);
		background: var(--elevated-color);
		border: 1px solid var(--glass-border);
	}
	.icon-btn {
		width: 48px;
		height: 48px;
		display: grid;
		place-items: center;
		border: 1px solid var(--glass-border);
		background: var(--elevated-color);
		color: var(--text-color);
		border-radius: 14px;
		cursor: pointer;
	}
	.icon-btn.fav {
		color: var(--primary-color);
		border-color: var(--primary-color);
	}
	.rate {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-wrap: wrap;
	}
	.rate-label {
		font-size: 14px;
		color: var(--secondary-text-color);
	}
	.stars {
		display: flex;
		gap: 2px;
		color: var(--gray-btn);
	}
	.star {
		border: none;
		background: transparent;
		cursor: pointer;
		padding: 2px;
		transition: transform 0.12s ease;
	}
	.star:hover {
		transform: scale(1.2);
	}
	.star.on {
		color: #ffc107;
	}
	.votes {
		font-size: 13px;
		color: var(--third-text-color);
	}
	.desc {
		max-width: 900px;
		font-size: 15px;
		line-height: 1.7;
		color: var(--secondary-text-color);
		position: relative;
		max-height: 110px;
		overflow: hidden;
		transition: max-height 0.3s ease;
	}
	.desc.expanded {
		max-height: 2000px;
	}
	.desc:not(.expanded)::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 50px;
		background: linear-gradient(transparent, var(--background-color));
	}
	.more-desc {
		margin-top: 8px;
		border: none;
		background: transparent;
		color: var(--primary-color);
		font-weight: 600;
		cursor: pointer;
		font-size: 14px;
	}
	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 12px;
		margin: 28px 0;
	}
	.info-row {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 16px;
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		border-radius: 12px;
	}
	.info-row .k {
		color: var(--third-text-color);
		font-size: 13px;
	}
	.info-row .v {
		font-weight: 600;
		font-size: 13px;
		text-align: right;
	}
	.rel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin: 12px 0 18px;
	}
	.related h2 {
		font-size: 22px;
		font-weight: 700;
	}
	.franchise-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 14px;
		font-weight: 600;
		color: var(--primary-color);
		padding: 8px 14px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--primary-color) 12%, transparent);
		transition: background 0.2s ease;
	}
	.franchise-link:hover {
		background: color-mix(in srgb, var(--primary-color) 22%, transparent);
	}
	.fr-cnt {
		background: var(--primary-color);
		color: #fff;
		font-size: 11px;
		padding: 1px 7px;
		border-radius: 8px;
	}
	.related-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 18px;
	}
	/* Статистика списков */
	.stats-block {
		margin: 8px 0 34px;
	}
	.stats-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 14px;
	}
	.stats-head h2 {
		font-size: 22px;
		font-weight: 700;
	}
	.stats-total {
		font-size: 13px;
		color: var(--third-text-color);
	}
	.stat-bar {
		display: flex;
		height: 12px;
		border-radius: 7px;
		overflow: hidden;
		background: var(--alt-background-color);
	}
	.stat-bar .seg {
		height: 100%;
		transition: width 0.5s ease;
	}
	.stat-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 18px;
		margin-top: 14px;
	}
	.leg {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 13px;
	}
	.leg .dot {
		width: 10px;
		height: 10px;
		border-radius: 3px;
	}
	.leg-label {
		color: var(--secondary-text-color);
	}
	.leg-val {
		font-weight: 700;
	}

	/* Медиа: трейлеры и кадры */
	.media {
		margin-bottom: 34px;
	}
	.media h2 {
		font-size: 22px;
		font-weight: 700;
		margin-bottom: 16px;
	}
	.video-row,
	.shots-row {
		display: grid;
		grid-auto-flow: column;
		gap: 14px;
		overflow-x: auto;
		padding-bottom: 6px;
		scroll-snap-type: x proximity;
	}
	.video-row {
		grid-auto-columns: 280px;
	}
	.shots-row {
		grid-auto-columns: 300px;
	}
	.video-thumb,
	.shot {
		position: relative;
		border: none;
		padding: 0;
		cursor: pointer;
		border-radius: 14px;
		overflow: hidden;
		aspect-ratio: 16 / 9;
		background: var(--alt-background-color);
		scroll-snap-align: start;
	}
	.video-thumb img,
	.shot img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.4s ease;
	}
	.video-thumb:hover img,
	.shot:hover img {
		transform: scale(1.06);
	}
	.play-ic {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: #fff;
	}
	.play-ic :global(svg) {
		background: rgba(0, 0, 0, 0.55);
		border-radius: 50%;
		padding: 10px;
		width: 46px;
		height: 46px;
		backdrop-filter: blur(4px);
	}
	.vt-name {
		position: absolute;
		left: 10px;
		bottom: 10px;
		font-size: 12px;
		font-weight: 700;
		color: #fff;
		background: rgba(0, 0, 0, 0.6);
		padding: 4px 10px;
		border-radius: 8px;
	}

	/* YouTube-модалка */
	.yt-modal {
		position: fixed;
		inset: 0;
		z-index: 5000;
		background: rgba(0, 0, 0, 0.9);
		backdrop-filter: blur(8px);
		display: grid;
		place-items: center;
		padding: 24px;
	}
	.yt-frame {
		width: min(960px, 94vw);
		aspect-ratio: 16 / 9;
		border-radius: 14px;
		overflow: hidden;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
	}
	.yt-frame iframe {
		width: 100%;
		height: 100%;
		border: none;
	}
	.yt-close {
		position: absolute;
		top: 20px;
		right: 20px;
		width: 46px;
		height: 46px;
		border: none;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.12);
		color: #fff;
		cursor: pointer;
		display: grid;
		place-items: center;
	}

	.error {
		text-align: center;
		padding: 80px 20px;
	}
	.error a {
		color: var(--primary-color);
	}
	@media (max-width: 768px) {
		.container {
			padding: 12px 14px 40px;
		}
		.head {
			flex-direction: column;
			gap: 18px;
			align-items: center;
			text-align: center;
		}
		.poster {
			width: 180px;
			min-width: 180px;
		}
		.badges,
		.genres,
		.actions,
		.rate {
			justify-content: center;
		}
		.related-grid {
			grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
			gap: 12px;
		}
	}
</style>
