<script>
	import { onMount } from 'svelte';
	import { getApi } from '$lib/api';
	import { userToken } from '$lib/stores';
	import { returnTimeString } from '$lib/utils';
	import Icon from '$lib/components/Icon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let articles = [];
	let pageNum = 0;
	let loading = true;
	let loadingMore = false;
	let hasMore = true;
	let tab = 'latest';

	function blocksText(a) {
		const blocks = a?.payload?.blocks || [];
		return blocks
			.filter((b) => b.type === 'text' || b.data?.text)
			.map((b) => b.data?.text || '')
			.join('\n')
			.replace(/<[^>]+>/g, '')
			.slice(0, 400);
	}
	function blocksImages(a) {
		const blocks = a?.payload?.blocks || [];
		return blocks
			.filter((b) => b.type === 'media' || b.type === 'image')
			.flatMap((b) => b.data?.items?.map((i) => i.image || i.url) || [b.data?.url])
			.filter(Boolean)
			.slice(0, 4);
	}

	async function load(reset = true) {
		const api = getApi();
		if (!api) return;
		if (reset) {
			pageNum = 0;
			articles = [];
			hasMore = true;
			loading = true;
		}
		try {
			const data = tab === 'my' && $userToken ? await api.feed.my(pageNum) : await api.feed.latest(pageNum);
			const list = (data?.content || []).filter((a) => !a.is_deleted);
			articles = reset ? list : [...articles, ...list];
			hasMore = pageNum < (data?.total_page_count ?? 1) - 1;
		} catch (e) {
			console.error('feed', e);
		}
		loading = false;
		loadingMore = false;
	}

	function more() {
		if (!hasMore || loadingMore) return;
		loadingMore = true;
		pageNum++;
		load(false);
	}
	function setTab(t) {
		tab = t;
		load(true);
	}
	function onScroll(e) {
		const el = e.target;
		if (el.scrollHeight - el.scrollTop - el.clientHeight < 600) more();
	}
	onMount(() => load(true));
</script>

<svelte:head><title>Лента — AniShiki</title></svelte:head>

<div class="page" on:scroll={onScroll}>
	<div class="inner">
		<div class="head">
			<h1>Лента</h1>
			{#if $userToken}
				<div class="tabs">
					<button class:active={tab === 'latest'} on:click={() => setTab('latest')}>Все</button>
					<button class:active={tab === 'my'} on:click={() => setTab('my')}>Мои подписки</button>
				</div>
			{/if}
		</div>

		{#if loading}
			<Spinner center label="Загрузка ленты…" />
		{:else if articles.length === 0}
			<p class="empty">Лента пуста</p>
		{:else}
			<div class="list">
				{#each articles as a (a.id)}
					<article class="post glass">
						<header>
							<a class="ch" href={a.channel ? `/profile/${a.author?.id || ''}` : '#'}>
								{#if a.channel?.avatar || a.author?.avatar}
									<img src={a.channel?.avatar || a.author?.avatar} alt="" referrerpolicy="no-referrer" />
								{:else}
									<span class="ph"><Icon name="user" size={18} /></span>
								{/if}
								<div>
									<span class="name">{a.channel?.title || a.author?.login || 'Канал'}</span>
									<span class="time">{returnTimeString((a.creation_date || a.payload?.time) * 1000)}</span>
								</div>
							</a>
						</header>
						{#if blocksText(a)}<p class="text">{blocksText(a)}</p>{/if}
						{#if blocksImages(a).length}
							<div class="media" class:single={blocksImages(a).length === 1}>
								{#each blocksImages(a) as img}
									<img src={img} alt="" referrerpolicy="no-referrer" loading="lazy" />
								{/each}
							</div>
						{/if}
						<footer>
							<span><Icon name="star" size={15} /> {a.vote_count || 0}</span>
							<span>💬 {a.comment_count || 0}</span>
							<span>🔁 {a.repost_count || 0}</span>
						</footer>
					</article>
				{/each}
			</div>
			{#if loadingMore}<Spinner size={28} />{/if}
		{/if}
	</div>
</div>

<style>
	.page {
		height: 100%;
		overflow-y: auto;
	}
	.inner {
		max-width: 720px;
		margin: 0 auto;
		padding: 24px;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 20px;
	}
	h1 {
		font-size: 30px;
		font-weight: 800;
	}
	.tabs {
		display: flex;
		gap: 6px;
		background: var(--alt-background-color);
		padding: 4px;
		border-radius: 12px;
	}
	.tabs button {
		padding: 8px 14px;
		border: none;
		background: transparent;
		color: var(--secondary-text-color);
		border-radius: 9px;
		cursor: pointer;
		font-weight: 600;
		font-size: 13px;
	}
	.tabs button.active {
		background: var(--primary-color);
		color: #fff;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.post {
		padding: 18px;
		border-radius: 18px;
	}
	header .ch {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 12px;
	}
	.ch img,
	.ch .ph {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		object-fit: cover;
		display: grid;
		place-items: center;
		background: var(--background-color);
		color: var(--secondary-text-color);
	}
	.ch .name {
		display: block;
		font-weight: 700;
		font-size: 15px;
	}
	.ch .time {
		font-size: 12px;
		color: var(--third-text-color);
	}
	.text {
		font-size: 15px;
		line-height: 1.6;
		white-space: pre-wrap;
		word-break: break-word;
		margin-bottom: 12px;
	}
	.media {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
		border-radius: 14px;
		overflow: hidden;
		margin-bottom: 12px;
	}
	.media.single {
		grid-template-columns: 1fr;
	}
	.media img {
		width: 100%;
		max-height: 360px;
		object-fit: cover;
	}
	footer {
		display: flex;
		gap: 18px;
		color: var(--secondary-text-color);
		font-size: 13px;
	}
	footer span {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.empty {
		text-align: center;
		padding: 60px;
		color: var(--secondary-text-color);
	}
	@media (max-width: 768px) {
		.inner {
			padding: 16px 12px;
		}
		h1 {
			font-size: 24px;
		}
	}
</style>
