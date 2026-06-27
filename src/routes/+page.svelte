<script>
	import { onMount } from 'svelte';
	import { getApi } from '$lib/api';
	import { userToken } from '$lib/stores';
	import { siteSession } from '$lib/stores/auth';
	import { listContinue } from '$lib/sitedata';
	import Hero from '$lib/components/Hero.svelte';
	import ReleaseRow from '$lib/components/ReleaseRow.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';

	let heroItems = [];
	let watching = [];
	let popular = [];
	let ongoing = [];
	let announce = [];
	let completed = [];
	let films = [];
	let heroLoading = true;
	let rowsLoading = true;

	// «Продолжить просмотр» для аккаунта сайта (сессия резолвится асинхронно)
	let contLoaded = false;
	$: if (!$userToken && $siteSession && !contLoaded) {
		contLoaded = true;
		listContinue()
			.then((r) => (watching = r))
			.catch(() => {});
	}

	async function safe(p) {
		try {
			const r = await p;
			return r?.content || [];
		} catch (e) {
			console.error('home load error', e);
			return [];
		}
	}

	onMount(async () => {
		const api = getApi();
		if (!api) return;

		// Hero — популярное.
		const pop = await safe(api.release.filter(0, { sort: 1 }, true));
		popular = pop;
		heroItems = pop.slice(0, 6);
		heroLoading = false;

		// Продолжить просмотр (если авторизован в Anixart).
		if ($userToken) {
			watching = await safe(api.discover.getWatching(0));
		}

		const [on, an, co, fi] = await Promise.all([
			safe(api.release.filter(0, { sort: 0, status_id: 2 }, true)),
			safe(api.release.filter(0, { sort: 0, status_id: 3 }, true)),
			safe(api.release.filter(0, { sort: 0, status_id: 1 }, true)),
			safe(api.release.filter(0, { sort: 0, category_id: 2 }, true))
		]);
		ongoing = on;
		announce = an;
		completed = co;
		films = fi;
		rowsLoading = false;
	});
</script>

<svelte:head>
	<title>AniShiki — Главная</title>
</svelte:head>

<div class="home">
	{#if heroLoading}
		<div class="hero-sk"><Skeleton h="100%" radius="24px" /></div>
	{:else}
		<Hero items={heroItems} />
	{/if}

	{#if ($userToken || $siteSession) && watching.length}
		<ReleaseRow title="Продолжить просмотр" items={watching} numbered={false} />
	{/if}

	<ReleaseRow title="Сейчас популярно" items={popular} loading={heroLoading} numbered href="/search?type=5" />
	<ReleaseRow title="Онгоинги" items={ongoing} loading={rowsLoading} href="/search?type=1" />
	<ReleaseRow title="Анонсы" items={announce} loading={rowsLoading} href="/search?type=2" />
	<ReleaseRow title="Завершённые" items={completed} loading={rowsLoading} href="/search?type=3" />
	<ReleaseRow title="Фильмы" items={films} loading={rowsLoading} href="/search?type=4" />
</div>

<style>
	.home {
		max-width: 1500px;
		margin: 0 auto;
		padding: 16px 24px 48px;
	}
	.hero-sk {
		height: clamp(380px, 56vh, 560px);
		margin-bottom: 34px;
	}
	@media (max-width: 768px) {
		.home {
			padding: 0 12px 24px;
		}
		.hero-sk {
			height: 460px;
			margin: -10px -12px 24px;
		}
	}
</style>
