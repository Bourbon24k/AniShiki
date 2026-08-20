<script>
	import { onMount } from 'svelte';
	import { getApi } from '$lib/api';
	import { userToken } from '$lib/stores';
	import { authReady, siteSession } from '$lib/stores/auth';
	import { getContinueWatching, getRecommendations } from '$lib/personal';
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

	let watchingLoading = false;
	let recommended = [];
	let recommendedPersonal = false;
	let recommendedLoading = true;

	// «Продолжить просмотр»: сессия резолвится асинхронно, поэтому перезагружаем
	// список на каждую смену пользователя (вход и выход).
	let continueFor = undefined;
	$: if ($authReady) syncContinue(($userToken && 'anixart') || $siteSession?.user?.id || null);

	function syncContinue(key) {
		if (key === continueFor) return;
		continueFor = key;
		if (!key) {
			watching = [];
			watchingLoading = false;
			return;
		}
		watchingLoading = true;
		getContinueWatching()
			.then((r) => (watching = r))
			.catch((e) => {
				console.error('continue watching', e);
				watching = [];
			})
			.finally(() => (watchingLoading = false));
	}

	// Рекомендации ждут готовности авторизации: без неё вкусы аккаунта не видны.
	let recommendedFor = undefined;
	$: if ($authReady) syncRecommended(($userToken && 'anixart') || $siteSession?.user?.id || null);

	function syncRecommended(key) {
		if (key === recommendedFor) return;
		recommendedFor = key;
		recommendedLoading = true;
		getRecommendations()
			.then(({ items, personal }) => {
				recommended = items;
				recommendedPersonal = personal;
			})
			.catch((e) => {
				console.error('recommendations', e);
				recommended = [];
			})
			.finally(() => (recommendedLoading = false));
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

		// Hero и «Сейчас популярно» — реальная популярность (sort 3), суженная до
		// текущего и прошлого года: sort 1 — это «по оценке», вечный топ, где
		// «сейчас» нет вообще (в выдаче висят тайтлы 1999–2000 годов).
		const year = new Date().getFullYear();
		const pop = await safe(api.release.filter(0, { sort: 3, start_year: year - 1, end_year: year }, true));
		popular = pop;
		heroItems = pop.slice(0, 6);
		heroLoading = false;

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

	{#if ($userToken || $siteSession) && (watchingLoading || watching.length)}
		<ReleaseRow
			title="Продолжить просмотр"
			items={watching}
			loading={watchingLoading && !watching.length}
			href="/history"
		/>
	{/if}

	{#if recommendedLoading || recommended.length}
		<ReleaseRow
			title={recommendedPersonal ? 'Рекомендации для вас' : 'Может понравиться'}
			items={recommended}
			loading={recommendedLoading && !recommended.length}
			href="/discover"
		/>
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
			margin: 0 -12px 24px;
		}
	}
</style>
