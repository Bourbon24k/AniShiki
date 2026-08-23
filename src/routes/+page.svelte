<script>
	/**
	 * Главная.
	 *
	 * Тяжёлое место было в том, что страница на каждый заход дёргала шесть
	 * запросов сразу и рисовала все ряды разом. Теперь первый экран берётся из
	 * кэша каталога (мгновенно, если заходили недавно), остальные ряды грузятся
	 * по мере прокрутки, а подборки собираются отдельно и не задерживают показ.
	 */
	import { onMount } from 'svelte';
	import { userToken } from '$lib/stores';
	import { authReady, siteSession } from '$lib/stores/auth';
	import { getContinueWatching } from '$lib/personal';
	import { buildPicks } from '$lib/picks';
	import { catalogPageLive, clearCatalogCache } from '$lib/catalog';
	import Hero from '$lib/components/Hero.svelte';
	import ReleaseRow from '$lib/components/ReleaseRow.svelte';
	import LazyRow from '$lib/components/LazyRow.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';

	const year = new Date().getFullYear();
	// Hero и «Сейчас популярно» — реальная популярность (sort 3), суженная до
	// текущего и прошлого года: sort 1 — это «по оценке», вечный топ, где
	// «сейчас» нет вообще (в выдаче висят тайтлы 1999–2000 годов).
	const POPULAR = { sort: 3, start_year: year - 1, end_year: year };

	let popular = [];
	let heroLoading = true;
	let failed = false;

	let watching = [];
	let watchingLoading = false;

	let picks = [];
	let picksLoading = true;

	$: heroItems = popular.slice(0, 6);

	async function loadPopular() {
		failed = false;
		heroLoading = true;
		try {
			// Отдаёт кэш сразу и тихо обновляет его в фоне.
			popular = await catalogPageLive(POPULAR, 0, (fresh) => {
				if (fresh?.length) popular = fresh;
			});
			if (!popular.length) failed = true;
		} catch (e) {
			console.error('home popular', e);
			failed = true;
		}
		heroLoading = false;
	}

	function retry() {
		clearCatalogCache();
		loadPopular();
		picksLoading = true;
		picksFor = undefined;
		syncPicks(($userToken && 'anixart') || $siteSession?.user?.id || null);
	}

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

	// Подборки ждут готовности авторизации: без неё вкусы аккаунта не видны.
	let picksFor = undefined;
	$: if ($authReady) syncPicks(($userToken && 'anixart') || $siteSession?.user?.id || null);

	function syncPicks(key) {
		if (key === picksFor) return;
		picksFor = key;
		picksLoading = true;
		buildPicks({ max: 4 })
			.then((rows) => (picks = rows))
			.catch((e) => {
				console.error('picks', e);
				picks = [];
			})
			.finally(() => (picksLoading = false));
	}

	onMount(loadPopular);
</script>

<svelte:head>
	<title>AniShiki — Главная</title>
</svelte:head>

<div class="home">
	{#if failed && !popular.length && !heroLoading}
		<div class="offline">
			<strong>Каталог сейчас недоступен</strong>
			<p>
				Сервер Anixart, откуда берутся тайтлы, не отвечает. Это не на нашей стороне — списки
				появятся, как только он поднимется.
			</p>
			<button on:click={retry}>Повторить</button>
		</div>
	{/if}

	{#if heroLoading && !popular.length}
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

	{#if picksLoading}
		<div class="picks-sk">
			<Skeleton h="26px" w="220px" radius="8px" />
		</div>
	{:else}
		{#each picks as row (row.id)}
			<ReleaseRow title={row.title} subtitle={row.subtitle} items={row.items} href={row.href} />
		{/each}
	{/if}

	<ReleaseRow
		title="Сейчас популярно"
		items={popular}
		loading={heroLoading && !popular.length}
		numbered
		href="/search?type=5"
	/>

	<LazyRow title="Онгоинги" href="/search?type=1" load={() => catalogPageLive({ sort: 0, status_id: 2 }, 0)} />
	<LazyRow title="Анонсы" href="/search?type=2" load={() => catalogPageLive({ sort: 0, status_id: 3 }, 0)} />
	<LazyRow title="Завершённые" href="/search?type=3" load={() => catalogPageLive({ sort: 0, status_id: 1 }, 0)} />
	<LazyRow title="Фильмы" href="/search?type=4" load={() => catalogPageLive({ sort: 0, category_id: 2 }, 0)} />
	<LazyRow
		title="Высокие оценки"
		subtitle="Проверено временем"
		href="/discover"
		load={() => catalogPageLive({ sort: 1 }, 0)}
	/>
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
	.picks-sk {
		margin-bottom: 34px;
	}
	.offline {
		margin-bottom: 28px;
		padding: 22px 24px;
		border-radius: 18px;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
	}
	.offline strong {
		font-size: 17px;
	}
	.offline p {
		margin: 6px 0 14px;
		font-size: 13.5px;
		color: var(--secondary-text-color);
		max-width: 620px;
	}
	.offline button {
		padding: 10px 18px;
		border: none;
		border-radius: 10px;
		background: var(--primary-color);
		color: #fff;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
	}
	@media (max-width: 768px) {
		.home {
			padding: 0 12px 24px;
		}
		.hero-sk {
			height: 460px;
			margin: 0 -12px 18px;
		}
		.picks-sk {
			margin-bottom: 18px;
		}
	}
</style>
