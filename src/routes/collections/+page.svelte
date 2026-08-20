<script>
	import { onMount } from 'svelte';
	import { getApi } from '$lib/api';
	import { collectionSortValues } from '$lib/utils';
	import { userToken, showToast } from '$lib/stores';
	import { authReady, siteSession } from '$lib/stores/auth';
	import { listMyCollections, listPublicCollections, createCollection } from '$lib/collections';
	import CollectionCard from '$lib/components/CollectionCard.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';

	let items = [];
	let pageNum = 0;
	let sort = 1;
	let loading = true;
	let hasMore = true;

	// Коллекции аккаунта сайта живут в Supabase и показываются своими вкладками.
	$: siteOnly = !$userToken && !!$siteSession;
	let scope = 'site'; // 'site' — публичные подборки сайта, 'mine' — свои
	let siteItems = [];
	let siteLoading = false;
	let siteFor = undefined;
	let creating = false;
	let newTitle = '';

	$: if ($authReady && siteOnly) loadSite($siteSession?.user?.id ?? null, scope);

	async function loadSite(userId, which) {
		const key = `${userId}:${which}`;
		if (key === siteFor) return;
		siteFor = key;
		siteLoading = true;
		siteItems = await (which === 'mine' ? listMyCollections() : listPublicCollections()).catch((e) => {
			console.error('collections', e);
			return [];
		});
		siteLoading = false;
	}

	function pickScope(next) {
		scope = next;
	}

	async function create() {
		const title = newTitle.trim();
		if (!title) return showToast('Нужно название', 'error');
		try {
			const created = await createCollection({ title });
			newTitle = '';
			creating = false;
			scope = 'mine';
			siteFor = undefined; // заставим перечитать список
			siteItems = [created, ...siteItems];
			showToast('Коллекция создана', 'success');
		} catch (e) {
			console.error(e);
			showToast('Не удалось создать', 'error');
		}
	}

	async function load(reset = true) {
		if (reset) {
			pageNum = 0;
			items = [];
			hasMore = true;
			loading = true;
		}
		try {
			const data = await getApi().collection.all(pageNum, sort);
			const list = data?.content || [];
			items = reset ? list : [...items, ...list];
			hasMore = pageNum < (data?.total_page_count ?? 1) - 1;
		} catch (e) {
			console.error('collections', e);
		}
		loading = false;
	}
	function pickSort(v) {
		sort = v;
		load(true);
	}
	function onScroll(e) {
		const el = e.target;
		if (hasMore && el.scrollHeight - el.scrollTop - el.clientHeight < 500) {
			hasMore = false;
			pageNum++;
			load(false).then(() => (hasMore = true));
		}
	}
	onMount(() => {
		if (!siteOnly) load(true);
	});
</script>

<svelte:head><title>Коллекции — AniShiki</title></svelte:head>
<div class="page" on:scroll={onScroll}>
	<div class="inner">
		<div class="head">
			<h1>Коллекции</h1>
			{#if siteOnly}
				<button class="new" on:click={() => (creating = !creating)}>Создать</button>
			{/if}
		</div>

		{#if siteOnly}
			{#if creating}
				<div class="create">
					<input bind:value={newTitle} maxlength="100" placeholder="Название коллекции" />
					<button class="new" on:click={create}>Готово</button>
				</div>
			{/if}
			<div class="tabs no-scrollbar">
				<button class="tab" class:active={scope === 'site'} on:click={() => pickScope('site')}>Все</button>
				<button class="tab" class:active={scope === 'mine'} on:click={() => pickScope('mine')}>Мои</button>
			</div>
		{:else}
			<div class="tabs no-scrollbar">
				{#each collectionSortValues as s}
					<button class="tab" class:active={sort === s.value} on:click={() => pickSort(s.value)}>{s.label}</button>
				{/each}
			</div>
		{/if}
		{#if siteOnly}
			{#if siteLoading}
				<div class="grid">{#each Array(6) as _}<Skeleton aspect="16/10" radius="16px" />{/each}</div>
			{:else if siteItems.length === 0}
				<p class="empty">
					{scope === 'mine' ? 'У вас пока нет коллекций — создайте первую.' : 'Публичных коллекций пока нет.'}
				</p>
			{:else}
				<div class="grid">{#each siteItems as c (c.id)}<CollectionCard collection={c} />{/each}</div>
			{/if}
		{:else if loading}
			<div class="grid">{#each Array(9) as _}<Skeleton aspect="16/10" radius="16px" />{/each}</div>
		{:else if items.length === 0}
			<p class="empty">Нет коллекций</p>
		{:else}
			<div class="grid">{#each items as c (c.id)}<CollectionCard collection={c} />{/each}</div>
		{/if}
	</div>
</div>

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.new {
		flex-shrink: 0;
		padding: 9px 15px;
		border: none;
		border-radius: 10px;
		background: var(--primary-color);
		color: #fff;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
	}
	.create {
		display: flex;
		gap: 8px;
		margin: 14px 0 4px;
	}
	.create input {
		flex: 1;
		min-width: 0;
		padding: 11px 13px;
		border-radius: 11px;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		color: var(--text-color);
		font: inherit;
		font-size: 14px;
	}

	.page {
		height: 100%;
		overflow-y: auto;
	}
	.inner {
		max-width: 1400px;
		margin: 0 auto;
		padding: 20px 24px 40px;
	}
	h1 {
		font-size: 30px;
		font-weight: 800;
		margin-bottom: 18px;
	}
	.tabs {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		margin-bottom: 20px;
	}
	.tab {
		white-space: nowrap;
		padding: 9px 16px;
		border: 1px solid var(--glass-border);
		background: var(--alt-background-color);
		color: var(--secondary-text-color);
		border-radius: 11px;
		cursor: pointer;
		font-weight: 600;
		font-size: 13px;
	}
	.tab.active {
		background: var(--primary-color);
		color: #fff;
		border-color: transparent;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 18px;
	}
	.empty {
		text-align: center;
		padding: 60px;
		color: var(--secondary-text-color);
	}
	@media (max-width: 768px) {
		.inner {
			padding: 14px 12px 32px;
		}
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
			gap: 12px;
		}
		h1 {
			font-size: 24px;
		}
	}
</style>
