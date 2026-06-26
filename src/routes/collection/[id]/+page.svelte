<script>
	import { page } from '$app/stores';
	import { getApi } from '$lib/api';
	import { userToken, showToast } from '$lib/stores';
	import { thumb } from '$lib/utils';
	import AnimeCard from '$lib/components/AnimeCard.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Icon from '$lib/components/Icon.svelte';

	$: id = Number($page.params.id);
	let collection = null;
	let releases = [];
	let pageNum = 0;
	let loading = true;
	let loadingMore = false;
	let hasMore = true;
	let isFav = false;

	async function load() {
		loading = true;
		releases = [];
		pageNum = 0;
		try {
			const api = getApi();
			const info = await api.collection.info(id);
			collection = info?.collection;
			isFav = !!collection?.is_favorite;
			const rel = await api.collection.getCollectionReleases(id, 0);
			releases = rel?.content || [];
			hasMore = pageNum < (rel?.total_page_count ?? 1) - 1;
		} catch (e) {
			console.error('collection', e);
		}
		loading = false;
	}
	async function more() {
		if (!hasMore || loadingMore) return;
		loadingMore = true;
		pageNum++;
		try {
			const rel = await getApi().collection.getCollectionReleases(id, pageNum);
			releases = [...releases, ...(rel?.content || [])];
			hasMore = pageNum < (rel?.total_page_count ?? 1) - 1;
		} catch {}
		loadingMore = false;
	}
	async function toggleFav() {
		if (!$userToken) return showToast('Войдите в аккаунт', 'error');
		const prev = isFav;
		isFav = !isFav;
		try {
			if (prev) await getApi().collection.removeCollectionFavorite(id);
			else await getApi().collection.addCollectionFavorite(id);
		} catch {
			isFav = prev;
			showToast('Ошибка', 'error');
		}
	}
	function onScroll(e) {
		const el = e.target;
		if (el.scrollHeight - el.scrollTop - el.clientHeight < 500) more();
	}
	$: if (id) load();
</script>

<svelte:head><title>{collection?.title || 'Коллекция'} — AniShiki</title></svelte:head>

<div class="page" on:scroll={onScroll}>
	{#if loading}
		<Spinner center label="Загрузка…" />
	{:else if collection}
		<div class="hero">
			{#if collection.image}<img class="bg" src={thumb(collection.image, { w: 720, q: 50 })} alt="" referrerpolicy="no-referrer" decoding="async" />{/if}
			<div class="hero-grad"></div>
			<div class="hero-content">
				<button class="back" on:click={() => history.back()}><Icon name="back" size={18} /> Назад</button>
				<h1>{collection.title}</h1>
				<div class="meta">
					<a href={`/profile/${collection.creator?.id}`} class="creator">
						{#if collection.creator?.avatar}<img src={thumb(collection.creator.avatar, { w: 64 })} alt="" referrerpolicy="no-referrer" />{/if}
						{collection.creator?.login || ''}
					</a>
					<span>{collection.release_count ?? releases.length} релизов</span>
					<span><Icon name="bookmark" size={13} /> {collection.favorites_count ?? 0}</span>
				</div>
				{#if collection.description}<p class="desc">{collection.description}</p>{/if}
				<button class="fav" class:on={isFav} on:click={toggleFav}>
					<Icon name={isFav ? 'bookmark' : 'bookmarkAdd'} size={18} />
					{isFav ? 'В избранном' : 'В избранное'}
				</button>
			</div>
		</div>

		<div class="grid-wrap">
			<div class="grid">
				{#each releases as r (r.id)}<AnimeCard anime={r} type="grid" />{/each}
			</div>
			{#if loadingMore}<Spinner size={28} />{/if}
		</div>
	{:else}
		<div class="err"><h2>Коллекция не найдена</h2></div>
	{/if}
</div>

<style>
	.page {
		height: 100%;
		overflow-y: auto;
	}
	.hero {
		position: relative;
		min-height: 320px;
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
		filter: blur(20px);
		transform: scale(1.1);
		opacity: 0.5;
	}
	.hero-grad {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, var(--background-color), transparent 80%);
	}
	.hero-content {
		position: relative;
		z-index: 1;
		max-width: 900px;
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
	h1 {
		font-size: clamp(26px, 4vw, 40px);
		font-weight: 800;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 16px;
		margin: 14px 0;
		font-size: 14px;
		color: var(--secondary-text-color);
	}
	.meta span {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.creator {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-weight: 600;
		color: var(--text-color);
	}
	.creator img {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		object-fit: cover;
	}
	.desc {
		font-size: 14px;
		line-height: 1.6;
		color: var(--secondary-text-color);
		max-width: 700px;
		margin-bottom: 16px;
	}
	.fav {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 11px 20px;
		border: 1px solid var(--glass-border);
		background: var(--elevated-color);
		color: var(--text-color);
		border-radius: 12px;
		font-weight: 600;
		cursor: pointer;
	}
	.fav.on {
		background: var(--primary-color);
		color: #fff;
		border-color: transparent;
	}
	.grid-wrap {
		max-width: 1400px;
		margin: 0 auto;
		padding: 28px 24px 50px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 18px;
	}
	.err {
		text-align: center;
		padding: 80px;
	}
	@media (max-width: 768px) {
		.grid-wrap {
			padding: 20px 12px 40px;
		}
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
			gap: 12px;
		}
	}
</style>
