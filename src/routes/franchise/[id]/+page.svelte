<script>
	import { page } from '$app/stores';
	import { getApi } from '$lib/api';
	import { thumb } from '$lib/utils';
	import AnimeCard from '$lib/components/AnimeCard.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Icon from '$lib/components/Icon.svelte';

	$: id = Number($page.params.id);
	let franchise = null;
	let releases = [];
	let pageNum = 0;
	let loading = true;
	let loadingMore = false;
	let hasMore = true;

	async function load(reset = true) {
		if (reset) {
			pageNum = 0;
			releases = [];
			hasMore = true;
			loading = true;
		}
		try {
			const api = getApi();
			const data = await api.release.getRelatedReleases(id, pageNum);
			const list = data?.content || [];
			releases = reset ? list : [...releases, ...list];
			hasMore = pageNum < (data?.total_page_count ?? 1) - 1;
			// Мета франшизы (имя/обложка) не приходит в /related — берём из .related первого тайтла.
			if (reset && !franchise && list[0]) {
				api.release
					.info(list[0].id, false)
					.then((d) => {
						if (d?.release?.related?.id) franchise = d.release.related;
					})
					.catch(() => {});
			}
		} catch (e) {
			console.error('franchise', e);
		}
		loading = false;
		loadingMore = false;
	}
	function onScroll(e) {
		const el = e.target;
		if (hasMore && !loadingMore && el.scrollHeight - el.scrollTop - el.clientHeight < 600) {
			loadingMore = true;
			pageNum++;
			load(false);
		}
	}
	$: if (id) load(true);
</script>

<svelte:head><title>{franchise?.name_ru || franchise?.name || 'Франшиза'} — AniShiki</title></svelte:head>

<div class="page" on:scroll={onScroll}>
	<div class="hero">
		{#if franchise?.image}<img class="bg" src={thumb(franchise.image, { w: 720, q: 50 })} alt="" referrerpolicy="no-referrer" decoding="async" />{/if}
		<div class="grad"></div>
		<div class="hero-content">
			<button class="back" on:click={() => history.back()}><Icon name="back" size={18} /> Назад</button>
			<span class="eyebrow">Франшиза</span>
			<h1>{franchise?.name_ru || franchise?.name || 'Франшиза'}</h1>
			{#if franchise?.release_count}<p class="cnt">{franchise.release_count} тайтлов</p>{/if}
			{#if franchise?.description}<p class="desc">{franchise.description}</p>{/if}
		</div>
	</div>

	<div class="inner">
		{#if loading}
			<Spinner center label="Загрузка…" />
		{:else if releases.length === 0}
			<p class="empty">Нет тайтлов</p>
		{:else}
			<div class="grid">{#each releases as r (r.id)}<AnimeCard anime={r} type="grid" />{/each}</div>
			{#if loadingMore}<Spinner size={28} />{/if}
		{/if}
	</div>
</div>

<style>
	.page {
		height: 100%;
		overflow-y: auto;
	}
	.hero {
		position: relative;
		min-height: 300px;
		display: flex;
		align-items: flex-end;
		overflow: hidden;
	}
	.bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: blur(22px);
		transform: scale(1.1);
		opacity: 0.45;
	}
	.grad {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, var(--background-color), transparent 85%);
	}
	.hero-content {
		position: relative;
		z-index: 1;
		max-width: 1100px;
		margin: 0 auto;
		width: 100%;
		padding: 24px;
	}
	.back {
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
		margin-bottom: 18px;
	}
	.eyebrow {
		display: block;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 1.5px;
		color: var(--primary-color);
		margin-bottom: 8px;
	}
	h1 {
		font-size: clamp(28px, 4vw, 44px);
		font-weight: 800;
	}
	.cnt {
		color: var(--secondary-text-color);
		margin-top: 6px;
		font-weight: 600;
	}
	.desc {
		margin-top: 12px;
		max-width: 720px;
		font-size: 14px;
		line-height: 1.6;
		color: var(--secondary-text-color);
	}
	.inner {
		max-width: 1400px;
		margin: 0 auto;
		padding: 28px 24px 50px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 18px;
	}
	.empty {
		text-align: center;
		padding: 60px;
		color: var(--secondary-text-color);
	}
	@media (max-width: 768px) {
		.inner {
			padding: 20px 12px 40px;
		}
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
			gap: 12px;
		}
	}
</style>
