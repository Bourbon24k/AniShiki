<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { getSiteProfile } from '$lib/siteprofile';
	import { listCollectionsByUser } from '$lib/collections';
	import { siteSession } from '$lib/stores/auth';
	import GridList from '$lib/components/GridList.svelte';
	import CollectionCard from '$lib/components/CollectionCard.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	$: id = $page.params.id;

	let profile = null;
	let collections = [];
	let loading = true;
	let notFound = false;
	let tab = 1;

	const TABS = [
		{ key: 1, label: 'Смотрю' },
		{ key: 2, label: 'В планах' },
		{ key: 3, label: 'Просмотрено' },
		{ key: 4, label: 'Отложено' },
		{ key: 5, label: 'Брошено' },
		{ key: 'fav', label: 'Избранное' },
		{ key: 'rated', label: 'Оценки' },
		{ key: 'col', label: 'Коллекции' }
	];

	$: items =
		!profile ? [] : tab === 'fav' ? profile.favorites : tab === 'rated' ? profile.rated : tab === 'col' ? [] : profile.byStatus(tab);

	function countFor(key) {
		if (!profile) return 0;
		if (key === 'fav') return profile.favoriteCount;
		if (key === 'rated') return profile.ratedCount;
		if (key === 'col') return collections.length;
		return profile.counts[key] || 0;
	}

	async function load(userId) {
		loading = true;
		notFound = false;
		const [p, c] = await Promise.all([
			getSiteProfile(userId).catch((e) => {
				console.error('profile', e);
				return null;
			}),
			listCollectionsByUser(userId).catch(() => [])
		]);
		profile = p;
		collections = c;
		notFound = !p;
		loading = false;
	}

	let loadedFor;
	$: if (id && id !== loadedFor) {
		loadedFor = id;
		load(id);
	}

	onMount(() => {});
</script>

<svelte:head><title>{profile?.username || 'Профиль'} — AniShiki</title></svelte:head>

<div class="page">
	<div class="inner">
		{#if loading}
			<Spinner center label="Загрузка профиля…" />
		{:else if notFound}
			<div class="empty">
				<p>Профиль не найден</p>
				<a class="btn" href="/">На главную</a>
			</div>
		{:else}
			<header class="top">
				<div class="ava">
					{#if profile.avatar}
						<img src={profile.avatar} alt="" referrerpolicy="no-referrer" />
					{:else}
						<span class="ph"><Icon name="user" size={30} /></span>
					{/if}
				</div>
				<div class="who">
					<h1>{profile.username}</h1>
					<p class="meta">
						{#if profile.registeredAt}
							на сайте с {new Date(profile.registeredAt).getFullYear()}
						{/if}
						{#if profile.ratedCount}
							· средняя оценка {profile.avgRating}
						{/if}
					</p>
				</div>
				{#if profile.isMine}
					<a class="edit" href="/me">Мой профиль</a>
				{:else if $siteSession}
					<a class="edit" href="/friends">Друзья</a>
				{/if}
			</header>

			<div class="tabs no-scrollbar">
				{#each TABS as t}
					<button class="tab" class:active={tab === t.key} on:click={() => (tab = t.key)}>
						{t.label}
						<span class="cnt">{countFor(t.key)}</span>
					</button>
				{/each}
			</div>

			{#if tab === 'col'}
				{#if collections.length === 0}
					<p class="empty">Коллекций нет</p>
				{:else}
					<div class="cols">
						{#each collections as c (c.id)}<CollectionCard collection={c} />{/each}
					</div>
				{/if}
			{:else}
				<GridList {items} loading={false} empty="Здесь пока пусто" />
			{/if}
		{/if}
	</div>
</div>

<style>
	.page {
		height: 100%;
		overflow-y: auto;
	}
	.inner {
		max-width: 1200px;
		margin: 0 auto;
		padding: 24px;
	}
	.top {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-bottom: 22px;
	}
	.ava {
		width: 84px;
		height: 84px;
		border-radius: 50%;
		overflow: hidden;
		flex-shrink: 0;
		background: var(--alt-background-color);
	}
	.ava img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.ph {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		color: var(--secondary-text-color);
	}
	.who {
		flex: 1;
		min-width: 0;
	}
	h1 {
		font-size: 26px;
		font-weight: 800;
		letter-spacing: -0.4px;
	}
	.meta {
		margin-top: 4px;
		font-size: 13px;
		color: var(--secondary-text-color);
	}
	.edit {
		flex-shrink: 0;
		padding: 9px 14px;
		border-radius: 10px;
		border: 1px solid var(--glass-border);
		font-size: 13px;
		font-weight: 600;
	}
	.tabs {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		margin-bottom: 18px;
		padding-bottom: 4px;
	}
	.tab {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 9px 14px;
		border-radius: 10px;
		border: 1px solid var(--glass-border);
		background: transparent;
		color: var(--secondary-text-color);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}
	.tab.active {
		background: var(--primary-color);
		border-color: var(--primary-color);
		color: #fff;
	}
	.cnt {
		font-size: 11px;
		opacity: 0.75;
	}
	.cols {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 16px;
	}
	.empty {
		padding: 40px 0;
		text-align: center;
		color: var(--secondary-text-color);
	}
	.btn {
		display: inline-block;
		margin-top: 12px;
		padding: 10px 18px;
		border-radius: 10px;
		background: var(--primary-color);
		color: #fff;
		font-weight: 700;
	}
	@media (max-width: 768px) {
		.inner {
			padding: 16px 12px 24px;
		}
		.ava {
			width: 64px;
			height: 64px;
		}
		h1 {
			font-size: 21px;
		}
	}
</style>
